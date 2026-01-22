import { TrendingDown, TrendingUp, RotateCcw, Wallet } from 'lucide-react';
import { formatCurrency } from '@/utils/financeUtils';
import { MonthSummary } from '@/types/finance';

interface SummaryCardsProps {
  summary: MonthSummary | null;
  currentBalance: number;
}

export function SummaryCards({ summary, currentBalance }: SummaryCardsProps) {
  const stats = [
    {
      label: 'Current Balance',
      value: formatCurrency(currentBalance),
      icon: Wallet,
      trend: currentBalance >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Total Income',
      value: formatCurrency(summary?.totalIncome || 0),
      icon: TrendingUp,
      trend: 'positive',
    },
    {
      label: 'Total Expenses',
      value: formatCurrency(Math.abs(summary?.totalExpenses || 0)),
      icon: TrendingDown,
      trend: 'negative',
    },
    {
      label: 'Recurring Expenses',
      value: formatCurrency(Math.abs(summary?.recurringExpenses || 0)),
      icon: RotateCcw,
      trend: 'neutral',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const isNegativeBalance = stat.label === 'Current Balance' && currentBalance < 0;
        
        return (
          <div 
            key={stat.label} 
            className={`stat-card animate-fade-in ${
              isNegativeBalance ? 'border-expense bg-expense/5' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </p>
                <p className={`text-2xl font-bold mt-1 font-mono ${
                  isNegativeBalance ? 'text-expense' :
                  stat.trend === 'positive' ? 'text-income' : 
                  stat.trend === 'negative' ? 'text-expense' : 
                  'text-foreground'
                }`}>
                  {stat.value}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${
                isNegativeBalance ? 'bg-expense/10' :
                stat.trend === 'positive' ? 'bg-income/10' : 
                stat.trend === 'negative' ? 'bg-expense/10' : 
                'bg-muted'
              }`}>
                <stat.icon className={`w-5 h-5 ${
                  isNegativeBalance ? 'text-expense' :
                  stat.trend === 'positive' ? 'text-income' : 
                  stat.trend === 'negative' ? 'text-expense' : 
                  'text-muted-foreground'
                }`} />
              </div>
            </div>
            {summary && (
              <p className="text-xs text-muted-foreground mt-2">
                {summary.transactionCount} transactions in {summary.month}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
