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

export interface PendingCommission {
  id: string;
  amount: number;
  expectedDate: Date;
  cutoffDate: string;
}
