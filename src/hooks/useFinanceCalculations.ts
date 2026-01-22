import { useMemo } from 'react';
import { Bill } from '@/types/bills';
import { PendingCommission } from '@/types/finance';
import { getPayPeriods } from '@/utils/financeUtils';

/**
 * Get the start of day (midnight) for a date.
 */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Get the end of day (23:59:59.999) for a date.
 */
export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
export function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Format a date for display (e.g., "Mon, Jan 22")
 */
export function formatPayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export interface PaydayInfo {
  /** The date when the next payday occurs */
  paydayDate: Date;
  /** End of payday date for inclusive comparisons */
  paydayCutoffEnd: Date;
  /** Whether the payday is from a commission or calculated */
  isFromCommission: boolean;
}

/**
 * Calculate the next payday date based on commission or pay schedule.
 */
export function useNextPayday(nextCommission: PendingCommission | null): PaydayInfo {
  return useMemo(() => {
    const today = new Date();
    const todayStart = startOfDay(today);

    // Calculate next pay period from schedule
    const periods = getPayPeriods(today.getFullYear(), today.getMonth());
    let nextPayPeriod = periods.find((p) => p.paymentDate > today);

    if (!nextPayPeriod) {
      const nextMonth = today.getMonth() === 11 ? 0 : today.getMonth() + 1;
      const nextYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
      const nextPeriods = getPayPeriods(nextYear, nextMonth);
      nextPayPeriod = nextPeriods[0];
    }

    // Use commission date if provided and in future
    const commissionDate = nextCommission?.expectedDate
      ? new Date(nextCommission.expectedDate)
      : null;

    const isFromCommission = !!(commissionDate && commissionDate > today);
    const paydayDate = isFromCommission ? commissionDate! : nextPayPeriod!.paymentDate;
    const paydayCutoffEnd = endOfDay(paydayDate);

    return {
      paydayDate,
      paydayCutoffEnd,
      isFromCommission,
    };
  }, [nextCommission]);
}

export interface BillWithExpectedDate extends Bill {
  expectedDate: Date;
}

/**
 * Calculate which bills are due before the next payday.
 */
export function useBillsBeforePayday(
  bills: Bill[],
  paydayCutoffEnd: Date | null
): BillWithExpectedDate[] {
  return useMemo(() => {
    if (!paydayCutoffEnd) return [];

    const todayStart = startOfDay(new Date());
    const activeBills = bills.filter((b) => b.active);
    const result: BillWithExpectedDate[] = [];

    activeBills.forEach((bill) => {
      // Calculate expected date for this bill
      let expectedDate = new Date(
        todayStart.getFullYear(),
        todayStart.getMonth(),
        bill.dueDay
      );

      // Handle months with fewer days
      const lastDayOfMonth = new Date(
        expectedDate.getFullYear(),
        expectedDate.getMonth() + 1,
        0
      ).getDate();
      if (bill.dueDay > lastDayOfMonth) {
        expectedDate = new Date(
          expectedDate.getFullYear(),
          expectedDate.getMonth(),
          lastDayOfMonth
        );
      }

      // If already passed this month, move to next month
      if (expectedDate < todayStart) {
        expectedDate = new Date(
          todayStart.getFullYear(),
          todayStart.getMonth() + 1,
          bill.dueDay
        );
        const nextLastDay = new Date(
          expectedDate.getFullYear(),
          expectedDate.getMonth() + 1,
          0
        ).getDate();
        if (bill.dueDay > nextLastDay) {
          expectedDate = new Date(
            expectedDate.getFullYear(),
            expectedDate.getMonth(),
            nextLastDay
          );
        }
      }

      // Include if within range
      if (expectedDate >= todayStart && expectedDate <= paydayCutoffEnd) {
        result.push({ ...bill, expectedDate });
      }
    });

    // Sort by expected date
    return result.sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());
  }, [bills, paydayCutoffEnd]);
}

export interface FinancialProjection {
  /** Total amount needed for bills before payday */
  totalNeeded: number;
  /** Shortfall if balance is insufficient */
  shortfall: number;
  /** Whether there's a shortfall */
  isShort: boolean;
  /** Balance left after bills and commission */
  leftOverAfterBills: number;
  /** Coverage percentage (0-100) */
  coveragePercent: number;
}

/**
 * Calculate financial projections for bills due before payday.
 */
export function useFinancialProjection(
  billsBeforePayday: BillWithExpectedDate[],
  currentBalance: number,
  nextCommission: PendingCommission | null
): FinancialProjection {
  return useMemo(() => {
    const totalNeeded = billsBeforePayday.reduce((sum, bill) => sum + bill.amount, 0);
    const shortfall = Math.max(0, totalNeeded - currentBalance);
    const isShort = shortfall > 0;
    const leftOverAfterBills = nextCommission
      ? currentBalance - totalNeeded + nextCommission.amount
      : currentBalance - totalNeeded;
    const coveragePercent =
      totalNeeded > 0 ? Math.min(100, Math.round((currentBalance / totalNeeded) * 100)) : 100;

    return {
      totalNeeded,
      shortfall,
      isShort,
      leftOverAfterBills,
      coveragePercent,
    };
  }, [billsBeforePayday, currentBalance, nextCommission]);
}
