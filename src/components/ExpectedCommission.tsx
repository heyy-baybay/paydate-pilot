import { useState } from 'react';
import { DollarSign, Calendar, Plus, X, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/utils/financeUtils';
import { PendingCommission } from '@/types/finance';
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0 || !expectedDate) return;
    
    onAdd({
      amount: numAmount,
      expectedDate: new Date(expectedDate),
      cutoffDate: cutoffDate || 'Unknown',
    });
    
    setAmount('');
    setExpectedDate('');
    setCutoffDate('');
    setOpen(false);
  };

  // Get next commission if any
  // Safely coerce expectedDate to Date (could be string from localStorage)
  const now = new Date();
  const nextCommission = commissions
    .filter(c => new Date(c.expectedDate) >= now)
    .sort((a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime())[0];

  const totalPending = commissions.reduce((sum, c) => sum + c.amount, 0);

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
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
        <Dialog open={open} onOpenChange={setOpen}>
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

          {/* Commission List */}
          <div className="space-y-2">
            {commissions.map((commission) => (
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

          {commissions.length > 1 && (
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
