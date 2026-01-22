import { AlertTriangle, Calendar, DollarSign, Clock } from 'lucide-react';
import { Transaction, PayPeriod } from '@/types/finance';
import { formatCurrency, getPayPeriods } from '@/utils/financeUtils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UpcomingBillsBeforePaydayProps {
  transactions: Transaction[];
  currentBalance: number;
  selectedMonth: string | null;
}

interface RecurringBill {
  vendor: string;
  amount: number;
  expectedDate: number; // day of month
  lastSeen: string;
}

export function UpcomingBillsBeforePayday({ 
  transactions, 
  currentBalance,
  selectedMonth 
}: UpcomingBillsBeforePaydayProps) {
  const today = new Date();
  const year = selectedMonth 
    ? parseInt(selectedMonth.split('-')[0]) 
    : today.getFullYear();
  const month = selectedMonth 
    ? parseInt(selectedMonth.split('-')[1]) - 1 
    : today.getMonth();

  const periods = getPayPeriods(year, month);
  
  // Find next payment date
  const currentDay = today.getDate();
  let nextPayPeriod: PayPeriod | null = null;
  let nextCutoff: Date | null = null;
  
  for (let i = 0; i < periods.length; i++) {
    if (periods[i].paymentDate > today) {
      nextPayPeriod = periods[i];
      nextCutoff = periods[i].cutoffDate;
      break;
    }
  }
  
  // If no more pay periods this month, look at next month
  if (!nextPayPeriod) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const nextPeriods = getPayPeriods(nextYear, nextMonth);
    nextPayPeriod = nextPeriods[0];
    nextCutoff = nextPeriods[0]?.cutoffDate || null;
  }

  // Identify recurring expenses and their typical day of month
  const recurringExpenses = transactions.filter(tx => tx.isRecurring && tx.amount < 0);
  
  const vendorBills = new Map<string, RecurringBill>();
  
  recurringExpenses.forEach(tx => {
    const vendor = tx.description.split(/\s+/).slice(0, 2).join(' ').toUpperCase();
    const txDate = new Date(tx.date);
    const dayOfMonth = txDate.getDate();
    
    const existing = vendorBills.get(vendor);
    if (!existing || new Date(tx.date) > new Date(existing.lastSeen)) {
      vendorBills.set(vendor, {
        vendor,
        amount: Math.abs(tx.amount),
        expectedDate: dayOfMonth,
        lastSeen: tx.date,
      });
    }
  });

  // Filter bills expected before next payday
  const billsBeforePayday: RecurringBill[] = [];
  const nextPayDate = nextPayPeriod?.paymentDate;
  
  if (nextPayDate) {
    const nextPayDay = nextPayDate.getDate();
    
    vendorBills.forEach(bill => {
      // Bill is expected before next payday if its typical day is between today and next pay date
      // Handle month boundaries
      if (today.getMonth() === nextPayDate.getMonth()) {
        // Same month
        if (bill.expectedDate > currentDay && bill.expectedDate < nextPayDay) {
          billsBeforePayday.push(bill);
        }
      } else {
        // Different month - bill could be end of this month or start of next
        if (bill.expectedDate > currentDay || bill.expectedDate < nextPayDay) {
          billsBeforePayday.push(bill);
        }
      }
    });
  }

  // Sort by expected date
  billsBeforePayday.sort((a, b) => {
    // Normalize for month boundary
    const aDay = a.expectedDate < currentDay ? a.expectedDate + 31 : a.expectedDate;
    const bDay = b.expectedDate < currentDay ? b.expectedDate + 31 : b.expectedDate;
    return aDay - bDay;
  });

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

  if (billsBeforePayday.length === 0 && transactions.length === 0) {
    return null;
  }

  return (
    <div className="stat-card border-2 border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Bills Before Next Payday</h3>
      </div>

      {nextPayPeriod && (
        <div className="mb-4 pb-4 border-b border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Next Commission Arrives
          </p>
          <p className="text-lg font-semibold text-income">
            {formatPayDate(nextPayPeriod.paymentDate)}
          </p>
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

      {/* Bills List */}
      {billsBeforePayday.length > 0 ? (
        <ScrollArea className="h-[180px] pr-4">
          <div className="space-y-2">
            {billsBeforePayday.map((bill) => (
              <div 
                key={bill.vendor} 
                className="flex items-center justify-between p-2 rounded bg-muted/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm truncate block" title={bill.vendor}>
                      {bill.vendor}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ~{getOrdinal(bill.expectedDate)} of month
                    </span>
                  </div>
                </div>
                <span className="font-mono text-sm font-medium text-expense flex-shrink-0">
                  {formatCurrency(bill.amount)}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
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

