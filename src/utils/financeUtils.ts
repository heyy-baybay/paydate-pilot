import { RawTransaction, Transaction, TransactionCategory, PayPeriod, MonthSummary } from '@/types/finance';

// Parse M/D/YY or MM/DD/YYYY format to YYYY-MM-DD
export function parseDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  
  let month = parts[0].padStart(2, '0');
  let day = parts[1].padStart(2, '0');
  let year = parts[2];
  
  // Handle 2-digit year
  if (year.length === 2) {
    const currentCentury = Math.floor(new Date().getFullYear() / 100) * 100;
    year = String(currentCentury + parseInt(year));
  }
  
  return `${year}-${month}-${day}`;
}

// Format date for display
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

// Category detection based on description - aligned with QuickBooks
const categoryPatterns: Record<TransactionCategory, RegExp[]> = {
  'Gas': [/valero/i, /shell/i, /exxon/i, /chevron/i, /fuel/i, /gas/i, /pilot/i, /ta\s/i, /loves/i, /petro/i, /fuel maxx/i],
  'Travel': [/hotel/i, /airline/i, /southwest/i, /delta/i, /united/i, /marriott/i, /hilton/i, /uber/i, /lyft/i, /travel/i],
  'Legal & Accounting': [/legalzoom/i, /attorney/i, /lawyer/i, /accountant/i, /cpa/i, /legal/i],
  'Office Supplies': [/office depot/i, /staples/i, /customink/i, /office supplies/i],
  'Software': [/github/i, /adobe/i, /microsoft/i, /zoom/i, /slack/i, /aws/i, /heroku/i, /front\.com/i, /cargado/i, /dun.*bradstreet/i, /software/i],
  'Repairs & Maintenance': [/repair/i, /maintenance/i, /maid sense/i, /mechanic/i, /service/i],
  'Postage': [/usps/i, /ups/i, /fedex/i, /postal/i, /postage/i, /shipping/i],
  'Taxes & Registration': [/revenue.*department/i, /irs/i, /tax/i, /state.*tax/i, /registration/i, /bonfire/i],
  'Insurance': [/insurance/i, /geico/i, /allstate/i, /progressive/i, /state farm/i, /hendersh/i],
  'Subscriptions': [/spotify/i, /netflix/i, /hulu/i, /apple/i, /google.*storage/i, /dialpad/i, /cloudflare/i, /squarespace/i, /sqsp/i, /lovable/i, /audible/i],
  'Sales': [/invoice/i, /payment.*received/i, /margin freight/i],
  "Owner's Contribution": [/owner.*contribution/i, /capital.*contribution/i],
  "Owner's Distribution": [/owner.*distribution/i, /draw/i, /personal/i],
  'Transfers': [/transfer/i, /xfer/i, /acct_xfer/i, /zelle/i, /venmo/i, /paypal/i, /payment thank you/i, /credit card payment/i],
  'Fees': [/fee/i, /charge/i, /overdraft/i, /nsf/i, /service charge/i],
  'Miscellaneous': [],
};

