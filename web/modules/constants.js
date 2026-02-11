export const FIXED_BREAKS = [0, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4];
export const NODATA_COLOR = "#b6b8bc";
export const PARTY_QUANTILES = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95];
export const RULING_PARTY_CODE = "jimin";
export const RULING_BLOC_CODES = new Set(["jimin", "ishin"]);
// Crameri "vik" full diverging palette for party-rank mode.
export const PARTY_RANK_COLORS = [
  "#001261",
  "#034481",
  "#307da6",
  "#94bed2",
  "#ece5e0",
  "#dcac90",
  "#c37243",
  "#942f06",
  "#590008",
];
// Crameri "vik" blue half for share mode (pale -> blue).
export const SHARE_COLORS = [
  "#ece5e0",
  "#d6dde2",
  "#bfd2de",
  "#a9c8d8",
  "#94bed2",
  "#76a8c1",
  "#598fb0",
  "#307da6",
  "#034481",
  "#001261",
];
// Base colors for selected_diff mode.
export const SELECTED_VS_TOP_BETTER_COLORS = [
  "#ffffff",
  "#f8edf5",
  "#f1d8eb",
  "#e7bde0",
  "#db9bd2",
  "#cc73c2",
  "#bb49b1",
  "#a6269c",
  "#8b0f82",
  "#5f005c",
];
export const SELECTED_VS_TOP_WORSE_COLORS = [
  "#ffffff",
  "#edf7ef",
  "#d9efdd",
  "#bde4c4",
  "#9dd7a9",
  "#78c98a",
  "#4ab868",
  "#1fa549",
  "#0e8235",
  "#005a24",
];
// Diverging colors for selected_diff when values cross 0 (negative < 0 < positive).
export const SELECTED_VS_TOP_DIVERGING_COLORS = [
  "#1f6b3a",
  "#58a36f",
  "#a8cfb5",
  "#f7f7f7",
  "#e8bfdc",
  "#c96aae",
  "#7a1f73",
];
export const PARTY_COLOR_MAP = {
  jimin: "#a5002d",
  chudou: "#1f5fbf",
  mirai: "#64d8c6",
  ishin: "#8dc21f",
  kokumin: "#f8bc00",
  kyosan: "#d7000f",
  sanseito: "#f39800",
  hoshu: "#55c3f1",
  shamin: "#007bc3",
  reiwa: "#e4007f",
  genzei_yuukoku: "#0f4c81",
  anrakushi: "#6b7280",
};
export const DEFAULT_PARTY_PALETTE = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
];
export const COLOR_PROGRESS_GAMMA = 1.35;
export const CONCENTRATION_CONTRAST_GAMMA = 1.0;
export const SELECTED_DIFF_DEFAULT_BASE = "kokumin";
export const SELECTED_DIFF_DEFAULT_TARGET = "ishin";
