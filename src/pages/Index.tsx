import { useState, useMemo, useEffect } from 'react';
import { Wallet } from 'lucide-react';
import { CSVUploader } from '@/components/CSVUploader';
import { TransactionTable } from '@/components/TransactionTable';
import { SummaryCards } from '@/components/SummaryCards';
import { MonthFilter } from '@/components/MonthFilter';
import { BalanceSettings } from '@/components/BalanceSettings';
import { RecurringSummary } from '@/components/RecurringSummary';
import { PayPeriodInfo } from '@/components/PayPeriodInfo';
import { MyBills } from '@/components/MyBills';
import { BillForecast } from '@/components/BillForecast';
import { ExpectedCommission } from '@/components/ExpectedCommission';
import { useBills } from '@/hooks/useBills';
import { Transaction, FinanceSettings, PendingCommission } from '@/types/finance';
import { lsGet, lsSet, lsRemove, lsGetParsed, lsSetJson } from '@/hooks/useStorage';
import { parseLocalDate } from '@/hooks/useCommissionManager';
import {
  parseCSV,
  processTransactions,
  getUniqueMonths,
  generateMonthSummary,
} from '@/utils/financeUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const STORAGE_KEYS = {
  RAW_DATA: 'cashflow_raw_data',
  SETTINGS: 'cashflow_settings',
  COMMISSIONS: 'cashflow_commissions',
  OVERRIDES: 'cashflow_overrides',
} as const;

/**
 * Parse stored commissions, converting date strings back to Date objects.
 */
function parseStoredCommissions(stored: string | null): PendingCommission[] {
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return parsed.map((c: Record<string, unknown>) => ({
      ...c,
      // Use parseLocalDate to avoid timezone shifts
      expectedDate: parseLocalDate(c.expectedDate as string),
      cutoffDate: c.cutoffDate,
    }));
  } catch {
    return [];
  }
}