export function categorizeTransaction(description: string, type: string, amount: number, qbCategory?: string): TransactionCategory {
  // If we have a QuickBooks category (Account full name), map to simplified category
  if (qbCategory) {
    const qbLower = qbCategory.toLowerCase();
    
    // Gas / Fuel
    if (qbLower.includes('gas') || qbLower.includes('fuel') || qbLower.includes('diesel')) return 'Gas';
    
    // Travel
    if (qbLower.includes('travel') || qbLower.includes('lodging') || qbLower.includes('hotel') || qbLower.includes('meals')) return 'Travel';
    
    // Legal & Accounting
    if (qbLower.includes('legal') || qbLower.includes('accounting') || qbLower.includes('professional') || qbLower.includes('attorney')) return 'Legal & Accounting';
    
    // Office Supplies
    if (qbLower.includes('office') || qbLower.includes('supplies') || qbLower.includes('equipment')) return 'Office Supplies';
    
    // Software / Technology
    if (qbLower.includes('software') || qbLower.includes('computer') || qbLower.includes('technology') || qbLower.includes('internet')) return 'Software';
    
    // Repairs & Maintenance
    if (qbLower.includes('repair') || qbLower.includes('maintenance') || qbLower.includes('truck') || qbLower.includes('vehicle')) return 'Repairs & Maintenance';
    
    // Postage / Shipping
    if (qbLower.includes('postage') || qbLower.includes('shipping') || qbLower.includes('freight') || qbLower.includes('delivery')) return 'Postage';
    
    // Taxes & Registration
    if (qbLower.includes('tax') || qbLower.includes('license') || qbLower.includes('registration') || qbLower.includes('permit')) return 'Taxes & Registration';
    
    // Insurance
    if (qbLower.includes('insurance') || qbLower.includes('liability') || qbLower.includes('cargo')) return 'Insurance';
    
    // Subscriptions
    if (qbLower.includes('subscription') || qbLower.includes('dues') || qbLower.includes('membership')) return 'Subscriptions';
    
    // Sales / Income
    if (qbLower.includes('sales') || qbLower.includes('income') || qbLower.includes('revenue') || qbLower.includes('accounts receivable')) return 'Sales';
    
    // Owner's Contribution
    if (qbLower.includes('owner\'s contribution') || qbLower.includes('capital contribution') || qbLower.includes('owner contribution')) return "Owner's Contribution";
    
    // Owner's Distribution / Draw
    if (qbLower.includes('owner\'s distribution') || qbLower.includes('draw') || qbLower.includes('distribution') || qbLower.includes('shareholder')) return "Owner's Distribution";
    
    // Transfers
    if (qbLower.includes('transfer') || qbLower.includes('due from') || qbLower.includes('due to') || qbLower.includes('checking') || qbLower.includes('savings')) return 'Transfers';
    
    // Bank Fees
    if (qbLower.includes('fee') || qbLower.includes('bank charge') || qbLower.includes('service charge')) return 'Fees';
  }
  
  const cleanDesc = description.toLowerCase();
  
  // Check if it's income first (positive amounts)
  if (amount > 0 || type.toLowerCase().includes('credit')) {
    for (const pattern of categoryPatterns['Sales']) {
      if (pattern.test(cleanDesc)) return 'Sales';
    }
    if (type.toLowerCase().includes('credit') || type.toLowerCase().includes('ach_credit') || type.toLowerCase().includes('deposit')) {
      return 'Sales';
    }
  }
  
  // Check transfers
  if (type.toLowerCase().includes('xfer') || type.toLowerCase().includes('transfer')) {
    return 'Transfers';
  }
  
  // Check other categories
  for (const [category, patterns] of Object.entries(categoryPatterns)) {
    if (category === 'Sales' || category === 'Miscellaneous') continue;
    for (const pattern of patterns) {
      if (pattern.test(cleanDesc)) return category as TransactionCategory;
    }
  }
  
  return 'Miscellaneous';
}

/**
 * Normalize vendor name for grouping:
 * - Uppercase
 * - Strip digits, phone numbers, extra punctuation
 * - Remove common noise tokens (SQ*, PAYPAL*, VENMO*, etc.)
 * - Collapse whitespace
 */
