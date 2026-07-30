/**
 * QuickBooks Accounting Provider
 *
 * Implementation of IAccountingProvider for QuickBooks Online.
 */

import { encrypt, decrypt } from '@/modules/integrations/core/lib/encryption';
import {
  getIntegrationByProvider,
  getConnectionByIntegrationId,
  upsertConnection,
  updateConnectionTokens,
  updateConnectionStatus,
  hardDeleteConnection,
} from '@/modules/integrations/core/repositories';
import type {
  ProviderMetadata,
  IAccountingProvider,
  OAuthInitiation,
  OAuthCallbackParams,
  IntegrationConnectionRow,
  ConnectionStatusResponse,
  SyncResult,
  SyncOptions,
  AccountingCompanyInfo,
  AccountingCustomer,
  AccountingInvoice,
  AccountingPayment,
  AccountingProduct,
  CustomerSyncResult,
  InvoiceSyncResult,
  PaymentSyncResult,
} from '@/modules/integrations/core';
import {
  generateState,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  fetchCompanyInfo,
  revokeToken,
  calculateTokenExpiry,
  getQuickBooksConfig,
  getApiBaseUrl,
} from './oauth';
import {
  QBO_SCOPES,
  QBO_API_MINOR_VERSION,
  QBO_ERRORS,
  QBO_DEFAULT_PAGE_SIZE,
} from './constants';
import type {
  QuickBooksEnvironment,
  QuickBooksConnectionMetadata,
  QuickBooksCustomer,
  QuickBooksInvoice,
  QuickBooksPayment,
  QuickBooksItem,
  QuickBooksQueryResponse,
} from './types';

// ============================================
// PROVIDER METADATA
// ============================================

const QUICKBOOKS_METADATA: ProviderMetadata = {
  provider: 'quickbooks',
  type: 'accounting',
  name: 'QuickBooks Online',
  description: 'Sync invoices, payments, and customer data with QuickBooks Online',
  iconUrl: '/icons/quickbooks.svg',
  documentationUrl: 'https://developer.intuit.com/app/developer/qbo/docs/get-started',
  scopes: [...QBO_SCOPES],
  supportedEntities: ['customers', 'invoices', 'payments', 'products'],
};

// ============================================
// QUICKBOOKS PROVIDER CLASS
// ============================================

export class QuickBooksProvider implements IAccountingProvider {
  readonly metadata: ProviderMetadata = QUICKBOOKS_METADATA;

  private integrationId: string | null = null;

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Get the integration ID for QuickBooks
   */
  private async getIntegrationId(): Promise<string> {
    if (this.integrationId) {
      return this.integrationId;
    }

    const integration = await getIntegrationByProvider('quickbooks');
    if (!integration) {
      throw new Error('QuickBooks integration not found in database');
    }

    this.integrationId = integration.id;
    return this.integrationId;
  }

  // ============================================
  // OAUTH FLOW
  // ============================================

  initiateOAuth(): OAuthInitiation {
    const state = generateState();
    const authorizationUrl = buildAuthorizationUrl(state);

    return { state, authorizationUrl };
  }

  async handleOAuthCallback(
    params: OAuthCallbackParams,
    userId?: string
  ): Promise<IntegrationConnectionRow> {
    const { code, realmId } = params as { code: string; realmId: string };

    if (!code || !realmId) {
      throw new Error('Missing code or realmId in OAuth callback');
    }

    const config = getQuickBooksConfig();
    const integrationId = await this.getIntegrationId();

    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForTokens(code);

    // Fetch company info
    const companyInfo = await fetchCompanyInfo(
      tokenResponse.access_token,
      realmId,
      config.environment
    );

    // Encrypt tokens
    const accessTokenEncrypted = encrypt(tokenResponse.access_token);
    const refreshTokenEncrypted = encrypt(tokenResponse.refresh_token);

    // Calculate expiration
    const tokenExpiresAt = calculateTokenExpiry(tokenResponse.expires_in);

    // Build metadata
    const metadata: QuickBooksConnectionMetadata = {
      environment: config.environment,
      companyStartDate: companyInfo.CompanyInfo.CompanyStartDate,
      fiscalYearStartMonth: companyInfo.CompanyInfo.FiscalYearStartMonth,
      country: companyInfo.CompanyInfo.Country,
    };

    // Store connection
    const connection = await upsertConnection({
      integration_id: integrationId,
      external_account_id: realmId,
      external_account_name: companyInfo.CompanyInfo.CompanyName,
      access_token: accessTokenEncrypted,
      refresh_token: refreshTokenEncrypted,
      token_expires_at: tokenExpiresAt,
      environment: config.environment,
      metadata,
      status: 'connected',
      connected_by: userId,
    });

    return connection;
  }

