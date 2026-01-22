import { useMemo, useState } from 'react';
import { AlertTriangle, Calendar, DollarSign, Clock, TrendingUp, ChevronDown, ChevronUp, Expand, Plus } from 'lucide-react';
import { Bill } from '@/types/bills';
import { PendingCommission } from '@/types/finance';
import { formatCurrency, getPayPeriods } from '@/utils/financeUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface BillsBeforePaydayProps {
  bills: Bill[];
  currentBalance: number;
  nextCommission: PendingCommission | null;
  onAddCommission?: (commission: Omit<PendingCommission, 'id'>) => void;
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
  onAddCommission,
}: BillsBeforePaydayProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedBills, setExpandedBills] = useState<Set<string>>(new Set());
  const [showCommissionForm, setShowCommissionForm] = useState(false);
  const [commissionAmount, setCommissionAmount] = useState('');
  const [commissionDate, setCommissionDate] = useState('');

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
  const commissionDate_ = nextCommission?.expectedDate
    ? new Date(nextCommission.expectedDate)
    : null;

  const paydayCutoff = (commissionDate_ && commissionDate_ > today)
    ? commissionDate_
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
      let expectedDate = new Date(todayStart.getFullYear(), todayStart.getMonth(), bill.dueDay);
      
      const lastDayOfMonth = new Date(expectedDate.getFullYear(), expectedDate.getMonth() + 1, 0).getDate();
      if (bill.dueDay > lastDayOfMonth) {
        expectedDate = new Date(expectedDate.getFullYear(), expectedDate.getMonth(), lastDayOfMonth);
      }

      if (expectedDate < todayStart) {
        expectedDate = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, bill.dueDay);
        const nextLastDay = new Date(expectedDate.getFullYear(), expectedDate.getMonth() + 1, 0).getDate();
        if (bill.dueDay > nextLastDay) {
          expectedDate = new Date(expectedDate.getFullYear(), expectedDate.getMonth(), nextLastDay);
        }
      }

      if (expectedDate >= todayStart && expectedDate <= paydayCutoffEnd) {
        result.push({ ...bill, expectedDate });
      }
    });

    return result.sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());
  }, [bills, todayStart, paydayCutoffEnd]);

  const totalNeeded = billsBeforePayday.reduce((sum, bill) => sum + bill.amount, 0);
  const shortfall = totalNeeded - currentBalance;
  const isShort = shortfall > 0;
  const leftOverAfterBills = nextCommission 
    ? currentBalance - totalNeeded + nextCommission.amount 
    : currentBalance - totalNeeded;

  const formatPayDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleAddCommission = () => {
    const amount = parseFloat(commissionAmount);
    if (!isNaN(amount) && amount > 0 && commissionDate && onAddCommission) {
      onAddCommission({
        amount,
        expectedDate: new Date(commissionDate),
        cutoffDate: '',
      });
      setCommissionAmount('');
      setCommissionDate('');
      setShowCommissionForm(false);
    }
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
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {billsBeforePayday.length} due
          </Badge>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground">
                <Expand className="w-4 h-4" />
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
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Bills Due</p>
                      <p className="text-2xl font-bold font-mono text-expense">{formatCurrency(totalNeeded)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current Balance</p>
                      <p className="text-2xl font-bold font-mono">{formatCurrency(currentBalance)}</p>
                    </div>
                  </div>

                  {/* Balance Bar */}
                  {totalNeeded > 0 && (
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
                  )}

                  {/* Expected Commission Section */}
                  <div className="p-4 rounded-lg bg-income/10 border border-income/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-income" />
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">
                          Expected Commission
                        </p>
                      </div>
                      {!nextCommission && onAddCommission && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-income"
                          onClick={() => setShowCommissionForm(!showCommissionForm)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                      )}
                    </div>

                    {/* Commission Entry Form */}
                    {showCommissionForm && !nextCommission && onAddCommission && (
                      <div className="space-y-3 mb-4 pb-4 border-b border-income/20">
                        <div className="space-y-1">
                          <Label className="text-xs">Amount</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="15987.04"
                              value={commissionAmount}
                              onChange={(e) => setCommissionAmount(e.target.value)}
                              className="h-8 pl-7 text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Expected Date</Label>
                          <Input
                            type="date"
                            value={commissionDate}
                            onChange={(e) => setCommissionDate(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs flex-1"
                            onClick={handleAddCommission}
                          >
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setShowCommissionForm(false);
                              setCommissionAmount('');
                              setCommissionDate('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {nextCommission ? (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xl font-bold font-mono text-income">
                            {formatCurrency(nextCommission.amount)}
                          </p>
                          <span className="text-sm text-muted-foreground">
                            {formatPayDate(new Date(nextCommission.expectedDate))}
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
                            <span className="font-semibold">Left Over After Bills</span>
                            <span className={`text-lg font-bold font-mono ${
                              leftOverAfterBills >= 0 ? 'text-income' : 'text-expense'
                            }`}>
                              {formatCurrency(leftOverAfterBills)}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No commission entered. Add your expected payout to see projected balance.
                      </p>
                    )}
                  </div>

                  {/* Amount to Keep */}
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
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
                </div>

                {/* Bills List in Sheet */}
                <div>
                  <h4 className="font-semibold text-sm mb-4">All {billsBeforePayday.length} Bills</h4>
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
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Next Payday Info */}
      {paydayCutoff && (
        <div className="mb-4 pb-4 border-b border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Next Commission Arrives
          </p>
          <p className="text-lg font-semibold text-income">
            {formatPayDate(paydayCutoff)}
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

      {/* Expected Commission & Left Over - using data from Expected Commission box */}
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
              {formatPayDate(new Date(nextCommission.expectedDate))}
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
              <span className="font-semibold">Left Over After Bills</span>
              <span className={`text-lg font-bold font-mono ${
                leftOverAfterBills >= 0 ? 'text-income' : 'text-expense'
              }`}>
                {formatCurrency(leftOverAfterBills)}
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
            <ScrollArea className="max-h-[300px] pr-2 mt-2">
              <div className="space-y-2">
                {billsBeforePayday.map((bill) => {
                  const isBillExpanded = expandedBills.has(bill.id);
                  
                  return (
                    <div
                      key={bill.id}
                      className="rounded-lg bg-muted/50 border border-border overflow-hidden"
                    >
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
                        <div className="flex items-center justify-between">
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
                        <p className="text-xs text-muted-foreground mt-1">
                          Due {formatPayDate(bill.expectedDate)} ({getOrdinal(bill.dueDay)} of month)
                        </p>
                      </div>
                      
                      {isBillExpanded && (
                        <div className="px-3 pb-3 border-t border-border bg-background/50">
                          <div className="py-3 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Monthly Amount</span>
                              <span className="font-mono font-semibold">{formatCurrency(bill.amount)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Due Day</span>
                              <span className="font-medium">{getOrdinal(bill.dueDay)} of each month</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Next Due</span>
                              <span className="font-medium">{formatPayDate(bill.expectedDate)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
