export type BillType = 'recurring' | 'one-time';

export interface Bill {
  id: string;
  vendor: string;
  amount: number;
  /** Day of month (1-31) when this bill is typically due */
  dueDay: number;
  category: string;
  /** If true, this bill is active and should be included in projections */
  active: boolean;
  /** Optional notes */
  notes?: string;
  /** Bill type: recurring (monthly) or one-time (single pay period) */
  type: BillType;
  /** Whether this bill has been matched to a transaction this month */
  isResolved: boolean;
}

export interface SuggestedVendor {
  vendor: string;
  avgAmount: number;
  occurrences: number;
  lastSeen: string;
  suggestedDueDay: number;
  category: string;
}
