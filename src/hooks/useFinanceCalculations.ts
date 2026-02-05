import { useMemo } from 'react';
import { Bill, BillType } from '@/types/bills';
import { PendingCommission, Transaction } from '@/types/finance';
import { getPayPeriods, normalizeVendor, extractVendorName } from '@/utils/financeUtils';

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
 * Format a Date to YYYY-MM-DD string.
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

/**
 * Normalize vendor key for matching.
 */
function vendorKey(vendor: string): string {
  return normalizeVendor(vendor).trim().toLowerCase();
}

/**
 * Check if a transaction is an expense.
 */
function isExpenseTx(tx: Transaction): boolean {
  return tx.amount < 0 || (tx.amount > 0 && (tx.type || '').toLowerCase().includes('debit'));
}

// ============================================================================
// BILL RESOLUTION LOGIC (Single Source of Truth)
// ============================================================================

export interface BillResolutionStatus {
  billId: string;
  isResolved: boolean;
  matchingTransactionId?: string;
  matchingTransactionDate?: string;
  matchingTransactionAmount?: number;
}

/**
 * Detect which bills have been paid this month by matching transactions.
 * A bill is "resolved" if a transaction exists in the current month with
 * a normalized vendor name matching the bill's vendor.
 */
export function resolveBillsFromTransactions(
  bills: Bill[],
  transactions: Transaction[]
): Map<string, BillResolutionStatus> {
  const statusMap = new Map<string, BillResolutionStatus>();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

  // Get current month expenses
  const currentMonthExpenses = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    return txDate >= monthStart && txDate <= monthEnd && isExpenseTx(tx);
  });

  // Build vendor -> transactions lookup
  const vendorTxMap = new Map<string, Transaction[]>();
  currentMonthExpenses.forEach((tx) => {
    const key = vendorKey(extractVendorName(tx.description) || tx.description);
    const existing = vendorTxMap.get(key) || [];
    existing.push(tx);
    vendorTxMap.set(key, existing);
  });

  // Check each bill
  bills.forEach((bill) => {
    if (!bill.active) return;

    const billKey = vendorKey(bill.vendor);
    const matchingTxs = vendorTxMap.get(billKey) || [];

    // Find best match (closest amount)
    let bestMatch: Transaction | null = null;
    let bestDiff = Infinity;

    matchingTxs.forEach((tx) => {
      const diff = Math.abs(Math.abs(tx.amount) - bill.amount);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestMatch = tx;
      }
    });

    statusMap.set(bill.id, {
      billId: bill.id,
      isResolved: !!bestMatch,
      matchingTransactionId: bestMatch?.id,
      matchingTransactionDate: bestMatch?.date,
      matchingTransactionAmount: bestMatch ? Math.abs(bestMatch.amount) : undefined,
    });
  });

  return statusMap;
}

// ============================================================================
// PAYDAY CALCULATION
// ============================================================================

export interface PaydayInfo {
  paydayDate: Date;
  paydayDateString: string;
  paydayCutoffEnd: Date;
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

    // Use commission date if available and in the future
    const commissionDate = nextCommission?.expectedDate
      ? parseLocalDate(nextCommission.expectedDate)
      : null;

    const isFromCommission = !!(commissionDate && commissionDate >= todayStart);
    const paydayDate = isFromCommission ? commissionDate! : nextPayPeriod!.paymentDate;
    const paydayCutoffEnd = endOfDay(paydayDate);

    return {
      paydayDate,
      paydayDateString: formatDateString(paydayDate),
      paydayCutoffEnd,
      isFromCommission,
    };
  }, [nextCommission]);
}

// ============================================================================
// BILLS DUE BEFORE PAYDAY
// ============================================================================

export interface BillWithStatus extends Bill {
  expectedDate: Date;
  isResolved: boolean;
  matchInfo?: BillResolutionStatus;
}

/**
 * Calculate which bills are due before the next payday, with resolution status.
 */
