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
  // If we have a QuickBooks category, use it directly
  if (qbCategory) {
    const qbLower = qbCategory.toLowerCase();
    if (qbLower.includes('gas') || qbLower.includes('fuel')) return 'Gas';
    if (qbLower.includes('travel')) return 'Travel';
    if (qbLower.includes('legal') || qbLower.includes('accounting')) return 'Legal & Accounting';
    if (qbLower.includes('office supplies')) return 'Office Supplies';
    if (qbLower.includes('software')) return 'Software';
    if (qbLower.includes('repair') || qbLower.includes('maintenance')) return 'Repairs & Maintenance';
    if (qbLower.includes('postage') || qbLower.includes('shipping')) return 'Postage';
    if (qbLower.includes('tax') || qbLower.includes('registration')) return 'Taxes & Registration';
    if (qbLower.includes('insurance')) return 'Insurance';
    if (qbLower.includes('subscription')) return 'Subscriptions';
    if (qbLower.includes('sales') || qbLower.includes('income') || qbLower.includes('revenue')) return 'Sales';
    if (qbLower.includes('owner\'s contribution') || qbLower.includes('capital')) return "Owner's Contribution";
    if (qbLower.includes('owner\'s distribution') || qbLower.includes('draw')) return "Owner's Distribution";
    if (qbLower.includes('due from') || qbLower.includes('transfer')) return 'Transfers';
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

// Detect recurring transactions based on:
// 1. Same vendor appearing multiple times
// 2. Similar day of month (±3 days)
// 3. Similar amount (±$10)
export function detectRecurring(transactions: Transaction[]): Map<string, boolean> {
  const recurringMap = new Map<string, boolean>();
  
  // Group transactions by vendor
  const vendorTransactions = new Map<string, Transaction[]>();
  transactions.forEach(tx => {
    const vendor = extractVendorName(tx.description);
    const existing = vendorTransactions.get(vendor) || [];
    existing.push(tx);
    vendorTransactions.set(vendor, existing);
  });
  
  // For each transaction, check if it has a recurring pattern
  transactions.forEach(tx => {
    const vendor = extractVendorName(tx.description);
    const vendorTxs = vendorTransactions.get(vendor) || [];
    
    // Need at least 2 transactions from same vendor
    if (vendorTxs.length < 2) {
      recurringMap.set(tx.id, false);
      return;
    }
    
    const txDate = new Date(tx.date);
    const txDay = txDate.getDate();
    const txAmount = Math.abs(tx.amount);
    
    // Check if there's another transaction with similar day and amount
    const hasRecurringPattern = vendorTxs.some(otherTx => {
      if (otherTx.id === tx.id) return false;
      
      const otherDate = new Date(otherTx.date);
      const otherDay = otherDate.getDate();
      const otherAmount = Math.abs(otherTx.amount);
      
      // Check day of month is within ±3 days (handle month wraparound)
      const dayDiff = Math.min(
        Math.abs(txDay - otherDay),
        Math.abs(txDay - otherDay + 31),
        Math.abs(txDay - otherDay - 31)
      );
      const isSimilarDay = dayDiff <= 3;
      
      // Check amount is within ±$10
      const amountDiff = Math.abs(txAmount - otherAmount);
      const isSimilarAmount = amountDiff <= 10;
      
      return isSimilarDay && isSimilarAmount;
    });
    
    recurringMap.set(tx.id, hasRecurringPattern);
  });
  
  return recurringMap;
}

function extractVendorName(description: string): string {
  // Clean up common patterns and extract core vendor name
  const cleaned = description
    .replace(/\d{2}\/\d{2}/g, '') // Remove dates
    .replace(/\d{6,}/g, '') // Remove long numbers
    .replace(/transaction#:\s*\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Take first meaningful words
  const words = cleaned.split(' ').slice(0, 3).join(' ').toLowerCase();
  return words || description.toLowerCase();
}

// Calculate pay periods
export function getPayPeriods(year: number, month: number): PayPeriod[] {
  const periods: PayPeriod[] = [];
  
  // First cutoff: 15th of month
  const firstCutoff = new Date(year, month, 15);
  const firstCalc = getNextBusinessDay(firstCutoff, 1);
  const firstPayment = getNextBusinessDay(firstCutoff, 4);
  
  periods.push({
    cutoffDate: firstCutoff,
    calculationDate: firstCalc,
    paymentDate: firstPayment,
  });
  
  // Second cutoff: Last day of month
  const lastDay = new Date(year, month + 1, 0);
  const secondCalc = getNextBusinessDay(lastDay, 1);
  const secondPayment = getNextBusinessDay(lastDay, 4);
  
  periods.push({
    cutoffDate: lastDay,
    calculationDate: secondCalc,
    paymentDate: secondPayment,
  });
  
  return periods;
}

function getNextBusinessDay(fromDate: Date, daysAfter: number): Date {
  let date = new Date(fromDate);
  let businessDays = 0;
  
  while (businessDays < daysAfter) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays++;
    }
  }
  
  return date;
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
function detectCSVFormat(lines: string[]): 'bank' | 'quickbooks' {
  // QuickBooks has metadata rows and specific header pattern
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].toLowerCase();
    if (line.includes('transaction type') && line.includes('account name')) {
      return 'quickbooks';
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
  let currentFormat: 'bank' | 'quickbooks' | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    
    // Detect QuickBooks header
    const isQuickBooksHeader = lineLower.includes('transaction type') && lineLower.includes('account name');
    // Detect Bank header (Details,Posting Date,Description,Amount,Type,Balance)
    const isBankHeader = lineLower.startsWith('details,') && lineLower.includes('posting date');
    
    if (isQuickBooksHeader || isBankHeader) {
      // Parse previous section if we have one
      if (currentSection.length > 0 && currentFormat) {
        const parsed = currentFormat === 'quickbooks' 
          ? parseQuickBooksCSV(currentSection)
          : parseBankCSV(currentSection);
        allTransactions.push(...parsed);
      }
      
      // Start new section
      currentSection = [line];
      currentFormat = isQuickBooksHeader ? 'quickbooks' : 'bank';
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
    const parsed = currentFormat === 'quickbooks' 
      ? parseQuickBooksCSV(currentSection)
      : parseBankCSV(currentSection);
    allTransactions.push(...parsed);
  }
  
  return allTransactions;
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
  const sorted = [...raw].sort((a, b) => {
    const dateA = new Date(parseDate(a.postingDate));
    const dateB = new Date(parseDate(b.postingDate));
    return dateB.getTime() - dateA.getTime();
  });
  
  const transactions: Transaction[] = sorted.map((tx, index) => ({
    id: `tx-${index}-${Date.now()}`,
    date: parseDate(tx.postingDate),
    description: tx.description,
    amount: tx.amount,
    type: tx.type,
    isRecurring: false,
    category: categorizeTransaction(tx.description, tx.type, tx.amount, tx.qbCategory),
    payPeriodImpact: determinePayPeriodImpact(parseDate(tx.postingDate)),
    runningBalance: 0,
    originalBalance: tx.balance,
  }));
  
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
