import { useState, useEffect, useMemo } from 'react';
import { Bill, SuggestedVendor } from '@/types/bills';
import { Transaction } from '@/types/finance';
import { extractVendorName } from '@/utils/financeUtils';

const STORAGE_KEY = 'cashflow_my_bills';

export function useBills(transactions: Transaction[]) {
  const [bills, setBills] = useState<Bill[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
  }, [bills]);

  // Find vendors that appear 2+ times as expenses but aren't in "My Bills" yet
  const suggestedVendors = useMemo<SuggestedVendor[]>(() => {
    const existingVendors = new Set(bills.map(b => b.vendor.toLowerCase()));
    
    // Group transactions by vendor
    const vendorMap = new Map<string, { 
      amounts: number[]; 
      dates: Date[]; 
      category: string;
      lastSeen: Date;
    }>();

    transactions.forEach(tx => {
      // Only consider expenses
      const isExpense = tx.amount < 0 || 
        (tx.amount > 0 && (tx.type || '').toLowerCase().includes('debit'));
      
      if (!isExpense) return;

      const vendor = extractVendorName(tx.description).toUpperCase();
      
      // Skip if already in My Bills
      if (existingVendors.has(vendor.toLowerCase())) return;

      const txDate = new Date(tx.date);
      const existing = vendorMap.get(vendor);
      
      if (existing) {
        existing.amounts.push(Math.abs(tx.amount));
        existing.dates.push(txDate);
        if (txDate > existing.lastSeen) {
          existing.lastSeen = txDate;
          existing.category = tx.category;
        }
      } else {
        vendorMap.set(vendor, {
          amounts: [Math.abs(tx.amount)],
          dates: [txDate],
          category: tx.category,
          lastSeen: txDate,
        });
      }
    });

    // Filter to vendors with 2+ occurrences
    const suggestions: SuggestedVendor[] = [];
    
    vendorMap.forEach((data, vendor) => {
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
        vendor,
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
  }, [transactions, bills]);

  const addBill = (bill: Omit<Bill, 'id'>) => {
    setBills(prev => [...prev, { ...bill, id: `bill-${Date.now()}` }]);
  };

  const updateBill = (id: string, updates: Partial<Bill>) => {
    setBills(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBill = (id: string) => {
    setBills(prev => prev.filter(b => b.id !== id));
  };

  const addFromSuggestion = (suggestion: SuggestedVendor) => {
    addBill({
      vendor: suggestion.vendor,
      amount: suggestion.avgAmount,
      dueDay: suggestion.suggestedDueDay,
      category: suggestion.category,
      active: true,
    });
  };

  return {
    bills,
    suggestedVendors,
    addBill,
    updateBill,
    removeBill,
    addFromSuggestion,
  };
}
