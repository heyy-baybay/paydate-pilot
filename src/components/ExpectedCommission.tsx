import { useState } from 'react';
import { DollarSign, Calendar, Plus, X, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/utils/financeUtils';
import { PendingCommission } from '@/types/finance';
import {
  useCommissionStatus,
  useAdvanceCommission,
  getNextPayPeriodDate,
  formatCutoffDescription,
  formatDateForInput,
  parseLocalDate,
} from '@/hooks/useCommissionManager';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export type { PendingCommission };

interface ExpectedCommissionProps {
  commissions: PendingCommission[];
  onAdd: (commission: Omit<PendingCommission, 'id'>) => void;
  onRemove: (id: string) => void;
}

export function ExpectedCommission({ commissions, onAdd, onRemove }: ExpectedCommissionProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [cutoffDate, setCutoffDate] = useState('');

  const { upcoming, expired, nextCommission, hasExpired } = useCommissionStatus(commissions);
  const { advanceToNextPeriod } = useAdvanceCommission(onAdd, onRemove);

  // Pre-fill next period date when opening dialog
  const handleOpenDialog = (isOpen: boolean) => {
    if (isOpen && !expectedDate) {
      const nextPeriod = getNextPayPeriodDate(new Date());
      // Use formatDateForInput to avoid UTC timezone shift
      setExpectedDate(formatDateForInput(nextPeriod.paymentDate));
      setCutoffDate(formatCutoffDescription(nextPeriod));
    }
    setOpen(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0 || !expectedDate) return;
    
    onAdd({
      amount: numAmount,
      // Use parseLocalDate to create proper local date
      expectedDate: parseLocalDate(expectedDate),
      cutoffDate: cutoffDate || 'Unknown',
    });
    
    setAmount('');
    setExpectedDate('');
    setCutoffDate('');
    setOpen(false);
  };

  const totalPending = upcoming.reduce((sum, c) => sum + c.amount, 0);

  const formatDate = (date: Date | string) => {
    // Use parseLocalDate to ensure correct local date handling
    const d = parseLocalDate(date);
    return d.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="stat-card border-2 border-income/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-income" />
          <h3 className="font-semibold">Expected Commission</h3>
        </div>
        <Dialog open={open} onOpenChange={handleOpenDialog}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Expected Commission</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Payout Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="15987.04"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectedDate">Expected Deposit Date</Label>
                <Input
                  id="expectedDate"
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cutoffDate">Cutoff Period (optional)</Label>
                <Input
                  id="cutoffDate"
                  type="text"
                  placeholder="Through Jan 15, 2026"
                  value={cutoffDate}
                  onChange={(e) => setCutoffDate(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                Add Commission
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Expired Commissions Alert */}
      {hasExpired && (
        <div className="mb-4 space-y-2">
          {expired.map((commission) => (
            <div 
              key={commission.id}
              className="p-3 rounded-lg bg-warning/10 border border-warning/30"
            >
              <div className="flex items-start gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-warning">
                    Commission date passed
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(commission.amount)} was expected {formatDate(commission.expectedDate)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs flex-1 border-warning/30 hover:bg-warning/10"
                  onClick={() => advanceToNextPeriod(commission)}
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear Expired
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => onRemove(commission.id)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {commissions.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            No pending commissions entered
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Add your expected payout from commission statements
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Next Commission Highlight */}
          {nextCommission && (
            <div className="p-3 rounded-lg bg-income/10 border border-income/20">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Next Deposit
              </p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold font-mono text-income">
                    {formatCurrency(nextCommission.amount)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(nextCommission.expectedDate)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Commission List */}
          {upcoming.length > 1 && (
            <div className="space-y-2">
              {upcoming.slice(1).map((commission) => (
                <div 
                  key={commission.id}
                  className="flex items-center justify-between p-2 rounded bg-muted/50 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-mono font-medium text-income">
                        {formatCurrency(commission.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatDate(commission.expectedDate)}
                        {commission.cutoffDate && ` • ${commission.cutoffDate}`}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemove(commission.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {upcoming.length > 1 && (
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total Pending</span>
                <span className="font-mono font-semibold text-income">
                  {formatCurrency(totalPending)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
