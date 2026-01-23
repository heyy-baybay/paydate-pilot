import { useMemo, useCallback } from 'react';
import { PendingCommission, PayPeriod } from '@/types/finance';
import { getPayPeriods } from '@/utils/financeUtils';
import { startOfDay } from './useFinanceCalculations';

export interface CommissionStatus {
  /** Commission entries that are still upcoming */
  upcoming: PendingCommission[];
  /** Commission entries that have passed their expected date */
  expired: PendingCommission[];
  /** The next upcoming commission (if any) */
  nextCommission: PendingCommission | null;
  /** Whether there are expired commissions that need attention */
  hasExpired: boolean;
}

/**
 * Calculate the next pay period payment date from a given date.
 */
export function getNextPayPeriodDate(fromDate: Date): PayPeriod {
  const today = startOfDay(fromDate);
  
  // Check current month's periods
  let periods = getPayPeriods(today.getFullYear(), today.getMonth());
  let nextPeriod = periods.find((p) => p.paymentDate > today);
  
  if (!nextPeriod) {
    // Move to next month
    const nextMonth = today.getMonth() === 11 ? 0 : today.getMonth() + 1;
    const nextYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
    periods = getPayPeriods(nextYear, nextMonth);
    nextPeriod = periods[0];
  }
  
  return nextPeriod!;
}

/**
 * Format a cutoff description for the pay period.
 */
export function formatCutoffDescription(period: PayPeriod): string {
  return `Through ${period.cutoffDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  })}`;
}

/**
 * Analyze commissions and identify expired ones.
 */
export function useCommissionStatus(commissions: PendingCommission[]): CommissionStatus {
  return useMemo(() => {
    const today = startOfDay(new Date());
    
    const upcoming: PendingCommission[] = [];
    const expired: PendingCommission[] = [];
    
    commissions.forEach((c) => {
      const expDate = startOfDay(new Date(c.expectedDate));
      if (expDate < today) {
        expired.push(c);
      } else {
        upcoming.push(c);
      }
    });
    
    // Sort upcoming by date
    upcoming.sort((a, b) => 
      new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime()
    );
    
    return {
      upcoming,
      expired,
      nextCommission: upcoming[0] || null,
      hasExpired: expired.length > 0,
    };
  }, [commissions]);
}

/**
 * Generate an advanced commission for the next pay period.
 */
export function useAdvanceCommission(
  onAdd: (commission: Omit<PendingCommission, 'id'>) => void,
  onRemove: (id: string) => void
) {
  const advanceToNextPeriod = useCallback(
    (expiredCommission: PendingCommission) => {
      const nextPeriod = getNextPayPeriodDate(new Date());
      
      // Add new commission with next period's payment date
      onAdd({
        amount: expiredCommission.amount,
        expectedDate: nextPeriod.paymentDate,
        cutoffDate: formatCutoffDescription(nextPeriod),
      });
      
      // Remove the expired one
      onRemove(expiredCommission.id);
    },
    [onAdd, onRemove]
  );

  return { advanceToNextPeriod };
}

/**
 * Get pay periods relevant to the current commission schedule.
 */
export function usePayPeriodsWithCommission(
  nextCommission: PendingCommission | null,
  selectedMonth: string | null
): { periods: PayPeriod[]; monthLabel: string; isCommissionBased: boolean } {
  return useMemo(() => {
    const today = new Date();
    
    // Determine which month to show
    let year: number;
    let month: number;
    
    if (selectedMonth) {
      year = parseInt(selectedMonth.split('-')[0]);
      month = parseInt(selectedMonth.split('-')[1]) - 1;
    } else if (nextCommission) {
      // Show the month of the next commission
      const commDate = new Date(nextCommission.expectedDate);
      year = commDate.getFullYear();
      month = commDate.getMonth();
    } else {
      year = today.getFullYear();
      month = today.getMonth();
    }
    
    const periods = getPayPeriods(year, month);
    const monthLabel = new Date(year, month).toLocaleDateString('en-US', { 
      month: 'long',
      year: 'numeric' 
    });
    
    return {
      periods,
      monthLabel,
      isCommissionBased: !!nextCommission,
    };
  }, [nextCommission, selectedMonth]);
}
