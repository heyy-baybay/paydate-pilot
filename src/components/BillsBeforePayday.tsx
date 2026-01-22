import { useMemo, useState } from 'react';
import { AlertTriangle, Calendar, DollarSign, Clock, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { Bill } from '@/types/bills';
import { PendingCommission } from '@/types/finance';
import { formatCurrency, getPayPeriods } from '@/utils/financeUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface BillsBeforePaydayProps {
  bills: Bill[];
  currentBalance: number;
  nextCommission: PendingCommission | null;
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function BillsBeforePayday({
  bills,
  currentBalance,
  nextCommission,
}: BillsBeforePaydayProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Calculate next payday
  const periods = getPayPeriods(today.getFullYear(), today.getMonth());
  let nextPayPeriod = periods.find(p => p.paymentDate > today);

  if (!nextPayPeriod) {
    const nextMonth = today.getMonth() === 11 ? 0 : today.getMonth() + 1;
    const nextYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
    const nextPeriods = getPayPeriods(nextYear, nextMonth);
    nextPayPeriod = nextPeriods[0];
  }

  // Use commission date if provided and in future
  const paydayCutoff = (nextCommission?.expectedDate && nextCommission.expectedDate > today)
    ? nextCommission.expectedDate
    : nextPayPeriod?.paymentDate;

  const paydayCutoffEnd = paydayCutoff
    ? new Date(paydayCutoff.getFullYear(), paydayCutoff.getMonth(), paydayCutoff.getDate(), 23, 59, 59, 999)
    : null;

  // Calculate which bills are due before payday
  const billsBeforePayday = useMemo(() => {
    if (!paydayCutoffEnd) return [];

    const activeBills = bills.filter(b => b.active);
    const result: Array<Bill & { expectedDate: Date }> = [];

    activeBills.forEach(bill => {
      // Calculate next occurrence based on due day
      let expectedDate = new Date(todayStart.getFullYear(), todayStart.getMonth(), bill.dueDay);
      
      // Handle months with fewer days
      const lastDayOfMonth = new Date(expectedDate.getFullYear(), expectedDate.getMonth() + 1, 0).getDate();
      if (bill.dueDay > lastDayOfMonth) {
        expectedDate = new Date(expectedDate.getFullYear(), expectedDate.getMonth(), lastDayOfMonth);
      }

      // If the due date has passed this month, check next month
      if (expectedDate < todayStart) {
        expectedDate = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, bill.dueDay);
        const nextLastDay = new Date(expectedDate.getFullYear(), expectedDate.getMonth() + 1, 0).getDate();
        if (bill.dueDay > nextLastDay) {
          expectedDate = new Date(expectedDate.getFullYear(), expectedDate.getMonth(), nextLastDay);
        }
      }

      // Check if this bill falls in the window
      if (expectedDate >= todayStart && expectedDate <= paydayCutoffEnd) {
        result.push({ ...bill, expectedDate });
      }
    });

    // Sort by expected date
    return result.sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());
  }, [bills, todayStart, paydayCutoffEnd]);

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

  if (bills.filter(b => b.active).length === 0) {
    return (
      <div className="stat-card border-2 border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Bills Before Next Payday</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Add bills to "My Bills" above to see what's due before your next payday.
        </p>
      </div>
    );
  }

  return (
    <div className="stat-card border-2 border-primary/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Bills Before Next Payday</h3>
        </div>
        <Badge variant="secondary" className="font-mono">
          {billsBeforePayday.length} due
        </Badge>
      </div>

      {/* Next Payday Info */}
      {paydayCutoff && (
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
              {formatPayDate(paydayCutoff)}
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

      {/* Projected Balance After Commission */}
      {nextCommission && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Projected Balance After Payday
          </p>
          <p className="text-xl font-bold font-mono text-income">
            {formatCurrency(currentBalance - totalNeeded + nextCommission.amount)}
          </p>
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
          Keep this amount to cover all bills until next payday
        </p>
      </div>

      {/* Bills List */}
      {billsBeforePayday.length > 0 && (
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
            <ScrollArea className="max-h-[250px] pr-2 mt-2">
              <div className="space-y-2">
                {billsBeforePayday.map((bill) => (
                  <div
                    key={bill.id}
                    className="p-3 rounded-lg bg-muted/50 border border-border"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium truncate" title={bill.vendor}>
                          {bill.vendor}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-semibold text-expense">
                        {formatCurrency(bill.amount)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Due {formatPayDate(bill.expectedDate)} ({getOrdinal(bill.dueDay)} of month)
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}

      {billsBeforePayday.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          No bills due before {paydayCutoff ? formatPayDate(paydayCutoff) : 'next payday'}
        </p>
      )}
    </div>
  );
}