export function normalizeVendor(description: string): string {
  let cleaned = description.toUpperCase();
  
  // Remove common payment processor prefixes
  const noisePatterns = [
    /^SQ\s*\*?/i,
    /^PAYPAL\s*\*?/i,
    /^VENMO\s*\*?/i,
    /^APPLE\.COM\/BILL/i,
    /^APPLE\s*PAY\s*/i,
    /^GOOGLE\s*\*?/i,
    /^AMZN\s*MKTP\s*/i,
    /^AMAZON\s*/i,
    /^TST\s*\*?/i,          // Toast payments
    /^POS\s+(PURCHASE\s+)?/i,
    /^PURCHASE\s+/i,
    /^DEBIT\s+(CARD\s+)?/i,
    /^RECURRING\s+/i,
    /^ONLINE\s+(PAYMENT\s+)?/i,
    /^ACH\s+(DEBIT\s+)?/i,
    /^CHECKCARD\s+/i,
    /^VISA\s+/i,
    /^MASTERCARD\s+/i,
  ];
  
  for (const pattern of noisePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Remove transaction IDs, dates, phone numbers, long digit sequences
  cleaned = cleaned
    .replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, '')      // dates MM/DD or MM/DD/YY
    .replace(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g, '') // phone numbers
    .replace(/\d{6,}/g, '')                         // long digit sequences (6+)
    .replace(/#\d+/g, '')                           // reference numbers
    .replace(/TRANSACTION#?:?\s*\d*/gi, '')
    .replace(/\*+/g, ' ')                           // asterisks to space
    .replace(/[^\w\s&'-]/g, ' ')                    // remove most punctuation
    .replace(/\s+/g, ' ')                           // collapse whitespace
    .trim();
  
  // Take first 3 meaningful words (vendor core name)
  const words = cleaned.split(' ').filter(w => w.length > 1).slice(0, 3);
  return words.join(' ') || cleaned || description.toUpperCase();
}

/**
 * Detect recurring transactions based on:
 * 1. Same normalized vendor appearing 2+ times
 * 2. Cadence analysis: monthly (~25-35 days), biweekly (~12-16 days), weekly (~6-8 days)
 * 3. Similar amounts (within 20% or $15, whichever is greater)
 */
export function detectRecurring(transactions: Transaction[]): Map<string, boolean> {
  const recurringMap = new Map<string, boolean>();
  
  // Group transactions by normalized vendor
  const vendorTransactions = new Map<string, Transaction[]>();
  transactions.forEach(tx => {
    // Only consider expenses
    if (tx.amount >= 0) {
      recurringMap.set(tx.id, false);
      return;
    }
    
    const vendor = normalizeVendor(tx.description);
    const existing = vendorTransactions.get(vendor) || [];
    existing.push(tx);
    vendorTransactions.set(vendor, existing);
  });
  
  // Analyze each vendor's transactions for recurring patterns
  vendorTransactions.forEach((txs, vendor) => {
    // Need at least 2 transactions
    if (txs.length < 2) {
      txs.forEach(tx => recurringMap.set(tx.id, false));
      return;
    }
    
    // Sort by date
    const sorted = [...txs].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Calculate intervals between consecutive transactions
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const daysDiff = Math.round(
        (new Date(sorted[i].date).getTime() - new Date(sorted[i-1].date).getTime()) 
        / (1000 * 60 * 60 * 24)
      );
      intervals.push(daysDiff);
    }
    
    // Check if amounts are similar (within 20% or $15)
    const amounts = txs.map(t => Math.abs(t.amount));
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const tolerance = Math.max(avgAmount * 0.2, 15);
    const amountsSimilar = amounts.every(a => Math.abs(a - avgAmount) <= tolerance);
    
    if (!amountsSimilar) {
      txs.forEach(tx => recurringMap.set(tx.id, false));
      return;
    }
    
    // Check cadence patterns
    const isRecurring = checkCadencePattern(intervals);
    
    txs.forEach(tx => recurringMap.set(tx.id, isRecurring));
  });
  
  return recurringMap;
}

/**
 * Check if intervals match common recurring patterns:
 * - Monthly: median interval 25-35 days
 * - Biweekly: median interval 12-16 days
 * - Weekly: median interval 6-8 days
 * - Annual: interval ~350-380 days
 */
function checkCadencePattern(intervals: number[]): boolean {
  if (intervals.length === 0) return false;
  
  // Calculate median interval
  const sorted = [...intervals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 
    ? sorted[mid] 
    : (sorted[mid - 1] + sorted[mid]) / 2;
  
  // Check against known patterns
  const patterns = [
    { name: 'weekly', min: 5, max: 9 },
    { name: 'biweekly', min: 12, max: 16 },
    { name: 'monthly', min: 25, max: 35 },
    { name: 'bimonthly', min: 55, max: 65 },
    { name: 'quarterly', min: 85, max: 100 },
    { name: 'annual', min: 350, max: 380 },
  ];
  
  for (const pattern of patterns) {
    if (median >= pattern.min && median <= pattern.max) {
      return true;
    }
  }
  
  // Also check if most intervals are within 20% of median (flexible recurring)
  const withinTolerance = intervals.filter(i => 
    Math.abs(i - median) <= median * 0.25
  );
  
  return withinTolerance.length >= intervals.length * 0.7;
}

// Exported so UI components can group transactions consistently.
// Now uses the improved normalizeVendor function.
export function extractVendorName(description: string): string {
  const raw = (description || '').trim();
  if (!raw) return '';

  // ACH-style details often contain explicit fields we can reliably parse.
  // Example:
  // "ORIG CO NAME:Sana Benefits ORIG ID:... DESC DATE:... ACH DEBIT ..."
  const text = raw;
  const candidates: string[] = [];

  const tryBetween = (start: RegExp, end: RegExp) => {
    const startMatch = start.exec(text);
    if (!startMatch || startMatch.index == null) return;
    const afterStart = text.slice(startMatch.index + startMatch[0].length);
    const endMatch = end.exec(afterStart);
    const picked = (endMatch ? afterStart.slice(0, endMatch.index) : afterStart).trim();
    if (picked) candidates.push(picked);
  };

  // Most common ACH formats
  tryBetween(/ORIG\s+CO\s+NAME\s*:/i, /\s+ORIG\s+ID\s*:/i);
  tryBetween(/ORIGINATOR\s+NAME\s*:/i, /\s+(ORIGINATOR\s+ID|ORIG\s+ID)\s*:/i);
  tryBetween(/COMPANY\s+NAME\s*:/i, /\s+(COMPANY\s+ID|ORIG\s+ID)\s*:/i);

  // Fallback: some exports include an IND/INDIVIDUAL name and a company name; prefer company.
  // If we can’t parse a field cleanly, we’ll just normalize the full description.
  const best = candidates
    .map((c) => c.replace(/\s+/g, ' ').trim())
    .find((c) => c.length >= 2);

  return normalizeVendor(best || text);
}

// Calculate pay periods using business day logic
import { getNthBusinessDayAfter, getLastDayOfMonth } from './businessDays';

export function getPayPeriods(year: number, month: number): PayPeriod[] {
  const periods: PayPeriod[] = [];
  
  // First cutoff: 15th of month
  const firstCutoff = new Date(year, month, 15);
  const firstCalc = getNthBusinessDayAfter(firstCutoff, 1);
  const firstPayment = getNthBusinessDayAfter(firstCutoff, 4);
  
  periods.push({
    cutoffDate: firstCutoff,
    calculationDate: firstCalc,
    paymentDate: firstPayment,
  });
  
  // Second cutoff: Last day of month
  const lastDay = getLastDayOfMonth(year, month);
  const secondCalc = getNthBusinessDayAfter(lastDay, 1);
  const secondPayment = getNthBusinessDayAfter(lastDay, 4);
  
  periods.push({
    cutoffDate: lastDay,
    calculationDate: secondCalc,
    paymentDate: secondPayment,
  });
  
  return periods;
}

// Determine if transaction impacts pay period cash flow
export function determinePayPeriodImpact(dateStr: string): boolean {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  const periods = getPayPeriods(year, month);
  
  // Check if transaction falls between payment arrival and next cutoff
  for (let i = 0; i < periods.length; i++) {
    const paymentDate = periods[i].paymentDate;
    const nextCutoff = i < periods.length - 1 
      ? periods[i + 1].cutoffDate 
      : new Date(year, month + 1, 15); // Next month's first cutoff
    
    if (date >= paymentDate && date < nextCutoff) {
      return true;
    }
  }
  
  return false;
}

// Detect CSV format type
function detectCSVFormat(lines: string[]): 'bank' | 'quickbooks' | 'chasecard' {
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].toLowerCase();
    if (line.includes('transaction type') && line.includes('account name')) {
      return 'quickbooks';
    }
    // Chase credit card: Transaction Date,Post Date,Description,Category,Type,Amount
    if (line.includes('transaction date') && line.includes('post date') && line.includes('amount')) {
      return 'chasecard';
    }
  }
  return 'bank';
}

// Parse amount from QuickBooks format (handles quoted values with commas)
function parseQuickBooksAmount(amountStr: string): number {
  if (!amountStr) return 0;
  // Remove quotes and commas, then parse
  const cleaned = amountStr.replace(/"/g, '').replace(/,/g, '').trim();
  return parseFloat(cleaned) || 0;
}

// Parse CSV content (auto-detects format, handles merged files)
export function parseCSV(content: string): RawTransaction[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  // Check if this might be a merged file with multiple CSV sections
  const allTransactions: RawTransaction[] = [];
  let currentSection: string[] = [];
  let currentFormat: 'bank' | 'quickbooks' | 'chasecard' | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    
    // Detect QuickBooks header
    const isQuickBooksHeader = lineLower.includes('transaction type') && lineLower.includes('account name');
    // Detect Bank header (Details,Posting Date,Description,Amount,Type,Balance)
    const isBankHeader = lineLower.startsWith('details,') && lineLower.includes('posting date');
    // Detect Chase credit card header (Transaction Date,Post Date,Description,Category,Type,Amount)
    const isChaseCardHeader = lineLower.includes('transaction date') && lineLower.includes('post date') && lineLower.includes('amount');
    
    if (isQuickBooksHeader || isBankHeader || isChaseCardHeader) {
      // Parse previous section if we have one
      if (currentSection.length > 0 && currentFormat) {
        const parsed = parseFormatSection(currentSection, currentFormat);
        allTransactions.push(...parsed);
      }
      
      // Start new section
      currentSection = [line];
      currentFormat = isQuickBooksHeader ? 'quickbooks' : isChaseCardHeader ? 'chasecard' : 'bank';
    } else if (currentFormat) {
      currentSection.push(line);
    } else {
      // No header detected yet, accumulate lines
      currentSection.push(line);
    }
  }
  
  // Parse final section
  if (currentSection.length > 0) {
    // If no format detected, try to detect from accumulated lines
    if (!currentFormat) {
      currentFormat = detectCSVFormat(currentSection);
    }
    const parsed = parseFormatSection(currentSection, currentFormat);
    allTransactions.push(...parsed);
  }
  
  return allTransactions;
}

// Helper to parse a section based on detected format
function parseFormatSection(lines: string[], format: 'bank' | 'quickbooks' | 'chasecard'): RawTransaction[] {
  switch (format) {
    case 'quickbooks':
      return parseQuickBooksCSV(lines);
    case 'chasecard':
      return parseChaseCardCSV(lines);
    case 'bank':
    default:
      return parseBankCSV(lines);
  }
}

// Parse QuickBooks Transaction List by Date format
function parseQuickBooksCSV(lines: string[]): RawTransaction[] {
  const transactions: RawTransaction[] = [];
  
  // Find the header row (contains "Date,Transaction type,...")
  let headerIndex = -1;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].toLowerCase();
    if (line.startsWith('date,') && line.includes('transaction type')) {
      headerIndex = i;
      break;
    }
  }
  
  if (headerIndex === -1) return [];
  
  // Process data rows after header
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const fields = parseCSVLine(line);
    if (fields.length < 9) continue;
    
    // QuickBooks columns: Date, Transaction type, Num, Posting (Y/N), Name, Memo/Description, Account name, Account full name, Amount
    const date = fields[0];
    const transactionType = fields[1];
    const name = fields[4];
    const description = fields[5];
    const accountName = fields[6];
    const accountFullName = fields[7];
    const amount = parseQuickBooksAmount(fields[8]);
    
    // Skip rows without amount or date
    if (!date || amount === 0) continue;
    
    // Create description from available info
    const fullDescription = description || name || transactionType;
    
    // Determine type based on transaction type and amount
    let type = transactionType;
    if (amount > 0) {
      type = transactionType.toLowerCase().includes('deposit') ? 'ACH_CREDIT' : 'CREDIT';
    } else {
      type = 'DEBIT';
    }
    
    transactions.push({
      details: transactionType,
      postingDate: date,
      description: fullDescription.replace(/^"|"$/g, ''),
      amount: amount,
      type: type,
      balance: 0, // QuickBooks doesn't provide running balance
      checkOrSlip: undefined,
      qbCategory: accountFullName.replace(/^"|"$/g, ''), // Preserve QuickBooks category
    });
  }
  
  return transactions;
}

