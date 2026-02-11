/** Formats a share (0–1) as a percentage string like "12.3 %", or "N/A" if null. */
export function pct(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return 'N/A';
  return `${(x * 100).toFixed(1)} %`;
}

/** Formats a share (0–1) as a percentage string (always returns a value, no N/A). */
export function pctLabel(x: number): string {
  return `${(x * 100).toFixed(1)} %`;
}

/** Formats a share difference as percentage points, e.g. "5.2 pt". */
export function ppLabel(x: number): string {
  return `${(x * 100).toFixed(1)} pt`;
}

/** Formats a signed share difference like "+5.2 pt" or "-3.1 pt", or "N/A" if null. */
export function ppSignedLabel(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return 'N/A';
  const v = x * 100;
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)} pt`;
}

/** Formats a ratio value to 2 decimal places, or "N/A" if null. */
export function ratioLabel(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return 'N/A';
  return `${x.toFixed(2)}`;
}