  async disconnect(connectionId: string): Promise<void> {
    const connection = await this.getConnection(connectionId);

    if (!connection) {
      return; // Nothing to disconnect
    }

    // Try to revoke token at Intuit (best effort)
    if (connection.refresh_token) {
      try {
        const refreshToken = decrypt(connection.refresh_token);
        await revokeToken(refreshToken);
      } catch (error) {
        console.warn('Token revocation failed, continuing with disconnect:', error);
      }
    }

    // Remove connection from database
    await hardDeleteConnection(connectionId);
  }

  async getConnectionStatus(connectionId?: string): Promise<ConnectionStatusResponse> {
    const connection = connectionId
      ? await this.getConnection(connectionId)
      : await this.getCurrentConnection();

    if (!connection) {
      return {
        connected: false,
        provider: 'quickbooks',
      };
    }

    const metadata = connection.metadata as QuickBooksConnectionMetadata;

    return {
      connected: connection.status === 'connected',
      provider: 'quickbooks',
      accountId: connection.external_account_id ?? undefined,
      accountName: connection.external_account_name ?? undefined,
      environment: metadata?.environment ?? connection.environment,
      connectedAt: connection.connected_at ?? undefined,
      tokenExpiresAt: connection.token_expires_at ?? undefined,
      status: connection.status,
      errorMessage: connection.error_message ?? undefined,
      lastSyncAt: connection.last_sync_at ?? undefined,
    };
  }

  async isConnected(connectionId?: string): Promise<boolean> {
    const status = await this.getConnectionStatus(connectionId);
    return status.connected;
  }

  async refreshTokenIfNeeded(connectionId: string): Promise<void> {
    const connection = await this.getConnection(connectionId);

    if (!connection || !connection.token_expires_at || !connection.refresh_token) {
      return;
    }

    // Check if token expires within 5 minutes
    const expiresAt = new Date(connection.token_expires_at);
    const buffer = 5 * 60 * 1000; // 5 minutes
    const now = new Date();

    if (expiresAt.getTime() - now.getTime() > buffer) {
      return; // Token is still valid
    }

    try {
      const refreshToken = decrypt(connection.refresh_token);
      const tokenResponse = await refreshAccessToken(refreshToken);

      const accessTokenEncrypted = encrypt(tokenResponse.access_token);
      const refreshTokenEncrypted = encrypt(tokenResponse.refresh_token);
      const tokenExpiresAt = calculateTokenExpiry(tokenResponse.expires_in);

      await updateConnectionTokens(
        connectionId,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt
      );
    } catch (error) {
      console.error('Token refresh failed:', error);
      await updateConnectionStatus(connectionId, 'error', 'Token refresh failed');
      throw error;
    }
  }

  async getAccessToken(
    connectionId: string
  ): Promise<{ accessToken: string; externalAccountId: string; environment: string } | null> {
    const connection = await this.getConnection(connectionId);

    if (!connection || connection.status !== 'connected' || !connection.access_token) {
      return null;
    }

    // Check if token is expired
    if (connection.token_expires_at) {
      const expiresAt = new Date(connection.token_expires_at);
      if (expiresAt <= new Date()) {
        // Try to refresh
        await this.refreshTokenIfNeeded(connectionId);
        // Re-fetch connection after refresh
        const updatedConnection = await this.getConnection(connectionId);
        if (!updatedConnection?.access_token) {
          return null;
        }

        return {
          accessToken: decrypt(updatedConnection.access_token),
          externalAccountId: updatedConnection.external_account_id ?? '',
          environment: updatedConnection.environment,
        };
      }
    }

    return {
      accessToken: decrypt(connection.access_token),
      externalAccountId: connection.external_account_id ?? '',
      environment: connection.environment,
    };
  }

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  async sync(connectionId: string, options?: SyncOptions): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const entityTypes = options?.entityTypes || ['customers', 'invoices', 'payments'];

