/**
 * Safe localStorage utilities for SSR-safe access.
 * Consolidates all localStorage access patterns in one place.
 */

export function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function lsGet(key: string): string | null {
  if (!canUseStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function lsSet(key: string, value: string): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore quota errors
  }
}

export function lsRemove(key: string): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

/**
 * Parse JSON from localStorage with a fallback value.
 */
export function lsGetParsed<T>(key: string, fallback: T): T {
  const stored = lsGet(key);
  if (!stored) return fallback;
  try {
    return JSON.parse(stored);
  } catch {
    return fallback;
  }
}

/**
 * Stringify and store value in localStorage.
 */
export function lsSetJson(key: string, value: unknown): void {
  lsSet(key, JSON.stringify(value));
}
