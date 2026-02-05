import { useMemo, useCallback } from 'react';
import { PendingCommission, PayPeriod } from '@/types/finance';
import { getPayPeriods } from '@/utils/financeUtils';

/**
 * Get the start of day (midnight) for a date.
 */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export interface CommissionStatus {
  upcoming: PendingCommission[];
  expired: PendingCommission[];
  nextCommission: PendingCommission | null;
  hasExpired: boolean;
}

/**
 * Calculate the next pay period payment date from a given date.
 */
export function getNextPayPeriodDate(fromDate: Date): PayPeriod {
  const today = startOfDay(fromDate);
  
  let periods = getPayPeriods(today.getFullYear(), today.getMonth());
  let nextPeriod = periods.find((p) => p.paymentDate > today);
  
  if (!nextPeriod) {
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
 * Parse a date string (YYYY-MM-DD) into a local Date object.
 * Avoids UTC interpretation which can shift the date by a day.
 */
export function parseLocalDate(dateInput: Date | string): Date {
  if (typeof dateInput === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [year, month, day] = dateInput.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    const d = new Date(dateInput);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
}

/**
 * Format a Date to YYYY-MM-DD string for input fields.
 */
export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
      const expDate = parseLocalDate(c.expectedDate);
      if (expDate < today) {
        expired.push(c);
      } else {
        upcoming.push(c);
      }
    });
    
    // Sort upcoming by date
    upcoming.sort((a, b) => 
      parseLocalDate(a.expectedDate).getTime() - parseLocalDate(b.expectedDate).getTime()
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
 * Clear an expired commission (just removes it without copying the amount).
 */
export function useAdvanceCommission(
  _onAdd: (commission: Omit<PendingCommission, 'id'>) => void,
  onRemove: (id: string) => void
) {
  const advanceToNextPeriod = useCallback(
    (expiredCommission: PendingCommission) => {
      onRemove(expiredCommission.id);
    },
    [onRemove]
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
    
    let year: number;
    let month: number;
    
    if (selectedMonth) {
      year = parseInt(selectedMonth.split('-')[0]);
      month = parseInt(selectedMonth.split('-')[1]) - 1;
    } else if (nextCommission) {
      const commDate = parseLocalDate(nextCommission.expectedDate);
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
