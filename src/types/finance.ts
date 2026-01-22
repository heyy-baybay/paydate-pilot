export interface RawTransaction {
  details: string;
  postingDate: string;
  description: string;
  amount: number;
  type: string;
  balance: number;
  checkOrSlip?: string;
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

export type TransactionCategory = 
  | 'Subscriptions'
  | 'Fuel'
  | 'Software'
  | 'Suppliers'
  | 'Utilities'
  | 'Transfers'
  | 'Fees'
  | 'Income'
  | 'Taxes'
  | 'Insurance'
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
