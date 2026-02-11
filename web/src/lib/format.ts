export function pct(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return 'N/A';
  return `${(x * 100).toFixed(1)} %`;
}

export function pctLabel(x: number): string {
  return `${(x * 100).toFixed(1)} %`;
}

export function ppLabel(x: number): string {
  return `${(x * 100).toFixed(1)} pt`;
}

export function ppSignedLabel(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return 'N/A';
  const v = x * 100;
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)} pt`;
}

export function ratioLabel(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return 'N/A';
  return `${x.toFixed(2)}`;
}
