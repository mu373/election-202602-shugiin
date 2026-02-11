import {
  COLOR_PROGRESS_GAMMA,
  NODATA_COLOR,
  SHARE_COLORS,
} from './constants';

interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Clamps a number to the [0, 1] range. */
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Applies a gamma curve to push values toward the right (higher end). */
export function skewRight(t: number): number {
  return Math.pow(clamp01(t), COLOR_PROGRESS_GAMMA);
}

/** Parses a hex color string (#RGB or #RRGGBB) into RGB components. */
export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const norm = h.length === 3 ? h.split('').map((c) => `${c}${c}`).join('') : h;
  return {
    r: Number.parseInt(norm.slice(0, 2), 16),
    g: Number.parseInt(norm.slice(2, 4), 16),
    b: Number.parseInt(norm.slice(4, 6), 16),
  };
}

/** Converts RGB components to a #RRGGBB hex string. */
export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (x: number) => x.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Interpolates a color from the default SHARE_COLORS palette at position t ∈ [0, 1]. */
export function interpolateColor(t: number): string {
  const tt = clamp01(t);
  const scaled = tt * (SHARE_COLORS.length - 1);
  const i = Math.floor(scaled);
  const frac = scaled - i;
  const c1 = hexToRgb(SHARE_COLORS[i]);
  const c2 = hexToRgb(SHARE_COLORS[Math.min(i + 1, SHARE_COLORS.length - 1)]);
  return rgbToHex({
    r: Math.round(c1.r + (c2.r - c1.r) * frac),
    g: Math.round(c1.g + (c2.g - c1.g) * frac),
    b: Math.round(c1.b + (c2.b - c1.b) * frac),
  });
}

/** Interpolates a color from an arbitrary palette at position t ∈ [0, 1]. */
export function interpolateFromPalette(palette: readonly string[] | string[], t: number): string {
  const tt = clamp01(t);
  const scaled = tt * (palette.length - 1);
  const i = Math.floor(scaled);
  const frac = scaled - i;
  const c1 = hexToRgb(palette[i]);
  const c2 = hexToRgb(palette[Math.min(i + 1, palette.length - 1)]);
  return rgbToHex({
    r: Math.round(c1.r + (c2.r - c1.r) * frac),
    g: Math.round(c1.g + (c2.g - c1.g) * frac),
    b: Math.round(c1.b + (c2.b - c1.b) * frac),
  });
}

/** Returns a color for a share value using the default palette and gamma. */
export function getColor(share: number | null | undefined, maxValue: number): string {
  return getColorFromPalette(share, maxValue, SHARE_COLORS);
}

/** Returns a color for a value using a given palette, max bound, and optional gamma correction. */
export function getColorFromPalette(
  value: number | null | undefined,
  maxValue: number,
  palette: readonly string[] | string[],
  gamma = COLOR_PROGRESS_GAMMA,
): string {
  if (value == null || Number.isNaN(value)) return NODATA_COLOR;
  const t = maxValue > 0 ? clamp01(value / maxValue) : 0;
  return interpolateFromPalette(palette, Math.pow(t, gamma));
}

/** Computes the q-th quantile (0 ≤ q ≤ 1) from a pre-sorted array via linear interpolation. */
export function quantile(sortedValues: number[], q: number): number {
  if (!sortedValues.length) return 0;
  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const left = sortedValues[base];
  const right = sortedValues[base + 1] ?? left;
  return left + rest * (right - left);
}
