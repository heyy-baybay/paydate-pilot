import { CalendarCheck, ArrowRight } from 'lucide-react';
import { getPayPeriods } from '@/utils/financeUtils';

interface PayPeriodInfoProps {
  selectedMonth: string | null;
}

export function PayPeriodInfo({ selectedMonth }: PayPeriodInfoProps) {
  const today = new Date();
  const year = selectedMonth 
    ? parseInt(selectedMonth.split('-')[0]) 
    : today.getFullYear();
  const month = selectedMonth 
    ? parseInt(selectedMonth.split('-')[1]) - 1 
    : today.getMonth();

  const periods = getPayPeriods(year, month);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const monthName = new Date(year, month).toLocaleDateString('en-US', { 
    month: 'long',
    year: 'numeric' 
  });

  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 mb-4">
        <CalendarCheck className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Pay Period Schedule</h3>
      </div>
      
      <p className="text-xs text-muted-foreground mb-4">{monthName}</p>

      <div className="space-y-4">
        {periods.map((period, index) => (
          <div key={index} className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Period {index + 1}
            </p>
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Cutoff</span>
                <span className="font-medium">{formatDate(period.cutoffDate)}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Calculated</span>
                <span className="font-medium">{formatDate(period.calculationDate)}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-income">Payment</span>
                <span className="font-medium text-income">{formatDate(period.paymentDate)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Transactions between payment and next cutoff are marked with pay period impact.
      </p>
    </div>
  );
}
