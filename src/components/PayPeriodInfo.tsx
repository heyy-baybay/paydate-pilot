import { CalendarCheck, ArrowRight, TrendingUp } from 'lucide-react';
import { PendingCommission } from '@/types/finance';
import { usePayPeriodsWithCommission } from '@/hooks/useCommissionManager';
import { Badge } from '@/components/ui/badge';

interface PayPeriodInfoProps {
  selectedMonth: string | null;
  nextCommission?: PendingCommission | null;
}

export function PayPeriodInfo({ selectedMonth, nextCommission = null }: PayPeriodInfoProps) {
  const { periods, monthLabel, isCommissionBased } = usePayPeriodsWithCommission(
    nextCommission,
    selectedMonth
  );

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const today = new Date();

  // Determine which period is "active" (next payment hasn't happened yet)
  const getPaymentStatus = (paymentDate: Date) => {
    if (paymentDate < today) return 'past';
    
    // Check if this matches the commission date
    if (nextCommission) {
      const commDate = new Date(nextCommission.expectedDate);
      const payDay = paymentDate.toDateString();
      const commDay = commDate.toDateString();
      if (payDay === commDay) return 'commission';
    }
    
    return 'upcoming';
  };

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Pay Period Schedule</h3>
        </div>
        {isCommissionBased && (
          <Badge variant="secondary" className="text-xs">
            <TrendingUp className="w-3 h-3 mr-1" />
            Commission
          </Badge>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground mb-4">{monthLabel}</p>

      <div className="space-y-4">
        {periods.map((period, index) => {
          const status = getPaymentStatus(period.paymentDate);
          const isPast = status === 'past';
          const isCommission = status === 'commission';
          
          return (
            <div 
              key={index} 
              className={`p-3 rounded-lg transition-colors ${
                isCommission 
                  ? 'bg-income/10 border border-income/20' 
                  : isPast 
                    ? 'bg-muted/30 opacity-60' 
                    : 'bg-muted/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Period {index + 1}
                </p>
                {isCommission && nextCommission && (
                  <span className="text-xs font-mono text-income font-semibold">
                    +${nextCommission.amount.toLocaleString()}
                  </span>
                )}
                {isPast && (
                  <span className="text-xs text-muted-foreground">Completed</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Cutoff</span>
                  <span className={`font-medium ${isPast ? 'text-muted-foreground' : ''}`}>
                    {formatDate(period.cutoffDate)}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Calculated</span>
                  <span className={`font-medium ${isPast ? 'text-muted-foreground' : ''}`}>
                    {formatDate(period.calculationDate)}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className={`text-xs ${isCommission ? 'text-income' : 'text-income'}`}>
                    Payment
                  </span>
                  <span className={`font-medium ${
                    isCommission ? 'text-income font-semibold' : isPast ? 'text-muted-foreground' : 'text-income'
                  }`}>
                    {formatDate(period.paymentDate)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Transactions between payment and next cutoff are marked with pay period impact.
      </p>
    </div>
  );
}
