import { useState } from 'react';
import { Clock, DollarSign, TrendingUp, Calendar, Plus, Expand } from 'lucide-react';
import { Bill } from '@/types/bills';
import { PendingCommission } from '@/types/finance';
import { formatCurrency } from '@/utils/financeUtils';
import {
  useNextPayday,
  useBillsBeforePayday,
  useFinancialProjection,
  formatPayDate,
  getOrdinal,
} from '@/hooks/useFinanceCalculations';
import { parseLocalDate } from '@/hooks/useCommissionManager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface BillsBeforePaydayProps {
  bills: Bill[];
  currentBalance: number;
  nextCommission: PendingCommission | null;
  onAddCommission?: (commission: Omit<PendingCommission, 'id'>) => void;
}

export function BillsBeforePayday({
  bills,
  currentBalance,
  nextCommission,
  onAddCommission,
}: BillsBeforePaydayProps) {
  const [showCommissionForm, setShowCommissionForm] = useState(false);
  const [commissionAmount, setCommissionAmount] = useState('');
  const [commissionDate, setCommissionDate] = useState('');

  const { paydayDate, paydayCutoffEnd } = useNextPayday(nextCommission);
  const billsBeforePayday = useBillsBeforePayday(bills, paydayCutoffEnd);
  const { totalNeeded, shortfall, isShort, leftOverAfterBills, coveragePercent } =
    useFinancialProjection(billsBeforePayday, currentBalance, nextCommission);

  const handleAddCommission = () => {
    const amount = parseFloat(commissionAmount);
    if (!isNaN(amount) && amount > 0 && commissionDate && onAddCommission) {
      onAddCommission({
        amount,
        // Parse as local date to avoid YYYY-MM-DD being treated as UTC (can shift a day)
        expectedDate: parseLocalDate(commissionDate),
        cutoffDate: '',
      });
      setCommissionAmount('');
      setCommissionDate('');
      setShowCommissionForm(false);
    }
  };

  if (bills.filter((b) => b.active).length === 0) {
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
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <Expand className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Bills Before Next Payday
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-expense/10 border border-expense/20">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Total Bills Due
                    </p>
                    <p className="text-2xl font-bold font-mono text-expense">
                      {formatCurrency(totalNeeded)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Current Balance
                    </p>
                    <p className="text-2xl font-bold font-mono">{formatCurrency(currentBalance)}</p>
                  </div>
                </div>

                {totalNeeded > 0 && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Coverage</span>
                      <span className={isShort ? 'text-expense font-semibold' : 'text-income font-semibold'}>
                        {coveragePercent}%
                      </span>
                    </div>
                    <Progress
                      value={coveragePercent}
                      className={`h-3 ${isShort ? '[&>div]:bg-expense' : '[&>div]:bg-income'}`}
                    />
                    {isShort && (
                      <p className="text-xs text-expense mt-2">
                        Shortfall: {formatCurrency(shortfall)}
                      </p>
                    )}
                  </div>
                )}

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

                  {showCommissionForm && !nextCommission && onAddCommission && (
                    <div
                      className="space-y-3 mb-4 pb-4 border-b border-income/20"
                      onClick={(e) => e.stopPropagation()}
                    >
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
                            onClick={(e) => e.stopPropagation()}
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
                          onClick={(e) => e.stopPropagation()}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-xs flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleAddCommission();
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
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
                          <span className="font-mono text-income">
                            +{formatCurrency(nextCommission.amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm pt-2 border-t border-income/20">
                          <span className="font-semibold">Left Over After Bills</span>
                          <span
                            className={`text-lg font-bold font-mono ${
                              leftOverAfterBills >= 0 ? 'text-income' : 'text-expense'
                            }`}
                          >
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

                <div>
                  <h4 className="font-semibold text-sm mb-4">
                    All {billsBeforePayday.length} Bills
                  </h4>
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
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Due</span>
          <span className="font-mono font-semibold text-expense">{formatCurrency(totalNeeded)}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Next Payday</span>
          <span className="text-sm">{formatPayDate(paydayDate)}</span>
        </div>

        {isShort && (
          <div className="p-2 rounded-lg bg-expense/10 border border-expense/20">
            <p className="text-xs text-expense font-medium">
              ⚠️ Shortfall of {formatCurrency(shortfall)} before payday
            </p>
          </div>
        )}

        {nextCommission && (
          <div className="pt-3 border-t border-border">
            <div className="p-3 rounded-lg bg-income/10 border border-income/20">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-3 h-3 text-income" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                  After Commission
                </span>
              </div>
              <p
                className={`text-lg font-bold font-mono ${
                  leftOverAfterBills >= 0 ? 'text-income' : 'text-expense'
                }`}
              >
                {formatCurrency(leftOverAfterBills)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
