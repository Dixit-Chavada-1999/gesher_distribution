/**
 * Quotes Feature Module
 *
 * Public API for the Quotes feature.
 * Only export what should be accessible from outside this feature.
 */

// Types
export type {
  Quote,
  QuoteItem,
  QuoteWithItems,
  QuoteListItem,
  QuoteListParams,
  QuoteStatus,
  CreateQuoteDTO,
  UpdateQuoteDTO,
  CreateQuoteItemDTO,
  QuoteMasterData,
  QuotesTableProps,
} from './types';

export {
  QUOTE_STATUSES,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  QUOTE_STATUS_TRANSITIONS,
} from './types';

// Components
export { QuotesTable, ViewQuoteDrawer, CreateQuoteDrawer, EditQuoteDrawer, QuoteForm, ApproveQuoteDialog } from './components';

// Hooks
export { useQuotes, useQuote, useQuoteStatusCounts } from './hooks';

// Actions
export {
  getQuotes,
  getQuote,
  getQuoteByNumber,
  createQuote,
  createQuoteFromData,
  updateQuote,
  updateQuoteFromData,
  updateQuoteItems,
  deleteQuote,
  submitQuoteForApproval,
  approveQuote,
  rejectQuoteApproval,
  expireQuote,
  convertQuoteToSalesOrder,
  getQuoteStatusCounts,
  getNextQuoteNumber,
  getQuoteMasterData,
} from './actions';

// Services (for internal use by other features)
export { quoteService } from './services';
