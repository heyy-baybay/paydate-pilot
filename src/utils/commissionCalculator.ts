/**
 * Commission Calculator for Margin Freight Contractor Agreement
 * 
 * Commission Rates:
 * - 70% of Gross Profit if GP ≤ $50,000
 * - 75% of Gross Profit if GP > $50,000
 * 
 * Deductions:
 * - 1% of Gross Revenue as Bad Debt Reserve
 */

export interface CommissionInput {
  grossProfit: number;
  grossRevenue: number;
}

export interface CommissionBreakdown {
  grossProfit: number;
  grossRevenue: number;
  commissionRate: number; // 0.70 or 0.75
  commissionRatePercent: number; // 70 or 75
  rawCommission: number;
  badDebtReserve: number;
  badDebtReserveRate: number; // 0.01
  netPayout: number;
}

/**
 * Calculate commission payout following Margin Freight contract terms.
 */
export function calculateCommission(input: CommissionInput): CommissionBreakdown {
  const { grossProfit, grossRevenue } = input;
  
  // Determine commission rate based on gross profit threshold
  const GP_THRESHOLD = 50000;
  const commissionRate = grossProfit <= GP_THRESHOLD ? 0.70 : 0.75;
  
  // Calculate raw commission
  const rawCommission = grossProfit * commissionRate;
  
  // Calculate bad debt reserve (1% of gross revenue)
  const BAD_DEBT_RATE = 0.01;
  const badDebtReserve = grossRevenue * BAD_DEBT_RATE;
  
  // Net payout = commission - bad debt reserve
  const netPayout = Math.max(0, rawCommission - badDebtReserve);
  
  return {
    grossProfit,
    grossRevenue,
    commissionRate,
    commissionRatePercent: commissionRate * 100,
    rawCommission,
    badDebtReserve,
    badDebtReserveRate: BAD_DEBT_RATE,
    netPayout,
  };
}

/**
 * Get the commission rate for a given gross profit amount.
 */
export function getCommissionRate(grossProfit: number): { rate: number; percent: number; tier: string } {
  const GP_THRESHOLD = 50000;
  if (grossProfit <= GP_THRESHOLD) {
    return { rate: 0.70, percent: 70, tier: '≤$50k' };
  }
  return { rate: 0.75, percent: 75, tier: '>$50k' };
}

/**
 * Format contract terms for display.
 */
export const CONTRACT_TERMS = {
  gpThreshold: 50000,
  lowTierRate: 70, // percent
  highTierRate: 75, // percent
  badDebtRate: 1, // percent
  paymentSchedule: '4th business day after 15th and last day of month',
} as const;
