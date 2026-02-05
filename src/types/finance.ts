export interface RawTransaction {
  details: string;
  postingDate: string;
  description: string;
  amount: number;
  type: string;
  balance: number;
  checkOrSlip?: string;
  qbCategory?: string; // QuickBooks "Account full name" for category mapping
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  isRecurring: boolean;
  category: TransactionCategory;
  payPeriodImpact: boolean;
  runningBalance: number;
  originalBalance: number;
}

// Categories aligned with QuickBooks account names
export type TransactionCategory = 
  | 'Gas'
  | 'Travel'
  | 'Legal & Accounting'
  | 'Office Supplies'
  | 'Software'
  | 'Repairs & Maintenance'
  | 'Postage'
  | 'Taxes & Registration'
  | 'Insurance'
  | 'Subscriptions'
  | 'Sales'
  | 'Owner\'s Contribution'
  | 'Owner\'s Distribution'
  | 'Transfers'
  | 'Fees'
  | 'Miscellaneous';

export interface PayPeriod {
  cutoffDate: Date;
  calculationDate: Date;
  paymentDate: Date;
}

export interface MonthSummary {
  month: string;
  year: number;
  totalExpenses: number;
  totalIncome: number;
  recurringExpenses: number;
  endingBalance: number;
  transactionCount: number;
  upcomingRecurring: Transaction[];
}

export interface FinanceSettings {
  startingBalance: number;
  lowBalanceThreshold: number;
  selectedMonth: string | null;
}

/**
 * Commission dates are stored as YYYY-MM-DD strings to prevent timezone issues.
 * Use parseLocalDate() when converting to Date objects.
 */
export interface PendingCommission {
  id: string;
  amount: number;
  /** Expected deposit date as YYYY-MM-DD string */
  expectedDate: string;
  /** Cutoff date description */
  cutoffDate: string;
}