export function useBillsBeforePayday(
  bills: Bill[],
  transactions: Transaction[],
  paydayCutoffEnd: Date | null
): BillWithStatus[] {
  return useMemo(() => {
    if (!paydayCutoffEnd) return [];

    const todayStart = startOfDay(new Date());
    const activeBills = bills.filter((b) => b.active);
    const resolutionMap = resolveBillsFromTransactions(bills, transactions);
    const result: BillWithStatus[] = [];

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

      // If already passed this month, move to next month (for recurring)
      if (expectedDate < todayStart && bill.type !== 'one-time') {
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

      // Include if within range (today to payday)
      if (expectedDate >= todayStart && expectedDate <= paydayCutoffEnd) {
        const matchInfo = resolutionMap.get(bill.id);
        result.push({
          ...bill,
          expectedDate,
          isResolved: matchInfo?.isResolved || false,
          matchInfo,
        });
      }
    });

    // Sort by expected date
    return result.sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());
  }, [bills, transactions, paydayCutoffEnd]);
}

// ============================================================================
// FINANCIAL PROJECTIONS (The Core Math)
// ============================================================================

export interface FinancialProjection {
  /** Sum of all UNRESOLVED bills due before payday */
  amountToKeep: number;
  /** Current Balance - Amount to Keep */
  safeToSpend: number;
  /** Safe to Spend + Expected Commission */
  projectedBalance: number;
  /** Number of bills resolved */
  resolvedCount: number;
  /** Number of bills still pending */
  pendingCount: number;
  /** Coverage percentage (0-100) */
  coveragePercent: number;
  /** Whether there's a shortfall */
  isShort: boolean;
  /** Shortfall amount if any */
  shortfall: number;
}

/**
 * Calculate financial projections using ONLY unresolved bills.
 * 
 * Formulas:
 * - Amount to Keep = Sum of bills where isResolved === false AND dueDay <= nextCommission date
 * - Safe to Spend = Current Balance - Amount to Keep
 * - Projected Balance = Safe to Spend + Commission Amount
 */
export function useFinancialProjection(
  billsBeforePayday: BillWithStatus[],
  currentBalance: number,
  nextCommission: PendingCommission | null
): FinancialProjection {
  return useMemo(() => {
    // Only include UNRESOLVED bills in Amount to Keep
    const unresolvedBills = billsBeforePayday.filter((b) => !b.isResolved);
    const resolvedBills = billsBeforePayday.filter((b) => b.isResolved);

    const amountToKeep = unresolvedBills.reduce((sum, bill) => sum + bill.amount, 0);
    const safeToSpend = currentBalance - amountToKeep;
    const commissionAmount = nextCommission?.amount || 0;
    const projectedBalance = safeToSpend + commissionAmount;

    const shortfall = Math.max(0, amountToKeep - currentBalance);
    const isShort = shortfall > 0;
    const coveragePercent =
      amountToKeep > 0 ? Math.min(100, Math.round((currentBalance / amountToKeep) * 100)) : 100;

    return {
      amountToKeep,
      safeToSpend,
      projectedBalance,
      resolvedCount: resolvedBills.length,
      pendingCount: unresolvedBills.length,
      coveragePercent,
      isShort,
      shortfall,
    };
  }, [billsBeforePayday, currentBalance, nextCommission]);
}

// ============================================================================
// COMBINED HOOK FOR DASHBOARD
// ============================================================================

export interface DashboardFinanceData {
  paydayInfo: PaydayInfo;
  billsBeforePayday: BillWithStatus[];
  projection: FinancialProjection;
}

/**
 * Combined hook that provides all finance calculation data for the dashboard.
 */
export function useDashboardFinance(
  bills: Bill[],
  transactions: Transaction[],
  currentBalance: number,
  nextCommission: PendingCommission | null
): DashboardFinanceData {
  const paydayInfo = useNextPayday(nextCommission);
  const billsBeforePayday = useBillsBeforePayday(bills, transactions, paydayInfo.paydayCutoffEnd);
  const projection = useFinancialProjection(billsBeforePayday, currentBalance, nextCommission);

  return {
    paydayInfo,
    billsBeforePayday,
    projection,
  };
}
