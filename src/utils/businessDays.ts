/**
 * Business Day Calculation Utility
 * 
 * Implements the Margin Freight Contractor Agreement payment schedule:
 * - Payments are issued on the 4th business day after the 15th and last day of month
 * - Business days exclude Saturdays, Sundays, and major US bank holidays
 */

// Major US bank holidays for 2025-2027 (federal reserve holidays)
const BANK_HOLIDAYS: Set<string> = new Set([
  // 2025
  '2025-01-01', // New Year's Day
  '2025-01-20', // MLK Day
  '2025-02-17', // Presidents Day
  '2025-05-26', // Memorial Day
  '2025-06-19', // Juneteenth
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-10-13', // Columbus Day
  '2025-11-11', // Veterans Day
  '2025-11-27', // Thanksgiving
  '2025-12-25', // Christmas
  // 2026
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Day
  '2026-02-16', // Presidents Day
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-10-12', // Columbus Day
  '2026-11-11', // Veterans Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
  // 2027
  '2027-01-01', // New Year's Day
  '2027-01-18', // MLK Day
  '2027-02-15', // Presidents Day
  '2027-05-31', // Memorial Day
  '2027-06-18', // Juneteenth (observed)
  '2027-07-05', // Independence Day (observed)
  '2027-09-06', // Labor Day
  '2027-10-11', // Columbus Day
  '2027-11-11', // Veterans Day
  '2027-11-25', // Thanksgiving
  '2027-12-24', // Christmas (observed)
]);

/**
 * Format a Date to YYYY-MM-DD string for holiday lookup.
 */
function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date is a business day (not weekend, not bank holiday).
 */
export function isBusinessDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  
  // Check against bank holidays
  const dateStr = toDateString(date);
  return !BANK_HOLIDAYS.has(dateStr);
}

/**
 * Get the Nth business day after a given date.
 * 
 * @param fromDate - The starting date (e.g., the 15th or last day of month)
 * @param businessDaysAfter - Number of business days to skip (e.g., 4)
 * @returns The target business day date
 */
export function getNthBusinessDayAfter(fromDate: Date, businessDaysAfter: number): Date {
  const result = new Date(fromDate);
  let businessDaysCounted = 0;
  
  while (businessDaysCounted < businessDaysAfter) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) {
      businessDaysCounted++;
    }
  }
  
  return result;
}

/**
 * Get the last day of a given month.
 */
export function getLastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

/**
 * Calculate pay periods for a given month following the Margin Freight schedule:
 * - Cutoff 1: 15th of month → Payment: 4th business day after
 * - Cutoff 2: Last day of month → Payment: 4th business day after
 */
export interface PayPeriodSchedule {
  cutoffDate: Date;
  paymentDate: Date;
  periodLabel: string; // e.g., "Early Feb" or "Late Feb"
}

export function getContractPayPeriods(year: number, month: number): PayPeriodSchedule[] {
  const periods: PayPeriodSchedule[] = [];
  const monthName = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short' });
  
  // First cutoff: 15th of month
  const firstCutoff = new Date(year, month, 15);
  const firstPayment = getNthBusinessDayAfter(firstCutoff, 4);
  
  periods.push({
    cutoffDate: firstCutoff,
    paymentDate: firstPayment,
    periodLabel: `Early ${monthName}`,
  });
  
  // Second cutoff: Last day of month
  const lastCutoff = getLastDayOfMonth(year, month);
  const secondPayment = getNthBusinessDayAfter(lastCutoff, 4);
  
  periods.push({
    cutoffDate: lastCutoff,
    paymentDate: secondPayment,
    periodLabel: `Late ${monthName}`,
  });
  
  return periods;
}

/**
 * Get the next scheduled payment date from today.
 * If today IS a payment date, returns the FOLLOWING payment date (bridge logic).
 */
export function getNextScheduledPaymentDate(fromDate: Date = new Date()): PayPeriodSchedule {
  const today = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  
  // Check current month and next 2 months for upcoming payments
  for (let offset = 0; offset <= 2; offset++) {
    const targetMonth = today.getMonth() + offset;
    const targetYear = today.getFullYear() + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    
    const periods = getContractPayPeriods(targetYear, normalizedMonth);
    
    for (const period of periods) {
      const paymentStart = new Date(
        period.paymentDate.getFullYear(),
        period.paymentDate.getMonth(),
        period.paymentDate.getDate()
      );
      
      // Payment must be strictly AFTER today (bridge logic)
      if (paymentStart > today) {
        return period;
      }
    }
  }
  
  // Fallback: shouldn't happen, but return a far-future date
  return getContractPayPeriods(today.getFullYear(), today.getMonth())[1];
}

/**
 * Check if a given date is a scheduled payment date.
 */
export function isPaymentDate(date: Date): boolean {
  const dateStr = toDateString(date);
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Check current month's periods
  const periods = getContractPayPeriods(year, month);
  for (const period of periods) {
    if (toDateString(period.paymentDate) === dateStr) {
      return true;
    }
  }
  
  // Check previous month (for early-month payments from late-month cutoff)
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevPeriods = getContractPayPeriods(prevYear, prevMonth);
  for (const period of prevPeriods) {
    if (toDateString(period.paymentDate) === dateStr) {
      return true;
    }
  }
  
  return false;
}

/**
 * Format a payment date for display.
 */
export function formatPaymentDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
