import { useState, useEffect, useMemo } from 'react';
import { Bill, SuggestedVendor } from '@/types/bills';
import { Transaction } from '@/types/finance';
import { extractVendorName, normalizeVendor } from '@/utils/financeUtils';

const STORAGE_KEY = 'cashflow_my_bills';
const DISMISSED_KEY = 'cashflow_dismissed_bill_suggestions';
const IGNORED_KEY = 'cashflow_ignored_vendors';

/**
 * Lovable/Vite previews can sometimes run in environments where `window` is not available.
 * Guard all localStorage access so we never crash with "localStorage is not defined".
 */
function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function safeGet(key: string): string | null {
  if (!canUseStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeKey(vendorLike: string): string {
  return normalizeVendor(vendorLike).trim().toLowerCase();
}

function isExpenseTx(tx: Transaction): boolean {
  return (
    tx.amount < 0 ||
    (tx.amount > 0 && (tx.type || '').toLowerCase().includes('debit'))
  );
}

export function useBills(transactions: Transaction[]) {
  const [bills, setBills] = useState<Bill[]>(() => {
    const stored = safeGet(STORAGE_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  });

  const [dismissedSuggestions, setDismissedSuggestions] = useState<Record<string, boolean>>(() => {
    const stored = safeGet(DISMISSED_KEY);
    if (!stored) return {};
    try {
      return JSON.parse(stored);
    } catch {
      return {};
    }
  });

  /**
   * Ignored vendors:
   * - hides vendor from suggestions
   * - prevents vendor from being re-added after you remove it from My Bills
   */
  const [ignoredVendors, setIgnoredVendors] = useState<Record<string, boolean>>(() => {
    const stored = safeGet(IGNORED_KEY);
    if (!stored) return {};
    try {
      return JSON.parse(stored);
    } catch {
      return {};
    }
  });

  // Persist to localStorage (guarded)
  useEffect(() => {
    safeSet(STORAGE_KEY, JSON.stringify(bills));
  }, [bills]);

  useEffect(() => {
    safeSet(DISMISSED_KEY, JSON.stringify(dismissedSuggestions));
  }, [dismissedSuggestions]);

  useEffect(() => {
    safeSet(IGNORED_KEY, JSON.stringify(ignoredVendors));
  }, [ignoredVendors]);

  const dismissSuggestion = (vendor: string) => {
    const key = safeKey(vendor);
    setDismissedSuggestions((prev) => ({ ...prev, [key]: true }));
  };

  const ignoreVendor = (vendor: string) => {
    const key = safeKey(vendor);
    setIgnoredVendors((prev) => ({ ...prev, [key]: true }));
  };

  const unignoreVendor = (vendor: string) => {
    const key = safeKey(vendor);
    setIgnoredVendors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const restoreAllSuggestions = () => {
    setDismissedSuggestions({});
  };

  const restoreAllIgnoredVendors = () => {
    setIgnoredVendors({});
  };

  // Find vendors that appear 2+ times as expenses but aren't in "My Bills" yet
  const suggestedVendors = useMemo<SuggestedVendor[]>(() => {
    const existingVendorKeys = new Set(bills.map(b => safeKey(b.vendor)));
    const dismissed = new Set(Object.keys(dismissedSuggestions).filter(k => dismissedSuggestions[k]));
    const ignored = new Set(Object.keys(ignoredVendors).filter(k => ignoredVendors[k]));

    // Group transactions by vendor key
    const vendorMap = new Map<string, { 
      vendorLabel: string;
      amounts: number[]; 
      dates: Date[]; 
      category: string;
      lastSeen: Date;
    }>();

    transactions.forEach(tx => {
      // Only consider expenses (negative amounts). Debit handling differs per bank export, but
      // Chase exports generally use negative for expenses.
      const isExpense = tx.amount < 0 || 
        (tx.amount > 0 && (tx.type || '').toLowerCase().includes('debit'));

      if (!isExpense) return;

      const vendorKey = safeKey(tx.description);
      const vendorLabel = normalizeVendor(tx.description); // normalized but display-friendly

      // Skip if already in My Bills
      if (existingVendorKeys.has(vendorKey)) return;

      // Skip if user dismissed/ignored this suggestion
      if (dismissed.has(vendorKey)) return;
      if (ignored.has(vendorKey)) return;

      const txDate = new Date(tx.date);
      const existing = vendorMap.get(vendorKey);

      if (existing) {
        existing.amounts.push(Math.abs(tx.amount));
        existing.dates.push(txDate);
        if (txDate > existing.lastSeen) {
          existing.lastSeen = txDate;
          existing.category = tx.category;
        }
      } else {
        vendorMap.set(vendorKey, {
          vendorLabel,
          amounts: [Math.abs(tx.amount)],
          dates: [txDate],
          category: tx.category,
          lastSeen: txDate,
        });
      }
    });

    // Filter to vendors with 2+ occurrences
    const suggestions: SuggestedVendor[] = [];

    vendorMap.forEach((data, vendorKey) => {
      if (data.amounts.length < 2) return;

      // Calculate average amount
      const avgAmount = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length;

      // Find most common day of month
      const dayCounts = new Map<number, number>();
      data.dates.forEach(d => {
        const day = d.getDate();
        dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
      });
      let suggestedDueDay = 1;
      let maxCount = 0;
      dayCounts.forEach((count, day) => {
        if (count > maxCount) {
          maxCount = count;
          suggestedDueDay = day;
        }
      });

      suggestions.push({
        vendor: data.vendorLabel,
        avgAmount: Math.round(avgAmount * 100) / 100,
        occurrences: data.amounts.length,
        lastSeen: data.lastSeen.toISOString().split('T')[0],
        suggestedDueDay,
        category: data.category,
      });
    });

    // Sort by occurrences desc, then amount desc
    return suggestions.sort((a, b) => {
      if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
      return b.avgAmount - a.avgAmount;
    });
  }, [transactions, bills, dismissedSuggestions, ignoredVendors]);

  const addBill = (bill: Omit<Bill, 'id'>) => {
    setBills(prev => [...prev, { ...bill, id: `bill-${Date.now()}` }]);
  };

  /**
   * Add a bill directly from a transaction (used by the TransactionTable recurring toggle flow).
   * - Uses extractVendorName() to handle ACH-style descriptions like:
   *   "ORIG CO NAME:Sana Benefits ... IND NAME:Tuckey Trucking ..."
   * - De-dupes by vendor key so repeated toggles don't create duplicates.
   */
  const addBillFromTransaction = (tx: Transaction) => {
    if (!isExpenseTx(tx)) return;

    const vendor = (extractVendorName(tx.description) || normalizeVendor(tx.description)).trim();
    if (!vendor) return;

    const amount = Math.round(Math.abs(tx.amount) * 100) / 100;
    const dueDay = new Date(tx.date).getDate();
    const vendorKey = safeKey(vendor);

    setBills((prev) => {
      const exists = prev.some((b) => safeKey(b.vendor) === vendorKey && b.active);
      if (exists) return prev;
      return [
        ...prev,
        {
          id: `bill-${Date.now()}`,
          vendor,
          amount,
          dueDay,
          category: tx.category,
          active: true,
        },
      ];
    });
  };

  const updateBill = (id: string, updates: Partial<Bill>) => {
    setBills(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  /**
   * Remove bill AND ignore the vendor so it won't immediately come back as a suggestion.
   */
  const removeBill = (id: string) => {
    setBills(prev => {
      const bill = prev.find(b => b.id === id);
      if (bill) ignoreVendor(bill.vendor);
      return prev.filter(b => b.id !== id);
    });
  };

  const addFromSuggestion = (suggestion: SuggestedVendor) => {
    const newBill = {
      vendor: suggestion.vendor,
      amount: suggestion.avgAmount,
      dueDay: suggestion.suggestedDueDay,
      category: suggestion.category,
      active: true,
    };
    addBill(newBill);
  };

  return {
    bills,
    suggestedVendors,
    addBill,
    addBillFromTransaction,
    updateBill,
    removeBill,
    addFromSuggestion,
    dismissSuggestion,
    restoreAllSuggestions,
    ignoredVendors,
    ignoreVendor,
    unignoreVendor,
    restoreAllIgnoredVendors,
  };
}
