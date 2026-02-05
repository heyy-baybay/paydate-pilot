import { useMemo } from 'react';
import { Bill } from '@/types/bills';
import { Transaction } from '@/types/finance';
import { normalizeVendor } from '@/utils/financeUtils';

/**
 * Normalize vendor key for matching.
 */
function vendorKey(vendor: string): string {
  return normalizeVendor(vendor).trim().toLowerCase();
}

/**
 * Get the start of the current month.
 */
function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get the end of the current month.
 */
function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export interface BillPaymentStatus {
  billId: string;
  vendor: string;
  isPaid: boolean;
  matchingTransactionId?: string;
  matchingTransactionDate?: string;
  matchingTransactionAmount?: number;
}

/**
 * Detect which bills have been paid in the current month based on transaction history.
 * A bill is considered "paid" if a transaction with a matching normalized vendor name
 * exists in the current month.
 */
export function useBillPaymentDetection(
  bills: Bill[],
  transactions: Transaction[]
): Map<string, BillPaymentStatus> {
  return useMemo(() => {
    const statusMap = new Map<string, BillPaymentStatus>();
    const today = new Date();
    const monthStart = getMonthStart(today);
    const monthEnd = getMonthEnd(today);

    // Get transactions from current month that are expenses
    const currentMonthExpenses = transactions.filter((tx) => {
      const txDate = new Date(tx.date);
      const isInMonth = txDate >= monthStart && txDate <= monthEnd;
      const isExpense = tx.amount < 0 || (tx.amount > 0 && (tx.type || '').toLowerCase().includes('debit'));
      return isInMonth && isExpense;
    });

    // Build a map of vendor keys to transactions for quick lookup
    const vendorTransactionMap = new Map<string, Transaction[]>();
    currentMonthExpenses.forEach((tx) => {
      const key = vendorKey(tx.description);
      const existing = vendorTransactionMap.get(key) || [];
      existing.push(tx);
      vendorTransactionMap.set(key, existing);
    });

    // Check each bill for a matching transaction
    bills.forEach((bill) => {
      if (!bill.active) return;

      const billVendorKey = vendorKey(bill.vendor);
      const matchingTxs = vendorTransactionMap.get(billVendorKey) || [];
      
      // Find the best match (closest amount)
      let bestMatch: Transaction | null = null;
      let bestDiff = Infinity;

      matchingTxs.forEach((tx) => {
        const txAmount = Math.abs(tx.amount);
        const diff = Math.abs(txAmount - bill.amount);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestMatch = tx;
        }
      });

      statusMap.set(bill.id, {
        billId: bill.id,
        vendor: bill.vendor,
        isPaid: !!bestMatch,
        matchingTransactionId: bestMatch?.id,
        matchingTransactionDate: bestMatch?.date,
        matchingTransactionAmount: bestMatch ? Math.abs(bestMatch.amount) : undefined,
      });
    });

    return statusMap;
  }, [bills, transactions]);
}

/**
 * Filter bills to only include unpaid ones in the current month.
 */
export function useUnpaidBills(
  bills: Bill[],
  paymentStatusMap: Map<string, BillPaymentStatus>
): Bill[] {
  return useMemo(() => {
    return bills.filter((bill) => {
      if (!bill.active) return false;
      const status = paymentStatusMap.get(bill.id);
      return !status?.isPaid;
    });
  }, [bills, paymentStatusMap]);
}
