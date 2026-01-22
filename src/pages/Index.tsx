import { useState, useMemo, useEffect } from 'react';
import { Wallet } from 'lucide-react';
import { CSVUploader } from '@/components/CSVUploader';
import { TransactionTable } from '@/components/TransactionTable';
import { SummaryCards } from '@/components/SummaryCards';
import { MonthFilter } from '@/components/MonthFilter';
import { BalanceSettings } from '@/components/BalanceSettings';
import { RecurringSummary } from '@/components/RecurringSummary';
import { PayPeriodInfo } from '@/components/PayPeriodInfo';
import { UpcomingBillsBeforePayday } from '@/components/UpcomingBillsBeforePayday';
import { ExpectedCommission, PendingCommission } from '@/components/ExpectedCommission';
import { Transaction, FinanceSettings } from '@/types/finance';
import { 
  parseCSV, 
  processTransactions, 
  getUniqueMonths,
  generateMonthSummary 
} from '@/utils/financeUtils';

const STORAGE_KEYS = {
  RAW_DATA: 'cashflow_raw_data',
  SETTINGS: 'cashflow_settings',
  COMMISSIONS: 'cashflow_commissions',
  OVERRIDES: 'cashflow_overrides',
};

// Helper to safely parse stored commissions (dates need to be converted back)
const parseStoredCommissions = (stored: string | null): PendingCommission[] => {
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return parsed.map((c: any) => ({
      ...c,
      expectedDate: new Date(c.expectedDate),
      cutoffDate: new Date(c.cutoffDate),
    }));
  } catch {
    return [];
  }
};

const Index = () => {
  const [rawData, setRawData] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEYS.RAW_DATA);
  });
  const [settings, setSettings] = useState<FinanceSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return { startingBalance: 0, lowBalanceThreshold: 500, selectedMonth: null };
      }
    }
    return { startingBalance: 0, lowBalanceThreshold: 500, selectedMonth: null };
  });
  const [pendingCommissions, setPendingCommissions] = useState<PendingCommission[]>(() => {
    return parseStoredCommissions(localStorage.getItem(STORAGE_KEYS.COMMISSIONS));
  });
  const [transactionOverrides, setTransactionOverrides] = useState<Record<string, Partial<Pick<Transaction, 'category' | 'isRecurring'>>>>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.OVERRIDES);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return {};
      }
    }
    return {};
  });

  // Persist data to localStorage whenever it changes
  useEffect(() => {
    if (rawData) {
      localStorage.setItem(STORAGE_KEYS.RAW_DATA, rawData);
    } else {
      localStorage.removeItem(STORAGE_KEYS.RAW_DATA);
    }
  }, [rawData]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COMMISSIONS, JSON.stringify(pendingCommissions));
  }, [pendingCommissions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.OVERRIDES, JSON.stringify(transactionOverrides));
  }, [transactionOverrides]);

  // Process transactions whenever raw data or settings change
  const transactions = useMemo<Transaction[]>(() => {
    if (!rawData) return [];
    const parsed = parseCSV(rawData);
    return processTransactions(parsed, settings.startingBalance);
  }, [rawData, settings.startingBalance]);

  // Apply overrides to transactions
  const transactionsWithOverrides = useMemo(() => {
    return transactions.map(tx => ({
      ...tx,
      ...transactionOverrides[tx.id]
    }));
  }, [transactions, transactionOverrides]);

  // Get unique months for filter
  const uniqueMonths = useMemo(() => {
    return getUniqueMonths(transactions);
  }, [transactions]);

  // Filter transactions by selected month (use overrides)
  const filteredTransactions = useMemo(() => {
    if (!settings.selectedMonth) return transactionsWithOverrides;
    
    return transactionsWithOverrides.filter(tx => {
      const [year, month] = settings.selectedMonth!.split('-');
      const txDate = new Date(tx.date);
      return (
        txDate.getFullYear() === parseInt(year) &&
        txDate.getMonth() + 1 === parseInt(month)
      );
    });
  }, [transactionsWithOverrides, settings.selectedMonth]);

  // Generate summary for selected month (use overrides)
  const monthSummaries = useMemo(() => {
    return generateMonthSummary(transactionsWithOverrides);
  }, [transactionsWithOverrides]);

  const currentSummary = useMemo(() => {
    if (!settings.selectedMonth) {
      return monthSummaries[0] || null;
    }
    const [year, month] = settings.selectedMonth.split('-').map(Number);
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    return monthSummaries.find(s => s.month === monthName && s.year === year) || null;
  }, [monthSummaries, settings.selectedMonth]);

  // Get current balance (most recent transaction)
  const currentBalance = transactions[0]?.runningBalance || settings.startingBalance;

  const handleCSVUpload = (content: string) => {
    console.log('[CSVUpload] Replacing data');
    setRawData(content);
    // Auto-detect starting balance from oldest transaction
    const parsed = parseCSV(content);
    if (parsed.length > 0) {
      const oldest = parsed[parsed.length - 1];
      const inferredStart = oldest.balance - oldest.amount;
      setSettings(s => ({ ...s, startingBalance: inferredStart }));
    }
  };

  const handleAddCommission = (commission: Omit<PendingCommission, 'id'>) => {
    setPendingCommissions(prev => [...prev, {
      ...commission,
      id: `commission-${Date.now()}`,
    }]);
  };

  const handleRemoveCommission = (id: string) => {
    setPendingCommissions(prev => prev.filter(c => c.id !== id));
  };

  const handleUpdateTransaction = (id: string, updates: Partial<Pick<Transaction, 'category' | 'isRecurring'>>) => {
    setTransactionOverrides(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  };

  // Get next expected commission
  const nextCommission = pendingCommissions
    .filter(c => c.expectedDate >= new Date())
    .sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime())[0] || null;

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
                  onMonthChange={(month) => setSettings(s => ({ ...s, selectedMonth: month }))}
                />
                <BalanceSettings
                  startingBalance={settings.startingBalance}
                  lowBalanceThreshold={settings.lowBalanceThreshold}
                  onStartingBalanceChange={(val) => setSettings(s => ({ ...s, startingBalance: val }))}
                  onThresholdChange={(val) => setSettings(s => ({ ...s, lowBalanceThreshold: val }))}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Upload Section */}
        {transactions.length === 0 ? (
          <div className="max-w-xl mx-auto py-12 animate-fade-in">
            <CSVUploader onUpload={handleCSVUpload} hasData={false} />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <SummaryCards 
              summary={currentSummary} 
              currentBalance={currentBalance}
            />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Transaction Table */}
              <div className="lg:col-span-3">
                <TransactionTable 
                  transactions={filteredTransactions}
                  lowBalanceThreshold={settings.lowBalanceThreshold}
                  onUpdateTransaction={handleUpdateTransaction}
                />
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <CSVUploader onUpload={handleCSVUpload} hasData={true} />
                <ExpectedCommission 
                  commissions={pendingCommissions}
                  onAdd={handleAddCommission}
                  onRemove={handleRemoveCommission}
                />
                <UpcomingBillsBeforePayday 
                  transactions={transactionsWithOverrides}
                  currentBalance={currentBalance}
                  selectedMonth={settings.selectedMonth}
                  nextCommission={nextCommission}
                  onUpdateTransaction={handleUpdateTransaction}
                />
                <PayPeriodInfo selectedMonth={settings.selectedMonth} />
                <RecurringSummary transactions={filteredTransactions} />
              </div>
            </div>
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
