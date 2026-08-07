'use client';

/**
 * ExtractPOFromEmailDialog Component
 *
 * Dialog for extracting PO data from email attachment PDF.
 * Fetches PDF from storage, converts to images, and extracts data using AI.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Package,
  User,
  FileCheck,
  Pencil,
} from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Separator } from '@/shared/components/ui/separator';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import { convertPdfToImages } from '@/features/quotes/lib/pdf-to-images';
import type { ProcessedPOData } from '@/features/quotes/types/po-extract.types';
import type { InboundEmailAttachment } from '../types';
import {
  findOrCreateCustomerFromPO,
  findOrCreateProductFromPO,
  createQuoteFromData,
} from '@/features/quotes/actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

// ============================================
// TYPES
// ============================================

type DialogState = 'idle' | 'fetching' | 'extracting' | 'reviewing' | 'creating' | 'error';

interface ExtractPOFromEmailDialogProps {
  open: boolean;
  attachment: InboundEmailAttachment | null;
  attachmentUrl: string | null;
  onClose: () => void;
  onSuccess?: (data: ProcessedPOData) => void;
}

// ============================================
// COMPONENT
// ============================================

export function ExtractPOFromEmailDialog({
  open,
  attachment,
  attachmentUrl,
  onClose,
  onSuccess,
}: ExtractPOFromEmailDialogProps) {
  const router = useRouter();
  const [dialogState, setDialogState] = useState<DialogState>('idle');
  const [extractedData, setExtractedData] = useState<ProcessedPOData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields state
  const [editPoNumber, setEditPoNumber] = useState('');
  const [editPoDate, setEditPoDate] = useState('');
  const [editShipToName, setEditShipToName] = useState('');
  const [editShipToAddress, setEditShipToAddress] = useState('');
  const [editShipToCity, setEditShipToCity] = useState('');
  const [editShipToState, setEditShipToState] = useState('');
  const [editShipToZip, setEditShipToZip] = useState('');
  const [editLineItems, setEditLineItems] = useState<Array<{
    quantity: number;
    unitPrice: number;
    baseCost: number | null;
  }>>([]);

  // Initialize editable fields when extraction completes
  useEffect(() => {
    if (extractedData && dialogState === 'reviewing') {
      setEditPoNumber(extractedData.extraction.poNumber || '');
      setEditPoDate(extractedData.extraction.poDate || '');
      setEditShipToName(extractedData.extraction.shipTo?.name || '');
      setEditShipToAddress(extractedData.extraction.shipTo?.address || '');
      setEditShipToCity(extractedData.extraction.shipTo?.city || '');
      setEditShipToState(extractedData.extraction.shipTo?.state || '');
      setEditShipToZip(extractedData.extraction.shipTo?.zip || '');
      setEditLineItems(
        extractedData.products.map((p) => ({
          quantity: p.quantity,
          unitPrice: p.extractedUnitPrice,
          baseCost: p.matched ? (p.baseCost ?? null) : null,
        }))
      );
    }
  }, [extractedData, dialogState]);

  // Start extraction when dialog opens
  const startExtraction = useCallback(async () => {
    if (!attachmentUrl || !attachment) {
      setError('No attachment URL provided');
      return;
    }

    setDialogState('fetching');
    setError(null);
    setProgress('Fetching PDF from storage...');

    try {
      // Step 1: Fetch PDF from storage URL
      const response = await fetch(attachmentUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch PDF from storage');
      }

      const pdfBlob = await response.blob();
      const pdfFile = new File([pdfBlob], attachment.filename, { type: 'application/pdf' });

      setDialogState('extracting');
      setProgress('Converting PDF to images...');

      // Step 2: Convert PDF to images
      const conversionResult = await convertPdfToImages(pdfFile);

      if (!conversionResult.success) {
        throw new Error(conversionResult.error || 'Failed to convert PDF');
      }

      if (conversionResult.images.length === 0) {
        throw new Error('No pages could be extracted from the PDF');
      }

      setProgress(
        `Extracted ${conversionResult.processedPages} of ${conversionResult.pageCount} pages. Sending to AI for analysis...`
      );

      // Step 3: Send images to extraction API
      const extractResponse = await fetch('/api/po/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: conversionResult.images,
        }),
      });

      const result = await extractResponse.json();

      if (!extractResponse.ok || !result.success) {
        let errorMessage = 'Extraction failed';

        if (result.error) {
          const errorStr = typeof result.error === 'string'
            ? result.error
            : result.error.message || JSON.stringify(result.error);

          if (errorStr.includes('OPENAI_API_KEY not configured')) {
            errorMessage = 'AI service not configured. Please contact administrator.';
          } else if (errorStr.includes('invalid') || errorStr.includes('authentication')) {
            errorMessage = 'AI service authentication failed. Please contact administrator.';
          } else if (errorStr.includes('rate_limit')) {
            errorMessage = 'AI service rate limit reached. Please try again later.';
          } else {
            errorMessage = errorStr;
          }
        }

        throw new Error(errorMessage);
      }

      // Step 4: Show extracted data for review
      setExtractedData(result.data);
      setDialogState('reviewing');
      setProgress('');
    } catch (err) {
      console.error('Extraction error:', err);
      setError(err instanceof Error ? err.message : 'Failed to extract PO data');
      setDialogState('error');
      setProgress('');
    }
  }, [attachmentUrl, attachment]);

  // Auto-start extraction when dialog opens
  useEffect(() => {
    if (open && attachmentUrl && attachment && dialogState === 'idle') {
      startExtraction();
    }
  }, [open, attachmentUrl, attachment, dialogState, startExtraction]);

  // Handle create quote - directly creates the quote
  const handleCreateQuote = async () => {
    if (!extractedData) {
      return;
    }

    setDialogState('creating');
    setError(null);

    try {
      // Apply edited values to extracted data
      const updatedProducts = extractedData.products.map((product, index) => ({
        ...product,
        quantity: editLineItems[index]?.quantity ?? product.quantity,
        extractedUnitPrice: editLineItems[index]?.unitPrice ?? product.extractedUnitPrice,
        baseCost: editLineItems[index]?.baseCost ?? product.baseCost ?? null,
      }));

      const data: ProcessedPOData = {
        ...extractedData,
        extraction: {
          ...extractedData.extraction,
          poNumber: editPoNumber || extractedData.extraction.poNumber,
          poDate: editPoDate || extractedData.extraction.poDate,
          shipTo: {
            ...extractedData.extraction.shipTo,
            name: editShipToName || extractedData.extraction.shipTo?.name || null,
            address: editShipToAddress || extractedData.extraction.shipTo?.address || null,
            city: editShipToCity || extractedData.extraction.shipTo?.city || null,
            state: editShipToState || extractedData.extraction.shipTo?.state || null,
            zip: editShipToZip || extractedData.extraction.shipTo?.zip || null,
          },
        },
        products: updatedProducts,
      };

      // Step 1: Find or create customer
      let customerId = data.customer.customerId;
      let customerCreated = false;

      if (!data.customer.matched || !customerId) {
        const customerName = data.extraction.customer?.name;
        if (!customerName) {
          toast.error('No customer name found in PO');
          setDialogState('reviewing');
          return;
        }

        const customerResult = await findOrCreateCustomerFromPO(
          customerName,
          data.extraction.customer?.address,
          data.extraction.customer?.city,
          data.extraction.customer?.state,
          data.extraction.customer?.zip
        );

        if (!customerResult.success || !customerResult.data) {
          toast.error(customerResult.error || 'Failed to find or create customer');
          setDialogState('reviewing');
          return;
        }

        customerId = customerResult.data.customerId;
        customerCreated = customerResult.data.created;

        if (customerCreated) {
          toast.info(`New customer "${customerResult.data.customerName}" created`);
        }
      }

      // Step 2: Process ALL products
      const quoteItems: Array<{
        productId: string;
        sku: string;
        description: string | null;
        quantity: number;
        unitCode: string;
        unitPrice: number;
        discountPercent: number;
        taxRate: number;
      }> = [];

      let productsCreated = 0;

      for (const product of data.products) {
        if (product.matched && product.productId) {
          quoteItems.push({
            productId: product.productId,
            sku: product.sku,
            description: product.description || null,
            quantity: product.quantity,
            unitCode: 'EA',
            unitPrice: product.unitPrice || Math.round(product.extractedUnitPrice * 100),
            discountPercent: 0,
            taxRate: 0,
          });
        } else {
          const extractedItem = data.extraction.lineItems.find(
            (item) => item.description === product.description
          );

          const productResult = await findOrCreateProductFromPO(
            product.sku || null,
            product.description,
            extractedItem?.tireSize || extractedItem?.vendorItemNo || null,
            product.extractedUnitPrice,
            product.baseCost ?? null
          );

          if (productResult.success && productResult.data) {
            quoteItems.push({
              productId: productResult.data.productId,
              sku: productResult.data.sku,
              description: product.description || null,
              quantity: product.quantity,
              unitCode: 'EA',
              unitPrice: productResult.data.unitPrice,
              discountPercent: 0,
              taxRate: 0,
            });

            if (productResult.data.created) {
              productsCreated++;
            }
          } else {
            toast.error(`Failed to process product ${product.sku}`);
          }
        }
      }

      if (quoteItems.length === 0) {
        toast.error('No products could be processed');
        setDialogState('reviewing');
        return;
      }

      if (productsCreated > 0) {
        toast.info(`${productsCreated} new product(s) created`);
      }

      // Step 3: Create quote
      const quoteData = {
        quoteDate: data.extraction.poDate ? new Date(data.extraction.poDate) : new Date(),
        validUntil: null,
        customerId,
        salesRepId: null,
        currencyCode: 'USD',
        status: 'draft' as const,
        billingAddress: {
          street: data.extraction.customer?.address || null,
          city: data.extraction.customer?.city || null,
          state: data.extraction.customer?.state || null,
          postalCode: data.extraction.customer?.zip || null,
          country: 'US',
        },
        shippingAddress: {
          street: data.extraction.shipTo?.address || null,
          city: data.extraction.shipTo?.city || null,
          state: data.extraction.shipTo?.state || null,
          postalCode: data.extraction.shipTo?.zip || null,
          country: 'US',
        },
        items: quoteItems,
        customerNotes: data.extraction.poNumber ? `PO Reference: ${data.extraction.poNumber}` : null,
        internalNotes: `Created from email PO. Extraction confidence: ${data.extraction.confidence}%`,
        termsAndConditions: null,
        poDocumentUrl: attachmentUrl,
      };

      const result = await createQuoteFromData(quoteData);

      if (result.success && result.data) {
        toast.success('Quote created successfully');
        onSuccess?.(data);
        handleClose();
        // Navigate to quotes page
        router.push('/quotes');
      } else {
        toast.error(result.error || 'Failed to create quote');
        setDialogState('reviewing');
      }
    } catch (err) {
      console.error('Create quote error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create quote');
      setDialogState('error');
    }
  };

  // Handle close
  const handleClose = () => {
    setDialogState('idle');
    setExtractedData(null);
    setError(null);
    setProgress('');
    setIsEditing(false);
    setEditLineItems([]);
    onClose();
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Get confidence badge
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) {
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {confidence}% confidence
        </Badge>
      );
    } else if (confidence >= 50) {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {confidence}% confidence
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
        <AlertCircle className="w-3 h-3 mr-1" />
        {confidence}% confidence
      </Badge>
    );
  };

  const dialogWidth = dialogState === 'reviewing' ? 'sm:max-w-[800px]' : 'sm:max-w-[500px]';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`transition-all duration-300 ${dialogWidth}`}>
        <DialogHeader>
          <DialogTitle>
            {dialogState === 'reviewing' ? 'Review Extracted Data' : 'Extract PO from Email'}
          </DialogTitle>
          <DialogDescription>
            {dialogState === 'reviewing'
              ? 'Review the extracted data and create a quote.'
              : attachment
                ? `Extracting data from: ${attachment.filename}`
                : 'Processing attachment...'}
          </DialogDescription>
        </DialogHeader>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Progress Message */}
        {progress && (dialogState === 'fetching' || dialogState === 'extracting') && (
          <div className="flex items-center gap-2 p-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg">
            <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
            {progress}
          </div>
        )}

        <div className="space-y-4 py-4">
          {/* Loading state */}
          {(dialogState === 'fetching' || dialogState === 'extracting') && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                <FileText className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <div className="text-center">
                <p className="font-medium">Processing PDF</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {dialogState === 'fetching' ? 'Downloading file...' : 'Extracting data with AI...'}
                </p>
              </div>
            </div>
          )}

          {/* Extracted data review */}
          {dialogState === 'reviewing' && extractedData && (
            <div className="space-y-4 w-full">
              {/* Extraction Summary */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold">Extraction Results</h3>
                  {getConfidenceBadge(extractedData.extraction.confidence)}
                </div>
                <Button
                  variant={isEditing ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  {isEditing ? 'Done Editing' : 'Edit'}
                </Button>
              </div>

              <ScrollArea className="h-[500px] rounded-lg border">
                <div className="p-4 space-y-4">
                  {/* PO Info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileCheck className="w-4 h-4 text-muted-foreground" />
                      PO Information
                    </div>
                    {isEditing ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">PO Number</Label>
                          <Input
                            value={editPoNumber}
                            onChange={(e) => setEditPoNumber(e.target.value)}
                            placeholder="PO Number"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Date</Label>
                          <Input
                            type="date"
                            value={editPoDate}
                            onChange={(e) => setEditPoDate(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">PO Number:</span>
                          <span className="ml-2 font-medium">
                            {editPoNumber || 'Not found'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Date:</span>
                          <span className="ml-2 font-medium">
                            {editPoDate || 'Not found'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Customer */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <User className="w-4 h-4 text-muted-foreground" />
                      Customer
                    </div>
                    <div className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {extractedData.customer.name || 'Unknown'}
                        </span>
                        {extractedData.customer.matched ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200"
                          >
                            Matched
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200"
                          >
                            Will Create
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ship To */}
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      Ship To
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={editShipToName}
                            onChange={(e) => setEditShipToName(e.target.value)}
                            placeholder="Recipient Name"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Address</Label>
                          <Input
                            value={editShipToAddress}
                            onChange={(e) => setEditShipToAddress(e.target.value)}
                            placeholder="Street Address"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">City</Label>
                            <Input
                              value={editShipToCity}
                              onChange={(e) => setEditShipToCity(e.target.value)}
                              placeholder="City"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">State</Label>
                            <Input
                              value={editShipToState}
                              onChange={(e) => setEditShipToState(e.target.value)}
                              placeholder="State"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">ZIP</Label>
                            <Input
                              value={editShipToZip}
                              onChange={(e) => setEditShipToZip(e.target.value)}
                              placeholder="ZIP"
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        <p>{editShipToName || 'Not specified'}</p>
                        {editShipToAddress && <p>{editShipToAddress}</p>}
                        {(editShipToCity || editShipToState || editShipToZip) && (
                          <p>
                            {[editShipToCity, editShipToState, editShipToZip]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Line Items */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        Line Items ({extractedData.products.length})
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="text-emerald-600">{extractedData.matchedCount} matched</span>
                        {extractedData.unmatchedCount > 0 && (
                          <>
                            {' / '}
                            <span className="text-amber-600">
                              {extractedData.unmatchedCount} will create
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {extractedData.products.map((product, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border ${
                            product.matched ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">
                                  {product.sku || 'No SKU'}
                                </span>
                                {product.matched ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                ) : (
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {product.description}
                              </p>
                            </div>
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <div className="space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">Qty</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={editLineItems[index]?.quantity ?? product.quantity}
                                    onChange={(e) => {
                                      const newItems = [...editLineItems];
                                      newItems[index] = {
                                        quantity: parseInt(e.target.value) || 1,
                                        unitPrice: newItems[index]?.unitPrice ?? product.extractedUnitPrice,
                                        baseCost: newItems[index]?.baseCost ?? null,
                                      };
                                      setEditLineItems(newItems);
                                    }}
                                    className="h-7 w-16 text-sm text-right"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">Cost</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Cost"
                                    value={editLineItems[index]?.baseCost ?? ''}
                                    onChange={(e) => {
                                      const newItems = [...editLineItems];
                                      const value = e.target.value;
                                      newItems[index] = {
                                        quantity: newItems[index]?.quantity ?? product.quantity,
                                        unitPrice: newItems[index]?.unitPrice ?? product.extractedUnitPrice,
                                        baseCost: value === '' ? null : parseFloat(value) || 0,
                                      };
                                      setEditLineItems(newItems);
                                    }}
                                    className="h-7 w-20 text-sm text-right"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">Price</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editLineItems[index]?.unitPrice ?? product.extractedUnitPrice}
                                    onChange={(e) => {
                                      const newItems = [...editLineItems];
                                      newItems[index] = {
                                        quantity: newItems[index]?.quantity ?? product.quantity,
                                        unitPrice: parseFloat(e.target.value) || 0,
                                        baseCost: newItems[index]?.baseCost ?? null,
                                      };
                                      setEditLineItems(newItems);
                                    }}
                                    className="h-7 w-20 text-sm text-right"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="text-right text-sm">
                                <div>Qty: {editLineItems[index]?.quantity ?? product.quantity}</div>
                                {editLineItems[index]?.baseCost !== null && editLineItems[index]?.baseCost !== undefined && (
                                  <div className="text-muted-foreground text-xs">
                                    Cost: {formatCurrency(editLineItems[index]?.baseCost ?? 0)}
                                  </div>
                                )}
                                <div className="text-muted-foreground">
                                  Price: {formatCurrency(editLineItems[index]?.unitPrice ?? product.extractedUnitPrice)}
                                </div>
                              </div>
                            )}
                          </div>
                          {!product.matched && editLineItems[index]?.baseCost === null && (
                            <div className="text-xs text-amber-600 mt-1">
                              Cost not set - click Edit to add
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={dialogState === 'fetching' || dialogState === 'extracting' || dialogState === 'creating'}
          >
            Cancel
          </Button>

          {dialogState === 'error' && (
            <Button onClick={startExtraction}>
              <AlertCircle className="mr-2 h-4 w-4" />
              Retry
            </Button>
          )}

          {dialogState === 'reviewing' && (
            <Button onClick={handleCreateQuote}>
              <FileCheck className="mr-2 h-4 w-4" />
              Create Quote
            </Button>
          )}

          {dialogState === 'creating' && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
