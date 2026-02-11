export function pct(x) {
  if (x == null || Number.isNaN(x)) return "N/A";
  return `${(x * 100).toFixed(1)} %`;
}

export function pctLabel(x) {
  return `${(x * 100).toFixed(1)} %`;
}

export function ppLabel(x) {
  return `${(x * 100).toFixed(1)} pt`;
}

export function ppSignedLabel(x) {
  if (x == null || Number.isNaN(x)) return "N/A";
  const v = x * 100;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)} pt`;
}

export function ratioLabel(x) {
  if (x == null || Number.isNaN(x)) return "N/A";
  return `${x.toFixed(2)}`;
}
