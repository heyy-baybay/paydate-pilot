import { useState } from 'react';
import { format } from 'date-fns';
import { 
  DollarSign, 
  Calendar as CalendarIcon, 
  Plus, 
  X, 
  TrendingUp, 
  ChevronDown,
  ChevronUp,
  Sparkles,
  Trash2,
  Calculator,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/financeUtils';
import { PendingCommission } from '@/types/finance';
import { Bill, SuggestedVendor } from '@/types/bills';
import { getOrdinal } from '@/hooks/useFinanceCalculations';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { calculateCommission, CommissionBreakdown } from '@/utils/commissionCalculator';
import { ContractInfo } from './ContractInfo';
import { getNextScheduledPaymentDate, formatPaymentDate } from '@/utils/businessDays';

interface InputsColumnProps {
  commissions: PendingCommission[];
  onAddCommission: (commission: Omit<PendingCommission, 'id'>) => void;
  onRemoveCommission: (id: string) => void;
  bills: Bill[];
  onAddBill: (bill: Omit<Bill, 'id'>) => void;
  suggestedVendors: SuggestedVendor[];
  onAddFromSuggestion: (suggestion: SuggestedVendor) => void;
  onDismissSuggestion: (vendor: string) => void;
  onUpdateBill: (id: string, updates: Partial<Bill>) => void;
  onRemoveBill: (id: string) => void;
  ignoredVendorCount: number;
  onRestoreIgnoredVendors: () => void;
  onUploadCSV: (content: string) => void;
}

export function InputsColumn({
  commissions,
  onAddCommission,
  onRemoveCommission,
  bills,
  onAddBill,
  suggestedVendors,
  onAddFromSuggestion,
  onDismissSuggestion,
  onUpdateBill,
  onRemoveBill,
  ignoredVendorCount,
  onRestoreIgnoredVendors,
  onUploadCSV,
}: InputsColumnProps) {
  const [currentBreakdown, setCurrentBreakdown] = useState<CommissionBreakdown | null>(null);

  return (
    <ScrollArea className="h-[calc(100vh-220px)]">
      <div className="space-y-4 pr-2">
        {/* Contract Info Widget */}
        <ContractInfo currentBreakdown={currentBreakdown} />

        {/* Commission Entry with Calculator */}
        <CommissionEntry
          commissions={commissions}
          onAdd={onAddCommission}
          onRemove={onRemoveCommission}
          onBreakdownChange={setCurrentBreakdown}
        />

        {/* One-Time Bill Entry */}
        <OneTimeBillEntry onAddBill={onAddBill} />

        {/* My Bills Manager */}
        <BillsManager
          bills={bills}
          suggestedVendors={suggestedVendors}
          onAddFromSuggestion={onAddFromSuggestion}
          onDismissSuggestion={onDismissSuggestion}
          onUpdateBill={onUpdateBill}
          onRemoveBill={onRemoveBill}
          ignoredVendorCount={ignoredVendorCount}
          onRestoreIgnoredVendors={onRestoreIgnoredVendors}
        />
      </div>
    </ScrollArea>
  );
}

// ============================================================================
// Commission Entry Component
// ============================================================================

interface CommissionEntryProps {
  commissions: PendingCommission[];
  onAdd: (commission: Omit<PendingCommission, 'id'>) => void;
  onRemove: (id: string) => void;
  onBreakdownChange: (breakdown: CommissionBreakdown | null) => void;
}

function CommissionEntry({ commissions, onAdd, onRemove, onBreakdownChange }: CommissionEntryProps) {
  const [useCalculator, setUseCalculator] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [grossProfit, setGrossProfit] = useState('');
  const [grossRevenue, setGrossRevenue] = useState('');
  const [expectedDate, setExpectedDate] = useState<Date | undefined>();
  
  // Get next scheduled payment date for default
  const nextScheduledPayment = getNextScheduledPaymentDate();

  const calculatedBreakdown = (() => {
    if (!useCalculator) return null;
    const gp = parseFloat(grossProfit) || 0;
    const gr = parseFloat(grossRevenue) || 0;
    if (gp <= 0) return null;
    return calculateCommission({ grossProfit: gp, grossRevenue: gr });
  })();

  // Update parent with breakdown
  useState(() => {
    onBreakdownChange(calculatedBreakdown);
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalAmount: number;
    if (useCalculator && calculatedBreakdown) {
      finalAmount = calculatedBreakdown.netPayout;
    } else {
      finalAmount = parseFloat(manualAmount);
    }
    
    if (isNaN(finalAmount) || finalAmount <= 0) {
      toast.error('Please enter valid amounts');
      return;
    }
    
    const depositDate = expectedDate || nextScheduledPayment.paymentDate;
    const year = depositDate.getFullYear();
    const month = String(depositDate.getMonth() + 1).padStart(2, '0');
    const day = String(depositDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    onAdd({
      amount: finalAmount,
      expectedDate: dateString,
      cutoffDate: '',
    });
    
    // Reset form
    setManualAmount('');
    setGrossProfit('');
    setGrossRevenue('');
    setExpectedDate(undefined);
    onBreakdownChange(null);
    toast.success('Commission added');
  };

  const upcomingCommissions = commissions.filter((c) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return c.expectedDate >= todayStr;
  });

  return (
    <div className="rounded-xl border border-income/20 bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-income" />
          <h3 className="font-semibold">Expected Commission</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 text-xs",
            useCalculator && "bg-primary/10"
          )}
          onClick={() => {
            setUseCalculator(!useCalculator);
            onBreakdownChange(null);
          }}
        >
          <Calculator className="w-3 h-3 mr-1" />
          {useCalculator ? 'Manual' : 'Calculate'}
        </Button>
      </div>

      {/* Existing Commissions */}
      {upcomingCommissions.length > 0 && (
        <div className="space-y-2 mb-4">
          {upcomingCommissions.map((c) => (
            <div 
              key={c.id} 
              className="flex items-center justify-between p-2 rounded-lg bg-income/10 group"
            >
              <div>
                <p className="font-mono font-semibold text-income">
                  {formatCurrency(c.amount)}
                </p>
                <p className="text-xs text-muted-foreground">{c.expectedDate}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(c.id)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {useCalculator ? (
          <>
            {/* Calculator Mode */}
            <div className="space-y-1">
              <Label className="text-xs">Gross Profit</Label>
              <div className="relative">
                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="45000"
                  value={grossProfit}
                  onChange={(e) => {
                    setGrossProfit(e.target.value);
                    const gp = parseFloat(e.target.value) || 0;
                    const gr = parseFloat(grossRevenue) || 0;
                    if (gp > 0) {
                      onBreakdownChange(calculateCommission({ grossProfit: gp, grossRevenue: gr }));
                    }
                  }}
                  className="h-8 pl-7 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Gross Revenue (for bad debt reserve)</Label>
              <div className="relative">
                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="150000"
                  value={grossRevenue}
                  onChange={(e) => {
                    setGrossRevenue(e.target.value);
                    const gp = parseFloat(grossProfit) || 0;
                    const gr = parseFloat(e.target.value) || 0;
                    if (gp > 0) {
                      onBreakdownChange(calculateCommission({ grossProfit: gp, grossRevenue: gr }));
                    }
                  }}
                  className="h-8 pl-7 text-sm"
                />
              </div>
            </div>
            {calculatedBreakdown && (
              <div className="p-2 rounded bg-income/10 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Rate: {calculatedBreakdown.commissionRatePercent}%</span>
                  <span>Raw: {formatCurrency(calculatedBreakdown.rawCommission)}</span>
                </div>
                <div className="flex justify-between text-expense">
                  <span>Bad Debt (1%)</span>
                  <span>−{formatCurrency(calculatedBreakdown.badDebtReserve)}</span>
                </div>
                <div className="flex justify-between font-semibold text-income border-t border-income/20 pt-1">
                  <span>Net Payout</span>
                  <span>{formatCurrency(calculatedBreakdown.netPayout)}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Manual Mode */}
            <div className="space-y-1">
              <Label className="text-xs">Payout Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="15987.04"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  className="h-8 pl-7 text-sm"
                />
              </div>
            </div>
          </>
        )}
        
        <div className="space-y-1">
          <Label className="text-xs">Expected Deposit Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full h-8 justify-start text-left font-normal text-sm",
                  !expectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {expectedDate 
                  ? format(expectedDate, "PPP") 
                  : `Next: ${formatPaymentDate(nextScheduledPayment.paymentDate)}`
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={expectedDate}
                onSelect={setExpectedDate}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <p className="text-[10px] text-muted-foreground">
            {nextScheduledPayment.periodLabel} • 4th business day after cutoff
          </p>
        </div>
        <Button 
          type="submit" 
          size="sm" 
          className="w-full h-8"
          disabled={useCalculator ? !calculatedBreakdown : !manualAmount}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Commission
        </Button>
      </form>
    </div>
  );
}

// ============================================================================
// One-Time Bill Entry Component
// ============================================================================

interface OneTimeBillEntryProps {
  onAddBill: (bill: Omit<Bill, 'id'>) => void;
}

function OneTimeBillEntry({ onAddBill }: OneTimeBillEntryProps) {
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState(String(new Date().getDate()));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!vendor.trim() || isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter vendor and amount');
      return;
    }

    onAddBill({
      vendor: vendor.trim(),
      amount: numAmount,
      dueDay: parseInt(dueDay) || 1,
      category: 'Miscellaneous',
      active: true,
      type: 'one-time',
      isResolved: false,
    });

    setVendor('');
    setAmount('');
    setDueDay(String(new Date().getDate()));
    toast.success('One-time bill added');
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Plus className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Add One-Time Bill</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Vendor</Label>
          <Input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="e.g., Car Repair"
            className="h-8 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="150.00"
                className="h-8 pl-7 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Due Day</Label>
            <Input
              type="number"
              min="1"
              max="31"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
        <Button type="submit" variant="secondary" size="sm" className="w-full h-8">
          Add Bill
        </Button>
      </form>
    </div>
  );
}

// ============================================================================
// Bills Manager Component
// ============================================================================

interface BillsManagerProps {
  bills: Bill[];
  suggestedVendors: SuggestedVendor[];
  onAddFromSuggestion: (suggestion: SuggestedVendor) => void;
  onDismissSuggestion: (vendor: string) => void;
  onUpdateBill: (id: string, updates: Partial<Bill>) => void;
  onRemoveBill: (id: string) => void;
  ignoredVendorCount: number;
  onRestoreIgnoredVendors: () => void;
}

function BillsManager({
  bills,
  suggestedVendors,
  onAddFromSuggestion,
  onDismissSuggestion,
  onUpdateBill,
  onRemoveBill,
  ignoredVendorCount,
  onRestoreIgnoredVendors,
}: BillsManagerProps) {
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showBills, setShowBills] = useState(true);

  const activeBills = bills.filter((b) => b.active);
  const totalMonthly = activeBills.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">My Bills</h3>
        <Badge variant="secondary" className="font-mono text-xs">
          {formatCurrency(totalMonthly)}/mo
        </Badge>
      </div>

      <div className="space-y-3">
        {/* Suggestions */}
        {suggestedVendors.length > 0 && (
          <Collapsible open={showSuggestions} onOpenChange={setShowSuggestions}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full flex items-center justify-between p-2 h-auto bg-primary/5 hover:bg-primary/10 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-xs font-medium">
                    {suggestedVendors.length} Suggestions
                  </span>
                </div>
                {showSuggestions ? (
                  <ChevronUp className="w-3 h-3 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-1">
                {suggestedVendors.slice(0, 5).map((s) => (
                  <div
                    key={s.vendor}
                    className="flex items-center justify-between p-2 rounded bg-muted/50 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{s.vendor}</p>
                      <p className="text-muted-foreground">
                        ~{formatCurrency(s.avgAmount)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          onAddFromSuggestion(s);
                          toast.success('Added');
                        }}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-muted-foreground"
                        onClick={() => onDismissSuggestion(s.vendor)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Active Bills */}
        <Collapsible open={showBills} onOpenChange={setShowBills}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-2 h-auto"
            >
              <span className="text-xs font-medium">
                {activeBills.length} Active Bills
              </span>
              {showBills ? (
                <ChevronUp className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-1">
              {activeBills.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No bills yet
                </p>
              ) : (
                activeBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between p-2 rounded bg-muted/50 text-xs group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="font-medium truncate">{bill.vendor}</p>
                        {bill.type === 'one-time' && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            1x
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground">
                        {formatCurrency(bill.amount)} • {getOrdinal(bill.dueDay)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-expense"
                      onClick={() => onRemoveBill(bill.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Restore ignored */}
        {ignoredVendorCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs text-muted-foreground"
            onClick={onRestoreIgnoredVendors}
          >
            Restore {ignoredVendorCount} ignored vendors
          </Button>
        )}
      </div>
    </div>
  );
}