// Parse Chase credit card CSV format
// Headers: Transaction Date,Post Date,Description,Category,Type,Amount,Memo
function parseChaseCardCSV(lines: string[]): RawTransaction[] {
  const transactions: RawTransaction[] = [];
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const fields = parseCSVLine(line);
    if (fields.length < 6) continue;
    
    // Transaction Date,Post Date,Description,Category,Type,Amount,Memo
    const transactionDate = fields[0];
    const postDate = fields[1];
    const description = fields[2].replace(/^"|"$/g, '');
    const category = fields[3];
    const type = fields[4];
    const amount = parseFloat(fields[5].replace(/,/g, '')) || 0;
    const memo = fields[6] || '';
    
    // Skip empty rows
    if (!postDate || !description) continue;
    
    // Determine transaction type based on amount and type field
    let txType = type.toUpperCase();
    if (amount > 0) {
      txType = 'CREDIT';
    } else if (amount < 0) {
      txType = 'DEBIT';
    }
    
    transactions.push({
      details: type,
      postingDate: postDate,
      description: memo ? `${description} - ${memo}` : description,
      amount: amount,
      type: txType,
      balance: 0, // Chase credit card doesn't provide running balance
      checkOrSlip: undefined,
      qbCategory: category, // Use Chase category for mapping
    });
  }
  
  return transactions;
}

