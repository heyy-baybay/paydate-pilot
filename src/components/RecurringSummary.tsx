import { RefreshCw, Calendar } from 'lucide-react';
import { Transaction } from '@/types/finance';
import { formatCurrency } from '@/utils/financeUtils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RecurringSummaryProps {
  transactions: Transaction[];
}

export function RecurringSummary({ transactions }: RecurringSummaryProps) {
  const recurringExpenses = transactions.filter(
    tx => tx.isRecurring && tx.amount < 0
  );

  // Group by vendor/description pattern
  const vendorMap = new Map<string, { total: number; count: number; avgAmount: number }>();
  
  recurringExpenses.forEach(tx => {
    const vendor = tx.description.split(/\s+/).slice(0, 2).join(' ').toUpperCase();
    const existing = vendorMap.get(vendor);
    
    if (existing) {
      existing.total += Math.abs(tx.amount);
      existing.count += 1;
      existing.avgAmount = existing.total / existing.count;
    } else {
      vendorMap.set(vendor, {
        total: Math.abs(tx.amount),
        count: 1,
        avgAmount: Math.abs(tx.amount),
      });
    }
  });

  const sortedVendors = Array.from(vendorMap.entries())
    .sort((a, b) => b[1].avgAmount - a[1].avgAmount);

  const totalMonthlyRecurring = sortedVendors.reduce(
    (sum, [, data]) => sum + data.avgAmount,
    0
  );

  if (sortedVendors.length === 0) {
    return null;
  }

  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 mb-4">
        <RefreshCw className="w-5 h-5 text-recurring" />
        <h3 className="font-semibold">Recurring Expenses</h3>
      </div>
      
      <div className="mb-4 pb-4 border-b border-border">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Expected Monthly Total</p>
        <p className="text-2xl font-bold font-mono text-expense">
          {formatCurrency(totalMonthlyRecurring)}
        </p>
      </div>

      <ScrollArea className="h-[200px] pr-4">
        <div className="space-y-3">
          {sortedVendors.map(([vendor, data]) => (
            <div key={vendor} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate" title={vendor}>
                  {vendor}
                </span>
                {data.count > 1 && (
                  <span className="text-xs text-muted-foreground">
                    ×{data.count}
                  </span>
                )}
              </div>
              <span className="font-mono text-sm font-medium text-expense flex-shrink-0">
                {formatCurrency(data.avgAmount)}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
