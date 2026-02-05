import { Check, Clock, DollarSign, TrendingUp, AlertTriangle, Calendar, Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency } from '@/utils/financeUtils';
import { PendingCommission } from '@/types/finance';
import { Bill } from '@/types/bills';
import { 
  DashboardFinanceData, 
  BillWithStatus, 
  formatPayDate,
  getOrdinal,
} from '@/hooks/useFinanceCalculations';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ForecastColumnProps {
  dashboardFinance: DashboardFinanceData;
  currentBalance: number;
  nextCommission: PendingCommission | null;
  onUpdateBill?: (id: string, updates: Partial<Bill>) => void;
  onRemoveBill?: (id: string) => void;
}

export function ForecastColumn({
  dashboardFinance,
  currentBalance,
  nextCommission,
  onUpdateBill,
  onRemoveBill,
}: ForecastColumnProps) {
  const { paydayInfo, billsBeforePayday, projection } = dashboardFinance;

  return (
    <ScrollArea className="h-[calc(100vh-220px)]">
      <div className="space-y-4 pr-2">
        {/* Safe to Spend Card */}
        <SafeToSpendCard
          safeToSpend={projection.safeToSpend}
          isShort={projection.isShort}
        />

        {/* Projection Breakdown */}
        <ProjectionBreakdown
          currentBalance={projection.liquidityBalance}
          amountToKeep={projection.amountToKeep}
          commissionAmount={projection.commissionForProjection}
          projectedBalance={projection.projectedBalance}
          coveragePercent={projection.coveragePercent}
          isShort={projection.isShort}
          shortfall={projection.shortfall}
        />

        {/* Next Payday Info */}
        <NextPaydayCard
          paydayDate={paydayInfo.paydayDate}
          isFromCommission={paydayInfo.isFromCommission}
          pendingCount={projection.pendingCount}
          resolvedCount={projection.resolvedCount}
          periodLabel={paydayInfo.periodLabel}
        />

        {/* Bills Due List */}
        <BillsDueList bills={billsBeforePayday} onUpdateBill={onUpdateBill} onRemoveBill={onRemoveBill} />
      </div>
    </ScrollArea>
  );
}

// ============================================================================
// Safe to Spend Card
// ============================================================================

interface SafeToSpendCardProps {
  safeToSpend: number;
  isShort: boolean;
}

