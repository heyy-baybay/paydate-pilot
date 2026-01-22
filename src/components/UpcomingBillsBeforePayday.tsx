import { useState, useMemo } from 'react';
import { AlertTriangle, Calendar, DollarSign, Clock, TrendingUp, ChevronDown, ChevronUp, Edit2, RefreshCw, X, Expand, PieChart } from 'lucide-react';
import { Transaction, PayPeriod, TransactionCategory, PendingCommission } from '@/types/finance';
import { extractVendorName, formatCurrency, getPayPeriods } from '@/utils/financeUtils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';

interface UpcomingBillsBeforePaydayProps {
  transactions: Transaction[];
  currentBalance: number;
  selectedMonth: string | null;
  nextCommission: PendingCommission | null;
  onUpdateTransaction?: (id: string, updates: Partial<Pick<Transaction, 'category' | 'isRecurring'>>) => void;
}

interface TransactionHistory {
  date: string;
  amount: number;
  description: string;
}

interface RecurringBill {
  id: string;
  vendor: string;
  amount: number;
  expectedDate: number;
  lastSeen: string;
  category: TransactionCategory;
  transactionId: string;
  transactionIds: string[]; // All transaction IDs for this vendor
  history: TransactionHistory[];
}

const CATEGORIES: TransactionCategory[] = [
  'Gas', 'Travel', 'Legal & Accounting', 'Office Supplies', 'Software',
  'Repairs & Maintenance', 'Postage', 'Taxes & Registration', 'Insurance',
  'Subscriptions', 'Sales', "Owner's Contribution", "Owner's Distribution",
  'Transfers', 'Fees', 'Miscellaneous'
];