const Index = () => {
  // Raw CSV data
  const [rawData, setRawData] = useState<string | null>(() => lsGet(STORAGE_KEYS.RAW_DATA));

  // Finance settings
  const [settings, setSettings] = useState<FinanceSettings>(() =>
    lsGetParsed(STORAGE_KEYS.SETTINGS, {
      startingBalance: 0,
      lowBalanceThreshold: 500,
      selectedMonth: null,
    })
  );

  // Pending commissions
  const [pendingCommissions, setPendingCommissions] = useState<PendingCommission[]>(() =>
    parseStoredCommissions(lsGet(STORAGE_KEYS.COMMISSIONS))
  );

  // Transaction overrides (category, isRecurring)
  const [transactionOverrides, setTransactionOverrides] = useState<
    Record<string, Partial<Pick<Transaction, 'category' | 'isRecurring'>>>
  >(() => lsGetParsed(STORAGE_KEYS.OVERRIDES, {}));

  // Persist to localStorage
  useEffect(() => {
    if (rawData) {
      lsSet(STORAGE_KEYS.RAW_DATA, rawData);
    } else {
      lsRemove(STORAGE_KEYS.RAW_DATA);
    }
  }, [rawData]);

  useEffect(() => {
    lsSetJson(STORAGE_KEYS.SETTINGS, settings);
  }, [settings]);

  useEffect(() => {
    lsSetJson(STORAGE_KEYS.COMMISSIONS, pendingCommissions);
  }, [pendingCommissions]);

  useEffect(() => {
    lsSetJson(STORAGE_KEYS.OVERRIDES, transactionOverrides);
  }, [transactionOverrides]);

  // Process transactions
  const transactions = useMemo<Transaction[]>(() => {
    if (!rawData) return [];
    const parsed = parseCSV(rawData);
    return processTransactions(parsed, settings.startingBalance);
  }, [rawData, settings.startingBalance]);

  // Apply overrides
  const transactionsWithOverrides = useMemo(
    () =>
      transactions.map((tx) => ({
        ...tx,
        ...transactionOverrides[tx.id],
      })),
    [transactions, transactionOverrides]
  );

  // Unique months for filter
  const uniqueMonths = useMemo(() => getUniqueMonths(transactions), [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (!settings.selectedMonth) return transactionsWithOverrides;

    const [year, month] = settings.selectedMonth.split('-');
    return transactionsWithOverrides.filter((tx) => {
      const txDate = new Date(tx.date);
      return txDate.getFullYear() === parseInt(year) && txDate.getMonth() + 1 === parseInt(month);
    });
  }, [transactionsWithOverrides, settings.selectedMonth]);

  // Month summaries
  const monthSummaries = useMemo(
    () => generateMonthSummary(transactionsWithOverrides),
    [transactionsWithOverrides]
  );

  const currentSummary = useMemo(() => {
    if (!settings.selectedMonth) {
      return monthSummaries[0] || null;
    }
    const [year, month] = settings.selectedMonth.split('-').map(Number);
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    return monthSummaries.find((s) => s.month === monthName && s.year === year) || null;
  }, [monthSummaries, settings.selectedMonth]);

  // Current balance
  const currentBalance = transactions[0]?.runningBalance || settings.startingBalance;

  // Bills hook
  const {
    bills,
    suggestedVendors,
    addBill,
    addBillFromTransaction,
    updateBill,
    removeBill,
    addFromSuggestion,
    dismissSuggestion,
    ignoredVendors,
    restoreAllIgnoredVendors,
  } = useBills(transactionsWithOverrides);

  // Handlers
  const handleCSVUpload = (content: string) => {
    setRawData(content);
    const parsed = parseCSV(content);
    if (parsed.length > 0) {
      const oldest = parsed[parsed.length - 1];
      const inferredStart = oldest.balance - oldest.amount;
      setSettings((s) => ({ ...s, startingBalance: inferredStart }));
    }
  };

  const handleAddCommission = (commission: Omit<PendingCommission, 'id'>) => {
    setPendingCommissions((prev) => [
      ...prev,
      { ...commission, id: `commission-${Date.now()}` },
    ]);
  };

  const handleRemoveCommission = (id: string) => {
    setPendingCommissions((prev) => prev.filter((c) => c.id !== id));
  };

  const handleUpdateTransaction = (
    id: string,
    updates: Partial<Pick<Transaction, 'category' | 'isRecurring'>>
  ) => {
    // If marking as recurring, also create a bill entry using average from history
    if (updates.isRecurring === true) {
      const tx = transactionsWithOverrides.find((t) => t.id === id);
      if (tx && !tx.isRecurring) {
        addBillFromTransaction(tx, transactionsWithOverrides);
      }
    }

    // If updating category, also update the bill's category if exists
    if (updates.category) {
      const tx = transactionsWithOverrides.find((t) => t.id === id);
      if (tx) {
        // Find matching bill and update its category
        const matchingBill = bills.find(
          (b) => b.vendor.toLowerCase() === tx.description.toLowerCase() ||
                 b.vendor.toLowerCase().includes(tx.description.toLowerCase().slice(0, 10))
        );
        if (matchingBill) {
          updateBill(matchingBill.id, { category: updates.category });
        }
      }
    }

    setTransactionOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...updates },
    }));
  };

  // Next commission (timezone-safe; includes commissions dated "today")
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextCommission =
    pendingCommissions
      .filter((c) => parseLocalDate(c.expectedDate) >= todayStart)
      .sort(
        (a, b) =>
          parseLocalDate(a.expectedDate).getTime() - parseLocalDate(b.expectedDate).getTime()
      )[0] || null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">CashFlow Pro</h1>
                <p className="text-xs text-muted-foreground">Commission Pay Period Manager</p>
              </div>
            </div>

            {transactions.length > 0 && (
              <div className="flex items-center gap-3">
                <MonthFilter
                  months={uniqueMonths}
                  selectedMonth={settings.selectedMonth}
                  onMonthChange={(month) => setSettings((s) => ({ ...s, selectedMonth: month }))}
                />
                <BalanceSettings
                  startingBalance={settings.startingBalance}
                  lowBalanceThreshold={settings.lowBalanceThreshold}
                  onStartingBalanceChange={(val) =>
                    setSettings((s) => ({ ...s, startingBalance: val }))
                  }
                  onThresholdChange={(val) =>
                    setSettings((s) => ({ ...s, lowBalanceThreshold: val }))
                  }
                />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {transactions.length === 0 ? (
          <div className="max-w-xl mx-auto py-12 animate-fade-in">
            <CSVUploader onUpload={handleCSVUpload} hasData={false} />
          </div>
        ) : (
          <>
            <SummaryCards summary={currentSummary} currentBalance={currentBalance} />

            {/* Main Content Area with Tabs */}
            <Tabs defaultValue="forecast" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="forecast">Bill Forecast</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              {/* Bill Forecast Tab */}
              <TabsContent value="forecast" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Main Forecast Section */}
                  <div className="lg:col-span-2">
                    <BillForecast
                      bills={bills}
                      transactions={transactionsWithOverrides}
                      currentBalance={currentBalance}
                      nextCommission={nextCommission}
                      onAddCommission={handleAddCommission}
                    />
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-4">
                    <ExpectedCommission
                      commissions={pendingCommissions}
                      onAdd={handleAddCommission}
                      onRemove={handleRemoveCommission}
                    />
                    <MyBills
                      bills={bills}
                      suggestedVendors={suggestedVendors}
                      onAddBill={addBill}
                      onUpdateBill={updateBill}
                      onRemoveBill={removeBill}
                      onAddFromSuggestion={addFromSuggestion}
                      onDismissSuggestion={dismissSuggestion}
                      ignoredVendorCount={
                        Object.keys(ignoredVendors || {}).filter((k) => ignoredVendors[k]).length
                      }
                      onRestoreIgnoredVendors={restoreAllIgnoredVendors}
                    />
                    <PayPeriodInfo selectedMonth={settings.selectedMonth} nextCommission={nextCommission} />
                  </div>
                </div>
              </TabsContent>

              {/* Transactions Tab */}
              <TabsContent value="transactions" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-3">
                    <TransactionTable
                      transactions={filteredTransactions}
                      lowBalanceThreshold={settings.lowBalanceThreshold}
                      onUpdateTransaction={handleUpdateTransaction}
                    />
                  </div>
                  <div className="space-y-4">
                    <CSVUploader onUpload={handleCSVUpload} hasData={true} />
                    <RecurringSummary transactions={filteredTransactions} />
                  </div>
                </div>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-6">
                      <h3 className="font-semibold mb-4">Data Management</h3>
                      <CSVUploader onUpload={handleCSVUpload} hasData={true} />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-6">
                      <h3 className="font-semibold mb-4">Commission Management</h3>
                      <ExpectedCommission
                        commissions={pendingCommissions}
                        onAdd={handleAddCommission}
                        onRemove={handleRemoveCommission}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 mt-auto">
        <div className="container">
          <p className="text-xs text-muted-foreground text-center">
            Stay ahead of your expenses • Manage cash flow between commission payments
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