function SafeToSpendCard({ safeToSpend, isShort }: SafeToSpendCardProps) {
  return (
    <div className={`rounded-xl border-2 p-4 ${
      isShort 
        ? 'border-expense/30 bg-expense/5' 
        : 'border-income/30 bg-income/5'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className={`w-5 h-5 ${isShort ? 'text-expense' : 'text-income'}`} />
        <h3 className="font-semibold">Safe to Spend</h3>
      </div>
      <p className={`text-3xl font-bold font-mono ${
        isShort ? 'text-expense' : 'text-income'
      }`}>
        {formatCurrency(safeToSpend)}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        After covering unpaid bills
      </p>
      {isShort && (
        <div className="flex items-center gap-1 mt-2 text-expense text-xs">
          <AlertTriangle className="w-3 h-3" />
          <span>You need more funds to cover bills</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Projection Breakdown
// ============================================================================

interface ProjectionBreakdownProps {
  currentBalance: number;
  amountToKeep: number;
  commissionAmount: number;
  projectedBalance: number;
  coveragePercent: number;
  isShort: boolean;
  shortfall: number;
}

function ProjectionBreakdown({
  currentBalance,
  amountToKeep,
  commissionAmount,
  projectedBalance,
  coveragePercent,
  isShort,
  shortfall,
}: ProjectionBreakdownProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="text-sm font-semibold mb-3">Projection Breakdown</h4>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Current Liquidity</span>
          <span className="font-mono">{formatCurrency(currentBalance)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">− Amount to Keep</span>
          <span className="font-mono text-expense">−{formatCurrency(amountToKeep)}</span>
        </div>
        <div className="border-t border-border my-2" />
        <div className="flex justify-between">
          <span className="text-muted-foreground">= Safe to Spend</span>
          <span className={`font-mono font-semibold ${isShort ? 'text-expense' : 'text-income'}`}>
            {formatCurrency(currentBalance - amountToKeep)}
          </span>
        </div>
        {commissionAmount > 0 && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">+ Commission</span>
              <span className="font-mono text-income">+{formatCurrency(commissionAmount)}</span>
            </div>
            <div className="border-t border-border my-2" />
            <div className="flex justify-between">
              <span className="font-semibold">Projected Balance</span>
              <span className={`font-mono font-bold ${projectedBalance >= 0 ? 'text-income' : 'text-expense'}`}>
                {formatCurrency(projectedBalance)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Coverage Progress */}
      {amountToKeep > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Bill Coverage</span>
            <span className={isShort ? 'text-expense' : 'text-income'}>
              {coveragePercent}%
            </span>
          </div>
          <Progress
            value={coveragePercent}
            className={`h-2 ${isShort ? '[&>div]:bg-expense' : '[&>div]:bg-income'}`}
          />
          {isShort && (
            <p className="text-xs text-expense mt-1">
              Shortfall: {formatCurrency(shortfall)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Next Payday Card
// ============================================================================

interface NextPaydayCardProps {
  paydayDate: Date;
  isFromCommission: boolean;
  pendingCount: number;
  resolvedCount: number;
  periodLabel?: string;
}

function NextPaydayCard({ 
  paydayDate, 
  isFromCommission,
  pendingCount,
  resolvedCount,
  periodLabel,
}: NextPaydayCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold">Next Deposit</h4>
      </div>
      <p className="text-lg font-semibold">{formatPayDate(paydayDate)}</p>
      <p className="text-xs text-muted-foreground">
        {isFromCommission 
          ? 'Based on expected commission' 
          : periodLabel 
            ? `${periodLabel} • 4th business day after cutoff`
            : 'Calculated from contract schedule'
        }
      </p>
      <div className="flex gap-2 mt-3">
        <Badge variant="outline" className="text-xs">
          {pendingCount} pending
        </Badge>
        {resolvedCount > 0 && (
          <Badge variant="secondary" className="text-xs text-income">
            {resolvedCount} paid
          </Badge>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Bills Due List
// ============================================================================

interface BillsDueListProps {
  bills: BillWithStatus[];
  onUpdateBill?: (id: string, updates: Partial<Bill>) => void;
  onRemoveBill?: (id: string) => void;
}

function BillsDueList({ bills, onUpdateBill, onRemoveBill }: BillsDueListProps) {
  const unpaidBills = bills.filter((b) => !b.isResolved);
  const paidBills = bills.filter((b) => b.isResolved);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="text-sm font-semibold mb-3">Bills Due Before Deposit</h4>

      {bills.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No bills due before next payday
        </p>
      ) : (
        <div className="space-y-2">
          {/* Unpaid Bills */}
          {unpaidBills.map((bill) => (
            <BillRow key={bill.id} bill={bill} onUpdateBill={onUpdateBill} onRemoveBill={onRemoveBill} />
          ))}

          {/* Paid Bills */}
          {paidBills.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground uppercase tracking-wider pt-2">
                Paid This Month
              </div>
              {paidBills.map((bill) => (
                <BillRow key={bill.id} bill={bill} onUpdateBill={onUpdateBill} onRemoveBill={onRemoveBill} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface BillRowProps {
  bill: BillWithStatus;
  onUpdateBill?: (id: string, updates: Partial<Bill>) => void;
  onRemoveBill?: (id: string) => void;
}

function BillRow({ bill, onUpdateBill, onRemoveBill }: BillRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editAmount, setEditAmount] = useState(bill.amount.toString());
  const [editDueDay, setEditDueDay] = useState(bill.dueDay.toString());

  const handleSave = () => {
    if (onUpdateBill) {
      onUpdateBill(bill.id, {
        amount: parseFloat(editAmount) || bill.amount,
        dueDay: parseInt(editDueDay) || bill.dueDay,
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditAmount(bill.amount.toString());
    setEditDueDay(bill.dueDay.toString());
    setIsEditing(false);
  };

  return (
    <div
      className={`flex items-center justify-between p-2 rounded text-xs group ${
        bill.isResolved
          ? 'bg-income/10 border border-income/20'
          : 'bg-muted/50'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {bill.isResolved ? (
          <Check className="w-3 h-3 text-income flex-shrink-0" />
        ) : (
          <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className={`font-medium truncate ${bill.isResolved ? 'line-through text-muted-foreground' : ''}`}>
            {bill.vendor}
          </p>
          <p className="text-muted-foreground">
            {bill.isResolved ? 'Paid' : `Due ${getOrdinal(bill.dueDay)}`}
            {bill.type === 'one-time' && ' • One-time'}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        <span className={`font-mono font-semibold ${
          bill.isResolved ? 'text-income line-through' : 'text-expense'
        }`}>
          {formatCurrency(bill.amount)}
        </span>
        
        {/* Edit/Delete controls */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
          <Popover open={isEditing} onOpenChange={setIsEditing}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="w-3 h-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="end">
              <div className="space-y-3">
                <div className="text-sm font-medium">{bill.vendor}</div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Amount</label>
                    <Input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="h-8 text-sm"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Due Day</label>
                    <Input
                      type="number"
                      value={editDueDay}
                      onChange={(e) => setEditDueDay(e.target.value)}
                      className="h-8 text-sm"
                      min="1"
                      max="31"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleSave}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onRemoveBill?.(bill.id)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