// Parse bank CSV format (original format)
function parseBankCSV(lines: string[]): RawTransaction[] {
  const transactions: RawTransaction[] = [];
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const fields = parseCSVLine(line);
    if (fields.length < 6) continue;
    
    transactions.push({
      details: fields[0],
      postingDate: fields[1],
      description: fields[2].replace(/^"|"$/g, ''),
      amount: parseFloat(fields[3]) || 0,
      type: fields[4],
      balance: parseFloat(fields[5]) || 0,
      checkOrSlip: fields[6] || undefined,
    });
  }
  
  return transactions;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Process transactions with all calculations
export function processTransactions(
  raw: RawTransaction[],
  startingBalance: number
): Transaction[] {
  // Sort by date descending (newest first as in bank statement)
  // Add stable tie-breakers so transaction ordering (and thus IDs) are deterministic.
  const sorted = [...raw].sort((a, b) => {
    const dateA = new Date(parseDate(a.postingDate)).getTime();
    const dateB = new Date(parseDate(b.postingDate)).getTime();
    if (dateB !== dateA) return dateB - dateA;

    const descA = (a.description || '').toLowerCase();
    const descB = (b.description || '').toLowerCase();
    const descCmp = descA.localeCompare(descB);
    if (descCmp !== 0) return descCmp;

    if (a.amount !== b.amount) return b.amount - a.amount;

    const typeA = (a.type || '').toLowerCase();
    const typeB = (b.type || '').toLowerCase();
    const typeCmp = typeA.localeCompare(typeB);
    if (typeCmp !== 0) return typeCmp;

    // Keep as last resort (should rarely matter)
    return 0;
  });

  // Deterministic transaction IDs are critical so local overrides (category/recurring)
  // survive CSV re-uploads.
  const fnv1a32 = (input: string) => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      // 32-bit FNV-1a prime
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash;
  };

  const makeStableTxId = (rawTx: RawTransaction, occurrence: number) => {
    const date = parseDate(rawTx.postingDate);
    const desc = (rawTx.description || '').trim().toLowerCase();
    const type = (rawTx.type || '').trim().toLowerCase();
    const amount = Number(rawTx.amount) || 0;
    const qb = (rawTx.qbCategory || '').trim().toLowerCase();

    // Base key is deterministic across uploads.
    const key = `${date}|${amount}|${type}|${desc}|${qb}|#${occurrence}`;
    const hash = fnv1a32(key).toString(36);
    return `tx_${hash}`;
  };

  const occurrenceCounter = new Map<string, number>();
  
  const transactions: Transaction[] = sorted.map((tx) => {
    const baseKey = `${parseDate(tx.postingDate)}|${Number(tx.amount) || 0}|${(tx.type || '').trim().toLowerCase()}|${(tx.description || '').trim().toLowerCase()}|${(tx.qbCategory || '').trim().toLowerCase()}`;
    const nextOccurrence = (occurrenceCounter.get(baseKey) ?? 0) + 1;
    occurrenceCounter.set(baseKey, nextOccurrence);

    return {
    id: makeStableTxId(tx, nextOccurrence),
    date: parseDate(tx.postingDate),
    description: tx.description,
    amount: tx.amount,
    type: tx.type,
    isRecurring: false,
    category: categorizeTransaction(tx.description, tx.type, tx.amount, tx.qbCategory),
    payPeriodImpact: determinePayPeriodImpact(parseDate(tx.postingDate)),
    runningBalance: 0,
    originalBalance: tx.balance,
  };
  });
  
  // Detect recurring
  const recurringMap = detectRecurring(transactions);
  transactions.forEach(tx => {
    tx.isRecurring = recurringMap.get(tx.id) || false;
  });
  
  // Calculate running balance (from oldest to newest for proper calculation)
  const chronological = [...transactions].reverse();
  let balance = startingBalance;
  chronological.forEach(tx => {
    balance += tx.amount;
    tx.runningBalance = balance;
  });
  
  return transactions;
}