    for (const entityType of entityTypes) {
      try {
        let result: SyncResult;

        switch (entityType) {
          case 'customers':
            const customers = await this.getCustomers(connectionId, {
              sinceDate: options?.sinceDate,
            });
            result = {
              success: true,
              entityType: 'customers',
              direction: 'inbound',
              recordsProcessed: customers.length,
            };
            break;

          case 'invoices':
            const invoices = await this.getInvoices(connectionId, {
              sinceDate: options?.sinceDate,
            });
            result = {
              success: true,
              entityType: 'invoices',
              direction: 'inbound',
              recordsProcessed: invoices.length,
            };
            break;

          case 'payments':
            const payments = await this.getPayments(connectionId, {
              sinceDate: options?.sinceDate,
            });
            result = {
              success: true,
              entityType: 'payments',
              direction: 'inbound',
              recordsProcessed: payments.length,
            };
            break;

          default:
            continue;
        }

        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          entityType,
          direction: 'inbound',
          errors: [
            {
              code: 'SYNC_FAILED',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          ],
        });
      }
    }

    return results;
  }

  async getSyncHistory(_connectionId: string, _limit?: number): Promise<unknown[]> {
    // This would fetch from integration_sync_logs table
    // Implementation depends on specific requirements
    return [];
  }

  // ============================================
  // COMPANY INFO
  // ============================================

  async getCompanyInfo(connectionId: string): Promise<AccountingCompanyInfo> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(QBO_ERRORS.NOT_CONNECTED);
    }

    const config = getQuickBooksConfig();
    const companyInfo = await fetchCompanyInfo(
      tokenInfo.accessToken,
      tokenInfo.externalAccountId,
      config.environment
    );

    const info = companyInfo.CompanyInfo;

    return {
      id: info.Id,
      name: info.CompanyName,
      legalName: info.LegalName,
      address: info.CompanyAddr
        ? {
            line1: info.CompanyAddr.Line1,
            city: info.CompanyAddr.City,
            state: info.CompanyAddr.CountrySubDivisionCode,
            postalCode: info.CompanyAddr.PostalCode,
            country: info.CompanyAddr.Country,
          }
        : undefined,
      email: info.Email?.Address,
      phone: info.PrimaryPhone?.FreeFormNumber,
      fiscalYearStart: info.FiscalYearStartMonth,
    };
  }

  // ============================================
  // CUSTOMERS
  // ============================================

  async getCustomers(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number }
  ): Promise<AccountingCustomer[]> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(QBO_ERRORS.NOT_CONNECTED);
    }

    let query = `SELECT * FROM Customer`;
    if (options?.sinceDate) {
      query += ` WHERE MetaData.LastUpdatedTime >= '${options.sinceDate.toISOString()}'`;
    }
    query += ` MAXRESULTS ${options?.limit || QBO_DEFAULT_PAGE_SIZE}`;
    if (options?.offset) {
      query += ` STARTPOSITION ${options.offset + 1}`;
    }

    const response = await this.executeQuery<QuickBooksCustomer>(
      tokenInfo.accessToken,
      tokenInfo.externalAccountId,
      tokenInfo.environment,
      query
    );

    const customers = response.QueryResponse.Customer || [];

    return customers.map(this.mapQuickBooksCustomer);
  }

  async getCustomer(connectionId: string, externalId: string): Promise<AccountingCustomer | null> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(QBO_ERRORS.NOT_CONNECTED);
    }

    const url = `${getApiBaseUrl(tokenInfo.environment as QuickBooksEnvironment)}/v3/company/${tokenInfo.externalAccountId}/customer/${externalId}?minorversion=${QBO_API_MINOR_VERSION}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${tokenInfo.accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(QBO_ERRORS.API_ERROR);
    }

    const data = await response.json();
    return this.mapQuickBooksCustomer(data.Customer);
  }

  async createCustomer(
    connectionId: string,
    customer: AccountingCustomer
  ): Promise<AccountingCustomer> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(QBO_ERRORS.NOT_CONNECTED);
    }

    const qboCustomer: Partial<QuickBooksCustomer> = {
      DisplayName: customer.displayName,
      CompanyName: customer.companyName,
      PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
      PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
      BillAddr: customer.billingAddress
        ? {
            Line1: customer.billingAddress.line1,
            City: customer.billingAddress.city,
            CountrySubDivisionCode: customer.billingAddress.state,
            PostalCode: customer.billingAddress.postalCode,
            Country: customer.billingAddress.country,
          }
        : undefined,
      ShipAddr: customer.shippingAddress
        ? {
            Line1: customer.shippingAddress.line1,
            City: customer.shippingAddress.city,
            CountrySubDivisionCode: customer.shippingAddress.state,
            PostalCode: customer.shippingAddress.postalCode,
            Country: customer.shippingAddress.country,
          }
        : undefined,
    };

    const url = `${getApiBaseUrl(tokenInfo.environment as QuickBooksEnvironment)}/v3/company/${tokenInfo.externalAccountId}/customer?minorversion=${QBO_API_MINOR_VERSION}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenInfo.accessToken}`,
      },
      body: JSON.stringify(qboCustomer),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Create customer failed:', errorBody);
      throw new Error(QBO_ERRORS.API_ERROR);
    }

    const data = await response.json();
    return this.mapQuickBooksCustomer(data.Customer);
  }

  async updateCustomer(
    connectionId: string,
    externalId: string,
    customer: Partial<AccountingCustomer>
  ): Promise<AccountingCustomer> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(QBO_ERRORS.NOT_CONNECTED);
    }

    // Get current customer to get SyncToken
    const current = await this.getCustomer(connectionId, externalId);
    if (!current) {
      throw new Error('Customer not found');
    }

    const qboCustomer: Partial<QuickBooksCustomer> = {
      Id: externalId,
      SyncToken: (current.metadata as { syncToken?: string })?.syncToken,
      DisplayName: customer.displayName,
      CompanyName: customer.companyName,
      PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
      PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
    };

    const url = `${getApiBaseUrl(tokenInfo.environment as QuickBooksEnvironment)}/v3/company/${tokenInfo.externalAccountId}/customer?minorversion=${QBO_API_MINOR_VERSION}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenInfo.accessToken}`,
      },
      body: JSON.stringify(qboCustomer),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Update customer failed:', errorBody);
      throw new Error(QBO_ERRORS.API_ERROR);
    }

    const data = await response.json();
    return this.mapQuickBooksCustomer(data.Customer);
  }

  async syncCustomers(
    connectionId: string,
    customers: AccountingCustomer[]
  ): Promise<CustomerSyncResult> {
    const result: CustomerSyncResult = { created: [], updated: [], failed: [] };

    for (const customer of customers) {
      try {
        if (customer.externalId) {
          const updated = await this.updateCustomer(connectionId, customer.externalId, customer);
          result.updated.push(updated);
        } else {
          const created = await this.createCustomer(connectionId, customer);
          result.created.push(created);
        }
      } catch (error) {
        result.failed.push({
          customer,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  // ============================================
  // INVOICES
  // ============================================

  async getInvoices(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number; status?: string }
  ): Promise<AccountingInvoice[]> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(QBO_ERRORS.NOT_CONNECTED);
    }

    let query = `SELECT * FROM Invoice`;
    const conditions: string[] = [];

    if (options?.sinceDate) {
      conditions.push(`MetaData.LastUpdatedTime >= '${options.sinceDate.toISOString()}'`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` MAXRESULTS ${options?.limit || QBO_DEFAULT_PAGE_SIZE}`;
    if (options?.offset) {
      query += ` STARTPOSITION ${options.offset + 1}`;
    }

    const response = await this.executeQuery<QuickBooksInvoice>(
      tokenInfo.accessToken,
      tokenInfo.externalAccountId,
      tokenInfo.environment,
      query
    );

    const invoices = response.QueryResponse.Invoice || [];

    return invoices.map(this.mapQuickBooksInvoice);
  }

  async getInvoice(connectionId: string, externalId: string): Promise<AccountingInvoice | null> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(QBO_ERRORS.NOT_CONNECTED);
    }

    const url = `${getApiBaseUrl(tokenInfo.environment as QuickBooksEnvironment)}/v3/company/${tokenInfo.externalAccountId}/invoice/${externalId}?minorversion=${QBO_API_MINOR_VERSION}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${tokenInfo.accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(QBO_ERRORS.API_ERROR);
    }

    const data = await response.json();
    return this.mapQuickBooksInvoice(data.Invoice);
  }

  async createInvoice(
    connectionId: string,
    invoice: AccountingInvoice
  ): Promise<AccountingInvoice> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(QBO_ERRORS.NOT_CONNECTED);
    }

    const qboInvoice: Partial<QuickBooksInvoice> = {
      CustomerRef: {
        value: invoice.customerExternalId || invoice.customerId,
      },
      TxnDate: invoice.invoiceDate,
      DueDate: invoice.dueDate,
      Line: invoice.lineItems.map((item, index) => ({
        LineNum: index + 1,
        Description: item.description,
        Amount: item.amount / 100, // Convert cents to dollars
        DetailType: 'SalesItemLineDetail' as const,
        SalesItemLineDetail: item.productExternalId
          ? {
              ItemRef: { value: item.productExternalId },
              Qty: item.quantity,
              UnitPrice: item.unitPrice / 100,
            }
          : {
              Qty: item.quantity,
              UnitPrice: item.unitPrice / 100,
            },
      })),
      PrivateNote: invoice.memo,
    };

    const url = `${getApiBaseUrl(tokenInfo.environment as QuickBooksEnvironment)}/v3/company/${tokenInfo.externalAccountId}/invoice?minorversion=${QBO_API_MINOR_VERSION}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenInfo.accessToken}`,
      },
      body: JSON.stringify(qboInvoice),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Create invoice failed:', errorBody);
      throw new Error(QBO_ERRORS.API_ERROR);
    }

    const data = await response.json();
    return this.mapQuickBooksInvoice(data.Invoice);
  }

  async updateInvoice(
    _connectionId: string,
    _externalId: string,
    _invoice: Partial<AccountingInvoice>
  ): Promise<AccountingInvoice> {
    // Similar to updateCustomer - needs SyncToken
    throw new Error('Not implemented');
  }

  async syncInvoices(
    connectionId: string,
    invoices: AccountingInvoice[]
  ): Promise<InvoiceSyncResult> {
    const result: InvoiceSyncResult = { created: [], updated: [], failed: [] };

    for (const invoice of invoices) {
      try {
        if (invoice.externalId) {
          const updated = await this.updateInvoice(connectionId, invoice.externalId, invoice);
          result.updated.push(updated);
        } else {
          const created = await this.createInvoice(connectionId, invoice);
          result.created.push(created);
        }
      } catch (error) {
        result.failed.push({
          invoice,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  // ============================================
  // PAYMENTS
  // ============================================

  async getPayments(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number }
  ): Promise<AccountingPayment[]> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(QBO_ERRORS.NOT_CONNECTED);
    }

    let query = `SELECT * FROM Payment`;
    if (options?.sinceDate) {
      query += ` WHERE MetaData.LastUpdatedTime >= '${options.sinceDate.toISOString()}'`;
    }
    query += ` MAXRESULTS ${options?.limit || QBO_DEFAULT_PAGE_SIZE}`;
    if (options?.offset) {
      query += ` STARTPOSITION ${options.offset + 1}`;
    }

    const response = await this.executeQuery<QuickBooksPayment>(
      tokenInfo.accessToken,
      tokenInfo.externalAccountId,
      tokenInfo.environment,
      query
    );

    const payments = response.QueryResponse.Payment || [];

    return payments.map(this.mapQuickBooksPayment);
  }

  async getPayment(connectionId: string, externalId: string): Promise<AccountingPayment | null> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(QBO_ERRORS.NOT_CONNECTED);
    }

    const url = `${getApiBaseUrl(tokenInfo.environment as QuickBooksEnvironment)}/v3/company/${tokenInfo.externalAccountId}/payment/${externalId}?minorversion=${QBO_API_MINOR_VERSION}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${tokenInfo.accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(QBO_ERRORS.API_ERROR);
    }

    const data = await response.json();
    return this.mapQuickBooksPayment(data.Payment);
  }

  async createPayment(
    connectionId: string,
    payment: AccountingPayment
  ): Promise<AccountingPayment> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(QBO_ERRORS.NOT_CONNECTED);
    }

    const qboPayment: Partial<QuickBooksPayment> = {
      CustomerRef: {
        value: payment.customerExternalId || payment.customerId,
      },
      TotalAmt: payment.amount / 100, // Convert cents to dollars
      TxnDate: payment.paymentDate,
      PaymentRefNum: payment.referenceNumber,
      PrivateNote: payment.memo,
      Line: payment.invoiceExternalId
        ? [
            {
              Amount: payment.amount / 100,
              LinkedTxn: [
                {
                  TxnId: payment.invoiceExternalId,
                  TxnType: 'Invoice',
                },
              ],
            },
          ]
        : undefined,
    };

    const url = `${getApiBaseUrl(tokenInfo.environment as QuickBooksEnvironment)}/v3/company/${tokenInfo.externalAccountId}/payment?minorversion=${QBO_API_MINOR_VERSION}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenInfo.accessToken}`,
      },
      body: JSON.stringify(qboPayment),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Create payment failed:', errorBody);
      throw new Error(QBO_ERRORS.API_ERROR);
    }

    const data = await response.json();
    return this.mapQuickBooksPayment(data.Payment);
  }

  async syncPayments(connectionId: string): Promise<PaymentSyncResult> {
    // Pull payments from QuickBooks
    const payments = await this.getPayments(connectionId);
    return {
      created: payments,
      updated: [],
      failed: [],
    };
  }

  // ============================================
  // PRODUCTS
  // ============================================

  async getProducts(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number }
  ): Promise<AccountingProduct[]> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(QBO_ERRORS.NOT_CONNECTED);
    }

    let query = `SELECT * FROM Item`;
    if (options?.sinceDate) {
      query += ` WHERE MetaData.LastUpdatedTime >= '${options.sinceDate.toISOString()}'`;
    }
    query += ` MAXRESULTS ${options?.limit || QBO_DEFAULT_PAGE_SIZE}`;
    if (options?.offset) {
      query += ` STARTPOSITION ${options.offset + 1}`;
    }

    const response = await this.executeQuery<QuickBooksItem>(
      tokenInfo.accessToken,
      tokenInfo.externalAccountId,
      tokenInfo.environment,
      query
    );

    const items = response.QueryResponse.Item || [];

    return items.map(this.mapQuickBooksProduct);
  }

  async getProduct(connectionId: string, externalId: string): Promise<AccountingProduct | null> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(QBO_ERRORS.NOT_CONNECTED);
    }

    const url = `${getApiBaseUrl(tokenInfo.environment as QuickBooksEnvironment)}/v3/company/${tokenInfo.externalAccountId}/item/${externalId}?minorversion=${QBO_API_MINOR_VERSION}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${tokenInfo.accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(QBO_ERRORS.API_ERROR);
    }

    const data = await response.json();
    return this.mapQuickBooksProduct(data.Item);
  }

  async createProduct(
    _connectionId: string,
    _product: AccountingProduct
  ): Promise<AccountingProduct> {
    throw new Error('Not implemented');
  }

  async updateProduct(
    _connectionId: string,
    _externalId: string,
    _product: Partial<AccountingProduct>
  ): Promise<AccountingProduct> {
    throw new Error('Not implemented');
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async getConnection(connectionId: string): Promise<IntegrationConnectionRow | null> {
    const { getConnectionById } = await import('@/modules/integrations/core/repositories');
    return getConnectionById(connectionId);
  }

  private async getCurrentConnection(): Promise<IntegrationConnectionRow | null> {
    const integrationId = await this.getIntegrationId();
    return getConnectionByIntegrationId(integrationId);
  }

  private async executeQuery<T>(
    accessToken: string,
    realmId: string,
    environment: string,
    query: string
  ): Promise<QuickBooksQueryResponse<T>> {
    const url = `${getApiBaseUrl(environment as QuickBooksEnvironment)}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=${QBO_API_MINOR_VERSION}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('QuickBooks query failed:', errorBody);
      throw new Error(QBO_ERRORS.API_ERROR);
    }

    return response.json();
  }

  private mapQuickBooksCustomer(customer: QuickBooksCustomer): AccountingCustomer {
    return {
      externalId: customer.Id,
      displayName: customer.DisplayName,
      companyName: customer.CompanyName,
      email: customer.PrimaryEmailAddr?.Address,
      phone: customer.PrimaryPhone?.FreeFormNumber,
      billingAddress: customer.BillAddr
        ? {
            line1: customer.BillAddr.Line1,
            city: customer.BillAddr.City,
            state: customer.BillAddr.CountrySubDivisionCode,
            postalCode: customer.BillAddr.PostalCode,
            country: customer.BillAddr.Country,
          }
        : undefined,
      shippingAddress: customer.ShipAddr
        ? {
            line1: customer.ShipAddr.Line1,
            city: customer.ShipAddr.City,
            state: customer.ShipAddr.CountrySubDivisionCode,
            postalCode: customer.ShipAddr.PostalCode,
            country: customer.ShipAddr.Country,
          }
        : undefined,
      taxExempt: !customer.Taxable,
      balance: customer.Balance ? Math.round(customer.Balance * 100) : undefined,
      metadata: {
        syncToken: customer.SyncToken,
        active: customer.Active,
      },
    };
  }

  private mapQuickBooksInvoice(invoice: QuickBooksInvoice): AccountingInvoice {
    return {
      externalId: invoice.Id,
      invoiceNumber: invoice.DocNumber,
      customerId: invoice.CustomerRef.value,
      customerExternalId: invoice.CustomerRef.value,
      invoiceDate: invoice.TxnDate || new Date().toISOString().split('T')[0],
      dueDate: invoice.DueDate,
      lineItems: invoice.Line.filter((l) => l.DetailType === 'SalesItemLineDetail').map(
        (line) => ({
          description: line.Description || '',
          quantity: line.SalesItemLineDetail?.Qty || 1,
          unitPrice: Math.round((line.SalesItemLineDetail?.UnitPrice || 0) * 100),
          amount: Math.round(line.Amount * 100),
          productExternalId: line.SalesItemLineDetail?.ItemRef?.value,
        })
      ),
      subtotal: Math.round((invoice.TotalAmt || 0) * 100),
      taxTotal: 0, // Would need to calculate from tax lines
      total: Math.round((invoice.TotalAmt || 0) * 100),
      memo: invoice.PrivateNote,
      metadata: {
        syncToken: invoice.SyncToken,
        balance: invoice.Balance,
      },
    };
  }

  private mapQuickBooksPayment(payment: QuickBooksPayment): AccountingPayment {
    const linkedInvoice = payment.Line?.[0]?.LinkedTxn?.find((t) => t.TxnType === 'Invoice');

    return {
      externalId: payment.Id,
      customerId: payment.CustomerRef.value,
      customerExternalId: payment.CustomerRef.value,
      invoiceExternalId: linkedInvoice?.TxnId,
      paymentDate: payment.TxnDate || new Date().toISOString().split('T')[0],
      amount: Math.round(payment.TotalAmt * 100),
      paymentMethod: payment.PaymentMethodRef?.name,
      referenceNumber: payment.PaymentRefNum,
      memo: payment.PrivateNote,
      metadata: {
        syncToken: payment.SyncToken,
      },
    };
  }

  private mapQuickBooksProduct(item: QuickBooksItem): AccountingProduct {
    return {
      externalId: item.Id,
      name: item.Name,
      sku: item.Sku,
      description: item.Description,
      unitPrice: item.UnitPrice ? Math.round(item.UnitPrice * 100) : undefined,
      type:
        item.Type === 'Inventory'
          ? 'inventory'
          : item.Type === 'Service'
            ? 'service'
            : 'non_inventory',
      active: item.Active,
      metadata: {
        syncToken: item.SyncToken,
        qtyOnHand: item.QtyOnHand,
      },
    };
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const quickBooksProvider = new QuickBooksProvider();
