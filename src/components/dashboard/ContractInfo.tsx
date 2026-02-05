import { FileText, Percent, AlertCircle, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/utils/financeUtils';
import { CONTRACT_TERMS, CommissionBreakdown } from '@/utils/commissionCalculator';
import { Badge } from '@/components/ui/badge';

interface ContractInfoProps {
  currentBreakdown?: CommissionBreakdown | null;
}

export function ContractInfo({ currentBreakdown }: ContractInfoProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-sm">Contract Terms</h3>
      </div>

      <div className="space-y-3 text-xs">
        {/* Commission Rates */}
        <div className="p-2 rounded-lg bg-muted/50">
          <div className="flex items-center gap-1 mb-2">
            <Percent className="w-3 h-3 text-income" />
            <span className="font-medium">Commission Rates</span>
          </div>
          <div className="space-y-1 text-muted-foreground">
            <div className="flex justify-between">
              <span>GP ≤ {formatCurrency(CONTRACT_TERMS.gpThreshold)}</span>
              <span className="font-mono font-semibold text-foreground">
                {CONTRACT_TERMS.lowTierRate}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>GP &gt; {formatCurrency(CONTRACT_TERMS.gpThreshold)}</span>
              <span className="font-mono font-semibold text-foreground">
                {CONTRACT_TERMS.highTierRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Bad Debt Reserve */}
        <div className="p-2 rounded-lg bg-expense/5 border border-expense/10">
          <div className="flex items-center gap-1 mb-1">
            <AlertCircle className="w-3 h-3 text-expense" />
            <span className="font-medium">Bad Debt Reserve</span>
          </div>
          <p className="text-muted-foreground">
            {CONTRACT_TERMS.badDebtRate}% of Gross Revenue withheld
          </p>
        </div>

        {/* Current Breakdown (if provided) */}
        {currentBreakdown && (
          <div className="p-2 rounded-lg bg-income/5 border border-income/10">
            <div className="flex items-center gap-1 mb-2">
              <TrendingUp className="w-3 h-3 text-income" />
              <span className="font-medium">Current Period</span>
            </div>
            <div className="space-y-1 text-muted-foreground">
              <div className="flex justify-between">
                <span>Gross Profit</span>
                <span className="font-mono">{formatCurrency(currentBreakdown.grossProfit)}</span>
              </div>
              <div className="flex justify-between">
                <span>Rate Applied</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {currentBreakdown.commissionRatePercent}%
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Raw Commission</span>
                <span className="font-mono">{formatCurrency(currentBreakdown.rawCommission)}</span>
              </div>
              <div className="flex justify-between text-expense">
                <span>− Bad Debt Reserve</span>
                <span className="font-mono">−{formatCurrency(currentBreakdown.badDebtReserve)}</span>
              </div>
              <div className="border-t border-border pt-1 mt-1 flex justify-between font-semibold text-foreground">
                <span>Net Payout</span>
                <span className="font-mono text-income">
                  {formatCurrency(currentBreakdown.netPayout)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Payment Schedule */}
        <p className="text-muted-foreground text-[10px] leading-relaxed">
          Payments issued on the 4th business day after the 15th and last day of month.
        </p>
      </div>
    </div>
  );
}
