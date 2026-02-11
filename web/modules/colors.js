import {
  SHARE_COLORS,
  NODATA_COLOR,
  COLOR_PROGRESS_GAMMA,
} from "./constants.js";

export function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function skewRight(t) {
  return Math.pow(clamp01(t), COLOR_PROGRESS_GAMMA);
}

export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const norm = h.length === 3 ? h.split("").map((c) => `${c}${c}`).join("") : h;
  return {
    r: Number.parseInt(norm.slice(0, 2), 16),
    g: Number.parseInt(norm.slice(2, 4), 16),
    b: Number.parseInt(norm.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  const toHex = (x) => x.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function interpolateColor(t) {
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

export function interpolateFromPalette(palette, t) {
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

export function getColor(share, maxValue) {
  return getColorFromPalette(share, maxValue, SHARE_COLORS);
}

export function getColorFromPalette(value, maxValue, palette, gamma = COLOR_PROGRESS_GAMMA) {
  if (value == null || Number.isNaN(value)) return NODATA_COLOR;
  const t = maxValue > 0 ? clamp01(value / maxValue) : 0;
  return interpolateFromPalette(palette, Math.pow(t, gamma));
}

export function quantile(sortedValues, q) {
  if (!sortedValues.length) return 0;
  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const left = sortedValues[base];
  const right = sortedValues[base + 1] ?? left;
  return left + rest * (right - left);
}
