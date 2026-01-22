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

// Category detection based on description
const categoryPatterns: Record<TransactionCategory, RegExp[]> = {
  'Subscriptions': [/spotify/i, /netflix/i, /hulu/i, /apple/i, /google.*storage/i, /dialpad/i, /cloudflare/i, /squarespace/i, /sqsp/i, /lovable/i],
  'Fuel': [/valero/i, /shell/i, /exxon/i, /chevron/i, /fuel/i, /gas/i, /pilot/i, /ta\s/i, /loves/i, /petro/i],
  'Software': [/github/i, /adobe/i, /microsoft/i, /zoom/i, /slack/i, /aws/i, /heroku/i, /front\.com/i, /cargado/i],
  'Suppliers': [/supplier/i, /wholesale/i, /parts/i, /equipment/i, /volpe/i, /beam/i],
  'Utilities': [/utility/i, /electric/i, /water/i, /power/i, /energy/i],
  'Transfers': [/transfer/i, /xfer/i, /acct_xfer/i, /zelle/i, /venmo/i, /paypal/i],
  'Fees': [/fee/i, /charge/i, /overdraft/i, /nsf/i, /service charge/i],
  'Income': [/deposit/i, /credit/i, /invoice/i, /payment.*received/i, /margin freight/i, /ach_credit/i],
  'Taxes': [/revenue.*department/i, /irs/i, /tax/i, /state.*tax/i],
  'Insurance': [/insurance/i, /geico/i, /allstate/i, /progressive/i, /state farm/i, /hendersh/i],
  'Miscellaneous': [],
};

export function categorizeTransaction(description: string, type: string, amount: number): TransactionCategory {
  const cleanDesc = description.toLowerCase();
  
  // Check if it's income first
  if (amount > 0 || type.toLowerCase().includes('credit')) {
    for (const pattern of categoryPatterns['Income']) {
      if (pattern.test(cleanDesc)) return 'Income';
    }
    if (type.toLowerCase().includes('credit') || type.toLowerCase().includes('ach_credit')) {
      return 'Income';
    }
  }
  
  // Check transfers
  if (type.toLowerCase().includes('xfer') || type.toLowerCase().includes('transfer')) {
    return 'Transfers';
  }
  
  // Check other categories
  for (const [category, patterns] of Object.entries(categoryPatterns)) {
    if (category === 'Income' || category === 'Miscellaneous') continue;
    for (const pattern of patterns) {
      if (pattern.test(cleanDesc)) return category as TransactionCategory;
    }
  }
  
  return 'Miscellaneous';
}

// Detect recurring transactions
export function detectRecurring(transactions: Transaction[]): Map<string, boolean> {
  const vendorCounts = new Map<string, number>();
  const recurringMap = new Map<string, boolean>();
  
  // Extract vendor names and count occurrences
  transactions.forEach(tx => {
    const vendor = extractVendorName(tx.description);
    vendorCounts.set(vendor, (vendorCounts.get(vendor) || 0) + 1);
  });
  
  // Mark as recurring if vendor appears 2+ times
  transactions.forEach(tx => {
    const vendor = extractVendorName(tx.description);
    recurringMap.set(tx.id, (vendorCounts.get(vendor) || 0) >= 2);
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
    category: categorizeTransaction(tx.description, tx.type, tx.amount),
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