// Generate month summary
export function generateMonthSummary(transactions: Transaction[]): MonthSummary[] {
  const monthMap = new Map<string, Transaction[]>();
  
  transactions.forEach(tx => {
    const date = new Date(tx.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, []);
    }
    monthMap.get(key)!.push(tx);
  });
  
  const summaries: MonthSummary[] = [];
  
  monthMap.forEach((txs, key) => {
    const [year, month] = key.split('-').map(Number);
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    
    const expenses = txs.filter(tx => tx.amount < 0);
    const income = txs.filter(tx => tx.amount > 0);
    const recurring = txs.filter(tx => tx.isRecurring && tx.amount < 0);
    
    summaries.push({
      month: monthName,
      year,
      totalExpenses: expenses.reduce((sum, tx) => sum + tx.amount, 0),
      totalIncome: income.reduce((sum, tx) => sum + tx.amount, 0),
      recurringExpenses: recurring.reduce((sum, tx) => sum + tx.amount, 0),
      endingBalance: txs[0]?.runningBalance || 0,
      transactionCount: txs.length,
      upcomingRecurring: recurring,
    });
  });
  
  return summaries.sort((a, b) => {
    const dateA = new Date(a.year, new Date(`${a.month} 1`).getMonth());
    const dateB = new Date(b.year, new Date(`${b.month} 1`).getMonth());
    return dateB.getTime() - dateA.getTime();
  });
}

// Get unique months from transactions
export function getUniqueMonths(transactions: Transaction[]): string[] {
  const months = new Set<string>();
  
  transactions.forEach(tx => {
    const date = new Date(tx.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.add(key);
  });
  
  return Array.from(months).sort().reverse();
}

// Export to CSV
export function exportToCSV(transactions: Transaction[]): string {
  const headers = ['Date', 'Description', 'Amount', 'Type', 'Recurring', 'Category', 'Pay Period Impact', 'Running Balance'];
  const rows = transactions.map(tx => [
    tx.date,
    `"${tx.description}"`,
    tx.amount.toFixed(2),
    tx.type,
    tx.isRecurring ? 'Yes' : 'No',
    tx.category,
    tx.payPeriodImpact ? 'Yes' : 'No',
    tx.runningBalance.toFixed(2),
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