export function UpcomingBillsBeforePayday({ 
  transactions, 
  currentBalance,
  selectedMonth: _selectedMonth,
  nextCommission,
  onUpdateTransaction,
}: UpcomingBillsBeforePaydayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingBill, setEditingBill] = useState<string | null>(null);
  const [expandedBills, setExpandedBills] = useState<Set<string>>(new Set());

  const today = new Date();
  // Normalize to day-level comparisons so bills due "today" don't get pushed to next month
  // just because the current time is later in the day.
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Bills-before-payday is a forward-looking view, so payday calculations should
  // always be anchored to *today* (not the month filter used for the table).
  const periods = getPayPeriods(today.getFullYear(), today.getMonth());
  
  const currentDay = today.getDate();
  let nextPayPeriod: PayPeriod | null = null;
  
  for (let i = 0; i < periods.length; i++) {
    if (periods[i].paymentDate > today) {
      nextPayPeriod = periods[i];
      break;
    }
  }
  
  if (!nextPayPeriod) {
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextPeriods = getPayPeriods(nextYear, nextMonth);
    nextPayPeriod = nextPeriods[0];
  }

  // Get all recurring expenses (both auto-detected and manually marked)
  // Some CSV exports represent expenses as positive numbers but label them as DEBIT.
  // For the purposes of "Bills Before Next Payday", treat (Recurring + DEBIT) as an expense.
  const recurringExpenses = transactions.filter((tx) => {
    if (!tx.isRecurring) return false;
    if (tx.amount < 0) return true;
    const typeLower = (tx.type || '').toLowerCase();
    return tx.amount > 0 && typeLower.includes('debit');
  });
  
  // 60-day recency cutoff - only consider bills seen within last 60 days
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  
  const vendorBills = new Map<string, RecurringBill>();

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
  const addDays = (d: Date, days: number) => {
    const next = new Date(d);
    next.setDate(next.getDate() + days);
    return next;
  };

  const predictNextBillDate = (bill: RecurringBill): Date => {
    // Use actual timing deltas between occurrences when available.
    // Falls back to day-of-month method for vendors with limited history.
    const datesDesc = bill.history
      .map((h) => startOfDay(new Date(h.date)))
      .sort((a, b) => b.getTime() - a.getTime());

    const lastSeen = startOfDay(new Date(bill.lastSeen));

    if (datesDesc.length >= 2) {
      const deltas: number[] = [];
      for (let i = 0; i < Math.min(datesDesc.length - 1, 6); i++) {
        const d = diffDays(datesDesc[i], datesDesc[i + 1]);
        // Filter to plausible billing cycles (weekly to ~bi-monthly)
        if (d >= 6 && d <= 62) deltas.push(d);
      }

      if (deltas.length > 0) {
        deltas.sort((a, b) => a - b);
        const median = deltas[Math.floor(deltas.length / 2)];
        let predicted = addDays(lastSeen, median);
        // If we're already past the predicted date, roll forward one more cycle.
        if (predicted < todayStart) predicted = addDays(predicted, median);
        return predicted;
      }
    }

    // Fallback: assume monthly on last seen day-of-month.
    const createClampedDate = (year: number, month: number, day: number) => {
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
      return new Date(year, month, Math.min(day, lastDayOfMonth));
    };

    let expected = createClampedDate(todayStart.getFullYear(), todayStart.getMonth(), bill.expectedDate);
    if (expected < todayStart) {
      expected = createClampedDate(todayStart.getFullYear(), todayStart.getMonth() + 1, bill.expectedDate);
    }
    return expected;
  };
  
  recurringExpenses.forEach(tx => {
    const vendor = extractVendorName(tx.description).toUpperCase();
    const txDate = new Date(tx.date);
    const dayOfMonth = txDate.getDate();
    
    const existing = vendorBills.get(vendor);
    const historyEntry: TransactionHistory = {
      date: tx.date,
      amount: Math.abs(tx.amount),
      description: tx.description,
    };
    
    if (!existing) {
      vendorBills.set(vendor, {
        id: vendor,
        vendor,
        amount: Math.abs(tx.amount),
        expectedDate: dayOfMonth,
        lastSeen: tx.date,
        category: tx.category,
        transactionId: tx.id,
        transactionIds: [tx.id],
        history: [historyEntry],
      });
    } else {
      // Add to history and transaction IDs
      existing.history.push(historyEntry);
      existing.transactionIds.push(tx.id);
      // Update to most recent if newer
      if (new Date(tx.date) > new Date(existing.lastSeen)) {
        existing.amount = Math.abs(tx.amount);
        existing.expectedDate = dayOfMonth;
        existing.lastSeen = tx.date;
        existing.category = tx.category;
        existing.transactionId = tx.id;
      }
      vendorBills.set(vendor, existing);
    }
  });

  // Sort history for each bill (most recent first)
  vendorBills.forEach(bill => {
    bill.history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  // Filter out bills not seen in the last 60 days (stale recurring bills)
  const recentVendorBills = new Map<string, RecurringBill>();
  vendorBills.forEach((bill, vendor) => {
    const lastSeenDate = new Date(bill.lastSeen);
    if (lastSeenDate >= sixtyDaysAgo) {
      recentVendorBills.set(vendor, bill);
    }
  });

  const billsBeforePayday: RecurringBill[] = [];
  // If the user entered an expected commission deposit, that should define the
  // actual "next payday" cutoff for this list.
  const paydayCutoff = (nextCommission?.expectedDate && nextCommission.expectedDate > today)
    ? nextCommission.expectedDate
    : nextPayPeriod?.paymentDate;

  const paydayCutoffEnd = paydayCutoff
    ? new Date(
        paydayCutoff.getFullYear(),
        paydayCutoff.getMonth(),
        paydayCutoff.getDate(),
        23,
        59,
        59,
        999
      )
    : null;

  if (paydayCutoffEnd) {
    recentVendorBills.forEach((bill) => {
      // Calculate when this bill would next occur based on the vendor's timing history.
      const expectedBillDate = predictNextBillDate(bill);

      // Check if this expected bill date falls between today and the next payday
      if (expectedBillDate >= todayStart && expectedBillDate <= paydayCutoffEnd) {
        billsBeforePayday.push(bill);
      }
    });
  }

  billsBeforePayday.sort((a, b) => {
    const aDay = a.expectedDate < currentDay ? a.expectedDate + 31 : a.expectedDate;
    const bDay = b.expectedDate < currentDay ? b.expectedDate + 31 : b.expectedDate;
    return aDay - bDay;
  });

  const recurringExpenseCount = recurringExpenses.length;
  const recurringFlaggedTotal = transactions.filter((tx) => tx.isRecurring).length;
  const recurringFlaggedButNonExpense = recurringFlaggedTotal - recurringExpenseCount;
  const vendorCount = vendorBills.size;
  const recentVendorCount = recentVendorBills.size;

  const totalNeeded = billsBeforePayday.reduce((sum, bill) => sum + bill.amount, 0);
  const shortfall = totalNeeded - currentBalance;
  const isShort = shortfall > 0;

  const formatPayDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric' 
    });
  };

  const handleCategoryChange = (transactionId: string, category: TransactionCategory) => {
    onUpdateTransaction?.(transactionId, { category });
  };

  const handleRecurringToggle = (transactionId: string, isRecurring: boolean) => {
    onUpdateTransaction?.(transactionId, { isRecurring });
  };

  // Mark all transactions for a vendor as not recurring
  const handleRemoveBill = (bill: RecurringBill) => {
    bill.transactionIds.forEach(txId => {
      onUpdateTransaction?.(txId, { isRecurring: false });
    });
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Gas': 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      'Travel': 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
      'Legal & Accounting': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      'Office Supplies': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      'Software': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      'Repairs & Maintenance': 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
      'Postage': 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
      'Taxes & Registration': 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      'Insurance': 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
      'Subscriptions': 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      'Sales': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      "Owner's Contribution": 'bg-green-500/10 text-green-600 dark:text-green-400',
      "Owner's Distribution": 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
      'Transfers': 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
      'Fees': 'bg-red-500/10 text-red-600 dark:text-red-400',
      'Miscellaneous': 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    };
    return colors[category] || colors['Miscellaneous'];
  };

  // Group bills by category for detailed view
  const billsByCategory = useMemo(() => {
    const grouped = new Map<TransactionCategory, { bills: RecurringBill[], total: number }>();
    billsBeforePayday.forEach(bill => {
      const existing = grouped.get(bill.category) || { bills: [], total: 0 };
      existing.bills.push(bill);
      existing.total += bill.amount;
      grouped.set(bill.category, existing);
    });
    return Array.from(grouped.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [billsBeforePayday]);

  if (billsBeforePayday.length === 0 && transactions.length === 0) {
    return null;
  }

  return (
    <div className="stat-card border-2 border-primary/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Bills Before Next Payday</h3>
        </div>
        {billsBeforePayday.length > 0 && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground">
                <Expand className="w-4 h-4 mr-1" />
                <span className="text-xs">Details</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Bills Before Next Payday
                </SheetTitle>
              </SheetHeader>
              
              <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
                {/* Summary Section */}
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-expense/10 border border-expense/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Bills</p>
                      <p className="text-2xl font-bold font-mono text-expense">{formatCurrency(totalNeeded)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current Balance</p>
                      <p className="text-2xl font-bold font-mono">{formatCurrency(currentBalance)}</p>
                    </div>
                  </div>

                  {/* Balance Bar */}
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Coverage</span>
                      <span className={isShort ? 'text-expense font-semibold' : 'text-income font-semibold'}>
                        {Math.min(100, Math.round((currentBalance / totalNeeded) * 100))}%
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, (currentBalance / totalNeeded) * 100)} 
                      className={`h-3 ${isShort ? '[&>div]:bg-expense' : '[&>div]:bg-income'}`}
                    />
                    {isShort && (
                      <p className="text-xs text-expense mt-2">
                        Shortfall: {formatCurrency(shortfall)}
                      </p>
                    )}
                  </div>

                  {nextCommission && (
                    <div className="p-4 rounded-lg bg-income/10 border border-income/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">After Commission</p>
                      <p className="text-2xl font-bold font-mono text-income">
                        {formatCurrency(currentBalance - totalNeeded + nextCommission.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Commission: {formatCurrency(nextCommission.amount)} on {formatPayDate(nextCommission.expectedDate)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Category Breakdown */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <PieChart className="w-4 h-4 text-muted-foreground" />
                    <h4 className="font-semibold text-sm">By Category</h4>
                  </div>
                  <div className="space-y-3">
                    {billsByCategory.map(([category, { total }]) => (
                      <div key={category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className={`${getCategoryColor(category)} text-xs`}>
                            {category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary/60 rounded-full" 
                              style={{ width: `${(total / totalNeeded) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-sm font-medium w-20 text-right">
                            {formatCurrency(total)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-4">All {billsBeforePayday.length} Bills</h4>
                  <div className="space-y-2">
                    {billsBeforePayday.map((bill) => (
                      <Collapsible key={bill.id}>
                        <div className="p-3 rounded-lg bg-muted/50 border border-border">
                          <CollapsibleTrigger asChild>
                            <div className="cursor-pointer">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm font-medium truncate" title={bill.vendor}>
                                    {bill.vendor}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-semibold text-expense">
                                    {formatCurrency(bill.amount)}
                                  </span>
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>~{getOrdinal(bill.expectedDate)} of month</span>
                                <span>•</span>
                                <Badge variant="secondary" className={`${getCategoryColor(bill.category)} text-xs px-1.5 py-0`}>
                                  {bill.category}
                                </Badge>
                                <span>•</span>
                                <span className="text-primary">{bill.history.length} occurrence{bill.history.length !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            <div className="mt-3 pt-3 border-t border-border space-y-2">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Transaction History
                              </p>
                              {bill.history.map((entry, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs p-2 rounded bg-background/50">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate" title={entry.description}>
                                      {entry.description}
                                    </p>
                                    <p className="text-muted-foreground">
                                      {new Date(entry.date).toLocaleDateString('en-US', { 
                                        month: 'short', 
                                        day: 'numeric',
                                        year: 'numeric'
                                      })}
                                    </p>
                                  </div>
                                  <span className="font-mono text-expense font-medium ml-2">
                                    {formatCurrency(entry.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {billsBeforePayday.length === 0 && transactions.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-sm font-medium">No upcoming bills found in the current window.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Recurring expenses detected: <span className="font-mono">{recurringExpenseCount}</span> • Vendors (recent):{' '}
            <span className="font-mono">{recentVendorCount}</span>/{vendorCount}
            {paydayCutoffEnd ? (
              <> • Window: {formatPayDate(todayStart)} → {formatPayDate(paydayCutoffEnd)}</>
            ) : (
              <> • Next payday not found</>
            )}
          </p>
          {recurringFlaggedButNonExpense > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Note: <span className="font-mono">{recurringFlaggedButNonExpense}</span> recurring item(s) look like non-expenses (e.g. income/credits), so they won’t be counted as bills.
            </p>
          )}
          {recurringExpenseCount === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Tip: mark a transaction as “Recurring” in the table (or ensure your CSV includes enough history) so it can be predicted here.
            </p>
          )}
        </div>
      )}

      {/* Next Payday Info */}
      {nextPayPeriod && (
        <div className="mb-4 pb-4 border-b border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            {nextCommission ? 'Expected Commission' : 'Next Commission Arrives'}
          </p>
          {nextCommission ? (
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-income" />
              <p className="text-lg font-semibold text-income">
                {formatCurrency(nextCommission.amount)}
              </p>
              <span className="text-sm text-muted-foreground">
                on {formatPayDate(nextCommission.expectedDate)}
              </span>
            </div>
          ) : (
            <p className="text-lg font-semibold text-income">
              {formatPayDate(nextPayPeriod.paymentDate)}
            </p>
          )}
        </div>
      )}

      {/* Amount Needed */}
      <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-border">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Total Bills Due
          </p>
          <p className="text-xl font-bold font-mono text-expense">
            {formatCurrency(totalNeeded)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Current Balance
          </p>
          <p className="text-xl font-bold font-mono">
            {formatCurrency(currentBalance)}
          </p>
        </div>
      </div>

      {/* Shortfall Warning */}
      {isShort && (
        <div className="p-3 rounded-lg bg-expense/10 border border-expense/20 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-expense flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-expense">Shortfall Warning</p>
            <p className="text-xs text-muted-foreground">
              You need <span className="text-expense font-semibold">{formatCurrency(shortfall)}</span> more to cover bills before payday
            </p>
          </div>
        </div>
      )}

      {/* Expected Commission & Left Over */}
      {nextCommission && (
        <div className="p-4 rounded-lg bg-income/10 border border-income/20 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-income" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Expected Commission
            </p>
          </div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xl font-bold font-mono text-income">
              {formatCurrency(nextCommission.amount)}
            </p>
            <span className="text-sm text-muted-foreground">
              {formatPayDate(nextCommission.expectedDate)}
            </span>
          </div>
          
          {/* Calculation Breakdown */}
          <div className="pt-3 border-t border-income/20 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current Balance</span>
              <span className="font-mono">{formatCurrency(currentBalance)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">− Bills Due</span>
              <span className="font-mono text-expense">−{formatCurrency(totalNeeded)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">+ Commission</span>
              <span className="font-mono text-income">+{formatCurrency(nextCommission.amount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-income/20">
              <span className="font-medium">Left Over After Bills</span>
              <span className={`text-lg font-bold font-mono ${
                currentBalance - totalNeeded + nextCommission.amount >= 0 ? 'text-income' : 'text-expense'
              }`}>
                {formatCurrency(currentBalance - totalNeeded + nextCommission.amount)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Amount to Keep */}
      <div className="p-4 rounded-lg bg-primary/10 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-4 h-4 text-primary" />
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Amount to Keep in Account
          </p>
        </div>
        <p className="text-2xl font-bold font-mono text-primary">
          {formatCurrency(totalNeeded)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Keep this amount to cover all recurring bills until next payday
        </p>
      </div>

      {/* Bills List - Collapsible */}
      {billsBeforePayday.length > 0 ? (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex items-center justify-between p-2 h-auto">
              <span className="text-sm font-medium">
                {billsBeforePayday.length} Bill{billsBeforePayday.length !== 1 ? 's' : ''} Due
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="max-h-[400px] pr-2 mt-2">
              <div className="space-y-2">
                {billsBeforePayday.map((bill) => {
                  const isBillExpanded = expandedBills.has(bill.id);
                  const expectedDate = (() => {
                    // Calculate expected date for display
                    const todayLocal = new Date();
                    const createClampedDate = (year: number, month: number, day: number) => {
                      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
                      return new Date(year, month, Math.min(day, lastDayOfMonth));
                    };
                    let expected = createClampedDate(todayLocal.getFullYear(), todayLocal.getMonth(), bill.expectedDate);
                    if (expected < todayLocal) {
                      expected = createClampedDate(todayLocal.getFullYear(), todayLocal.getMonth() + 1, bill.expectedDate);
                    }
                    return expected;
                  })();
                  
                  return (
                    <div 
                      key={bill.id} 
                      className="rounded-lg bg-muted/50 border border-border overflow-hidden"
                    >
                      {/* Clickable Bill Header */}
                      <div 
                        className="p-3 cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() => {
                          setExpandedBills(prev => {
                            const next = new Set(prev);
                            if (next.has(bill.id)) {
                              next.delete(bill.id);
                            } else {
                              next.add(bill.id);
                            }
                            return next;
                          });
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium truncate" title={bill.vendor}>
                              {bill.vendor}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-expense">
                              {formatCurrency(bill.amount)}
                            </span>
                            {isBillExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Due {expectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ({getOrdinal(bill.expectedDate)} of month)</span>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isBillExpanded && (
                        <div className="px-3 pb-3 border-t border-border bg-background/50">
                          {/* Quick Stats */}
                          <div className="grid grid-cols-3 gap-2 py-3">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Occurrences</p>
                              <p className="text-sm font-semibold">{bill.history.length}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Avg Amount</p>
                              <p className="text-sm font-semibold font-mono">
                                {formatCurrency(bill.history.reduce((sum, h) => sum + h.amount, 0) / bill.history.length)}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Category</p>
                              <Badge variant="secondary" className={`${getCategoryColor(bill.category)} text-xs px-1.5 py-0`}>
                                {bill.category}
                              </Badge>
                            </div>
                          </div>

                          {/* Transaction History */}
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              Recent Transactions
                            </p>
                            {bill.history.slice(0, 5).map((entry, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                                <div className="flex-1 min-w-0">
                                  <p className="text-muted-foreground truncate" title={entry.description}>
                                    {new Date(entry.date).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                  </p>
                                </div>
                                <span className="font-mono text-expense font-medium ml-2">
                                  {formatCurrency(entry.amount)}
                                </span>
                              </div>
                            ))}
                            {bill.history.length > 5 && (
                              <p className="text-xs text-muted-foreground text-center py-1">
                                +{bill.history.length - 5} more
                              </p>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingBill(editingBill === bill.id ? null : bill.id);
                              }}
                            >
                              <Edit2 className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                            {onUpdateTransaction && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-expense hover:text-expense hover:bg-expense/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveBill(bill);
                                }}
                              >
                                <X className="w-3 h-3 mr-1" />
                                Remove
                              </Button>
                            )}
                          </div>

                          {/* Edit Controls */}
                          {editingBill === bill.id && onUpdateTransaction && (
                            <div className="mt-3 pt-3 border-t border-border space-y-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Category</Label>
                                <Select 
                                  value={bill.category} 
                                  onValueChange={(value) => handleCategoryChange(bill.transactionId, value as TransactionCategory)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CATEGORIES.map((cat) => (
                                      <SelectItem key={cat} value={cat} className="text-xs">
                                        {cat}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs flex items-center gap-1">
                                  <RefreshCw className="w-3 h-3" />
                                  Recurring
                                </Label>
                                <Switch
                                  checked={true}
                                  onCheckedChange={(checked) => handleRecurringToggle(bill.transactionId, checked)}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          {transactions.length > 0 
            ? "No recurring bills detected before next payday" 
            : "Upload transactions to see upcoming bills"}
        </p>
      )}
    </div>
  );
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

