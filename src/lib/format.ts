// src/lib/format.ts

export function formatNaira(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '₦0';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCountdown(ms: number): string {
  // Guard against NaN / negative / Infinity
  if (!isFinite(ms) || isNaN(ms) || ms <= 0) return '00:00:00';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
/**
 * Robust relative time formatter.
 * Handles Firestore Timestamp, Date, number, string, and null/undefined safely.
 */
export function formatTimeAgo(input: any): string {
  try {
    if (input === null || input === undefined) return 'just now';

    let date: Date;

    // Firestore Timestamp (has .toDate())
    if (typeof input?.toDate === 'function') {
      date = input.toDate();
    }
    // JS Date
    else if (input instanceof Date) {
      date = input;
    }
    // Number (epoch ms)
    else if (typeof input === 'number') {
      // Could be seconds or milliseconds
      date = new Date(input < 1e12 ? input * 1000 : input);
    }
    // String
    else if (typeof input === 'string') {
      date = new Date(input);
    }
    // Firestore admin Timestamp shape { seconds, nanoseconds }
    else if (typeof input === 'object' && typeof input.seconds === 'number') {
      date = new Date(input.seconds * 1000);
    }
    else {
      return 'just now';
    }

    // Validate the date
    if (isNaN(date.getTime())) return 'just now';

    const diffMs = Date.now() - date.getTime();

    // Future dates (clock skew) — treat as now
    if (diffMs < 0) return 'just now';

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return 'just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;

    const years = Math.floor(days / 365);
    return `${years}y ago`;
  } catch (err) {
    console.warn('[formatTimeAgo] Failed for input:', input, err);
    return 'just now';
  }
}

/**
 * Format an absolute date safely.
 */
export function formatDate(input: any): string {
  try {
    if (!input) return '—';
    let date: Date;
    if (typeof input?.toDate === 'function') date = input.toDate();
    else if (input instanceof Date) date = input;
    else if (typeof input === 'number') date = new Date(input);
    else if (typeof input === 'string') date = new Date(input);
    else if (typeof input === 'object' && typeof input.seconds === 'number')
      date = new Date(input.seconds * 1000);
    else return '—';

    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}