import { useState } from 'react';
import { Clock, DollarSign, TrendingUp, Calendar, Plus, Check } from 'lucide-react';
import { Bill } from '@/types/bills';
import { PendingCommission, Transaction } from '@/types/finance';
import { formatCurrency } from '@/utils/financeUtils';
import {
  useNextPayday,
  useBillsBeforePayday,
  formatPayDate,
  getOrdinal,
  BillWithExpectedDate,
} from '@/hooks/useFinanceCalculations';
import { useBillPaymentDetection, BillPaymentStatus } from '@/hooks/useBillPaymentDetection';
import { parseLocalDate } from '@/hooks/useCommissionManager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BillForecastProps {
  bills: Bill[];
  transactions: Transaction[];
  currentBalance: number;
  nextCommission: PendingCommission | null;
  onAddCommission?: (commission: Omit<PendingCommission, 'id'>) => void;
}

interface BillWithPaymentStatus extends BillWithExpectedDate {
  isPaid: boolean;
  paymentInfo?: BillPaymentStatus;
}

export function BillForecast({
  bills,
  transactions,
  currentBalance,
  nextCommission,
  onAddCommission,
}: BillForecastProps) {
  const [showCommissionForm, setShowCommissionForm] = useState(false);
  const [commissionAmount, setCommissionAmount] = useState('');
  const [commissionDate, setCommissionDate] = useState('');

  // Get payment detection status
  const paymentStatusMap = useBillPaymentDetection(bills, transactions);

  // Calculate payday info
  const { paydayDate, paydayCutoffEnd } = useNextPayday(nextCommission);
  const allBillsBeforePayday = useBillsBeforePayday(bills, paydayCutoffEnd);

  // Augment bills with payment status
  const billsWithStatus: BillWithPaymentStatus[] = allBillsBeforePayday.map((bill) => {
    const status = paymentStatusMap.get(bill.id);
    return {
      ...bill,
      isPaid: status?.isPaid || false,
      paymentInfo: status,
    };
  });

  // Separate paid and unpaid bills
  const unpaidBills = billsWithStatus.filter((b) => !b.isPaid);
  const paidBills = billsWithStatus.filter((b) => b.isPaid);

  // Calculate financial projections based on UNPAID bills only
  const totalNeeded = unpaidBills.reduce((sum, bill) => sum + bill.amount, 0);
  const shortfall = Math.max(0, totalNeeded - currentBalance);
  const isShort = shortfall > 0;
  
  // Left Over = Current Balance - Remaining Unpaid Bills + Expected Commission
  const leftOverAfterBills = nextCommission
    ? currentBalance - totalNeeded + nextCommission.amount
    : currentBalance - totalNeeded;
  
  const coveragePercent =
    totalNeeded > 0 ? Math.min(100, Math.round((currentBalance / totalNeeded) * 100)) : 100;

  const handleAddCommission = () => {
    const amount = parseFloat(commissionAmount);
    if (!isNaN(amount) && amount > 0 && commissionDate && onAddCommission) {
      onAddCommission({
        amount,
        expectedDate: parseLocalDate(commissionDate),
        cutoffDate: '',
      });
      setCommissionAmount('');
      setCommissionDate('');
      setShowCommissionForm(false);
    }
  };

  const activeBillCount = bills.filter((b) => b.active).length;

  if (activeBillCount === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Bill Forecast</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Add bills to "My Bills" to see what's due before your next payday.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Bill Forecast</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">
              {unpaidBills.length} unpaid
            </Badge>
            {paidBills.length > 0 && (
              <Badge variant="outline" className="font-mono text-income">
                {paidBills.length} paid
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>Next Payday: {formatPayDate(paydayDate)}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 border-b border-border">
        <div className="p-4 rounded-lg bg-expense/10 border border-expense/20">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Unpaid Bills Due
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
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Amount to Keep
          </p>
          <p className="text-2xl font-bold font-mono text-primary">
            {formatCurrency(totalNeeded)}
          </p>
        </div>
      </div>

      {/* Coverage & Commission */}
      <div className="p-6 border-b border-border space-y-4">
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

        {/* Commission Section */}
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
                  type="button"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={handleAddCommission}
                >
                  Save
                </Button>
                <Button
                  type="button"
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

              <div className="pt-3 border-t border-income/20 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current Balance</span>
                  <span className="font-mono">{formatCurrency(currentBalance)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">− Unpaid Bills</span>
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
      </div>

      {/* Bill Lists */}
      <div className="p-6">
        <Tabs defaultValue="unpaid" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="unpaid">
              Unpaid ({unpaidBills.length})
            </TabsTrigger>
            <TabsTrigger value="paid">
              Paid ({paidBills.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unpaid" className="space-y-2">
            {unpaidBills.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                All bills have been paid! 🎉
              </p>
            ) : (
              unpaidBills.map((bill) => (
                <BillRow key={bill.id} bill={bill} />
              ))
            )}
          </TabsContent>

          <TabsContent value="paid" className="space-y-2">
            {paidBills.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No bills paid yet this period.
              </p>
            ) : (
              paidBills.map((bill) => (
                <BillRow key={bill.id} bill={bill} showPaidInfo />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

interface BillRowProps {
  bill: BillWithPaymentStatus;
  showPaidInfo?: boolean;
}

function BillRow({ bill, showPaidInfo }: BillRowProps) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        bill.isPaid
          ? 'bg-income/5 border-income/20'
          : 'bg-muted/50 border-border'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {bill.isPaid && (
            <Check className="w-4 h-4 text-income flex-shrink-0" />
          )}
          <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium truncate" title={bill.vendor}>
            {bill.vendor}
          </span>
          {bill.type === 'one-time' && (
            <Badge variant="outline" className="text-xs">
              One-time
            </Badge>
          )}
        </div>
        <span
          className={`font-mono text-sm font-semibold ${
            bill.isPaid ? 'text-income line-through' : 'text-expense'
          }`}
        >
          {formatCurrency(bill.amount)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {bill.isPaid && showPaidInfo && bill.paymentInfo ? (
          <>Paid on {bill.paymentInfo.matchingTransactionDate}</>
        ) : (
          <>Due {formatPayDate(bill.expectedDate)} ({getOrdinal(bill.dueDay)} of month)</>
        )}
      </p>
    </div>
  );
}
