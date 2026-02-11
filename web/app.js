const FIXED_BREAKS = [0, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4];
const NODATA_COLOR = "#b6b8bc";
const PARTY_QUANTILES = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95];
const RULING_PARTY_CODE = "jimin";
const RULING_BLOC_CODES = new Set(["jimin", "ishin"]);
const HHI_WIKI_URL = "https://ja.wikipedia.org/wiki/%E3%83%8F%E3%83%BC%E3%83%95%E3%82%A3%E3%83%B3%E3%83%80%E3%83%BC%E3%83%AB%E3%83%BB%E3%83%8F%E3%83%BC%E3%82%B7%E3%83%A5%E3%83%9E%E3%83%B3%E3%83%BB%E3%82%A4%E3%83%B3%E3%83%87%E3%83%83%E3%82%AF%E3%82%B9";
// Crameri "vik" full diverging palette for party-rank mode.
const PARTY_RANK_COLORS = [
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
const SHARE_COLORS = [
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
const SELECTED_VS_TOP_BETTER_COLORS = [
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
const SELECTED_VS_TOP_WORSE_COLORS = [
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
const SELECTED_VS_TOP_DIVERGING_COLORS = [
  "#1f6b3a",
  "#58a36f",
  "#a8cfb5",
  "#f7f7f7",
  "#e8bfdc",
  "#c96aae",
  "#7a1f73",
];
const PARTY_COLOR_MAP = {
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
const DEFAULT_PARTY_PALETTE = [
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

const canvasRenderer = L.canvas({ padding: 0.5, pane: "geoPane" });
const map = L.map("map", {
  preferCanvas: true,
  renderer: canvasRenderer,
  zoomControl: false,
}).setView([36.5, 138], 5);
map.attributionControl.setPrefix(false);
L.control.zoom({ position: "bottomleft" }).addTo(map);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: "abcd",
  maxZoom: 18,
}).addTo(map);

const partySelect = document.getElementById("partySelect");
const scaleModeSelect = document.getElementById("scaleMode");
const granularitySelect = document.getElementById("granularitySelect");
const plotModeSelect = document.getElementById("plotModeSelect");
const compareTargetSelect = document.getElementById("compareTargetSelect");
const selectedMetricSelect = document.getElementById("selectedMetricSelect");
const rulingMetricSelect = document.getElementById("rulingMetricSelect");
const rankSelect = document.getElementById("rankSelect");
const labelToggle = document.getElementById("labelToggle");
const prefBorderToggle = document.getElementById("prefBorderToggle");
const groupParty = document.getElementById("groupParty");
const groupCompareTarget = document.getElementById("groupCompareTarget");
const groupSelectedMetric = document.getElementById("groupSelectedMetric");
const groupRulingMetric = document.getElementById("groupRulingMetric");
const groupScaleMode = document.getElementById("groupScaleMode");
const groupRank = document.getElementById("groupRank");
const groupPrefBorders = document.getElementById("groupPrefBorders");
const legendTitleEl = document.getElementById("legendTitle");
const legendEl = document.getElementById("legend");
const statsEl = document.getElementById("stats");
const modeHelpEl = document.getElementById("modeHelp");
const selectedMetricHelpEl = document.getElementById("selectedMetricHelp");
const rulingMetricHelpEl = document.getElementById("rulingMetricHelp");
const scaleHelpEl = document.getElementById("scaleHelp");

let geoLayer = null;
let prefBorderLayer = null;
let electionData = {};
let parties = [];
let partyNameByCode = {};
let partyColorByCode = {};
let geojsonByGranularity = { muni: null, pref: null, block: null };
let prefToBlock = {};
let prefAgg = {};
let blockAgg = {};
let currentGranularity = "muni";
let labelsVisible = false;
let prefBordersVisible = true;
let lastPlotMode = null;
let activeBreaks = [...FIXED_BREAKS];
let activeMax = 1.0;
let activeMin = 0.0;
let activeCrossesZero = false;
let activePartyRankMax = 1;
const COLOR_PROGRESS_GAMMA = 1.35;
const CONCENTRATION_CONTRAST_GAMMA = 1.0;

function ensureGeoPane() {
  let pane = map.getPane("geoPane");
  if (!pane) {
    pane = map.createPane("geoPane");
    pane.style.zIndex = "410";
  }
  pane.style.mixBlendMode = "multiply";
}

function updateGeoPaneBlendMode() {
  const pane = map.getPane("geoPane");
  if (!pane) return;
  pane.style.mixBlendMode = "multiply";
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function skewRight(t) {
  return Math.pow(clamp01(t), COLOR_PROGRESS_GAMMA);
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const norm = h.length === 3 ? h.split("").map((c) => `${c}${c}`).join("") : h;
  return {
    r: Number.parseInt(norm.slice(0, 2), 16),
    g: Number.parseInt(norm.slice(2, 4), 16),
    b: Number.parseInt(norm.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (x) => x.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function interpolateColor(t) {
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

function interpolateFromPalette(palette, t) {
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

function getColor(share, maxValue) {
  return getColorFromPalette(share, maxValue, SHARE_COLORS);
}

function getColorFromPalette(value, maxValue, palette, gamma = COLOR_PROGRESS_GAMMA) {
  if (value == null || Number.isNaN(value)) return NODATA_COLOR;
  const t = maxValue > 0 ? clamp01(value / maxValue) : 0;
  return interpolateFromPalette(palette, Math.pow(t, gamma));
}

function pct(x) {
  if (x == null || Number.isNaN(x)) return "N/A";
  return `${(x * 100).toFixed(1)} %`;
}

function pctLabel(x) {
  return `${(x * 100).toFixed(1)} %`;
}

function ppLabel(x) {
  return `${(x * 100).toFixed(1)} pt`;
}

function ppSignedLabel(x) {
  if (x == null || Number.isNaN(x)) return "N/A";
  const v = x * 100;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)} pt`;
}

function ratioLabel(x) {
  if (x == null || Number.isNaN(x)) return "N/A";
  return `${x.toFixed(2)}`;
}

function quantile(sortedValues, q) {
  if (!sortedValues.length) return 0;
  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const left = sortedValues[base];
  const right = sortedValues[base + 1] ?? left;
  return left + rest * (right - left);
}

function partyColor(code) {
  return partyColorByCode[code] || "#9ca3af";
}

function buildPartyColorMap() {
  partyColorByCode = {};
  const sortedCodes = parties.map((p) => p.code).sort();
  let paletteIdx = 0;
  for (const code of sortedCodes) {
    if (PARTY_COLOR_MAP[code]) {
      partyColorByCode[code] = PARTY_COLOR_MAP[code];
      continue;
    }
    partyColorByCode[code] = DEFAULT_PARTY_PALETTE[paletteIdx % DEFAULT_PARTY_PALETTE.length];
    paletteIdx += 1;
  }
}

function buildPartyBreaks(partyCode) {
  const shares = getSharesForCurrentGranularity(partyCode).sort((a, b) => a - b);
  if (!shares.length) return [...FIXED_BREAKS];
  const breaks = PARTY_QUANTILES.map((q) => quantile(shares, q));
  breaks[0] = 0;
  for (let i = 1; i < breaks.length; i += 1) {
    if (breaks[i] < breaks[i - 1]) breaks[i] = breaks[i - 1];
  }
  return breaks;
}

function computeActiveScale() {
  const mode = scaleModeSelect.value;
  const selectedPartyCode = partySelect.value;
  if (mode === "party") {
    activeBreaks = buildPartyBreaks(selectedPartyCode);
    const shares = getSharesForCurrentGranularity(selectedPartyCode);
    if (!shares.length) {
      activeMax = 0.01;
    } else {
      const sortedShares = [...shares].sort((a, b) => a - b);
      const q95 = quantile(sortedShares, 0.95);
      activeMax = q95 > 0 ? q95 : 0.01;
    }
  } else {
    activeBreaks = [...FIXED_BREAKS];
    activeMax = activeBreaks[activeBreaks.length - 1] > 0 ? activeBreaks[activeBreaks.length - 1] : 0.01;
  }
}

function updateLegend() {
  updateLegendTitle();
  if (isPartyRankMode()) {
    const counts = {};
    const geo = geojsonByGranularity[granularitySelect.value];
    for (const feature of geo?.features || []) {
      const stats = getFeatureRenderStats(feature);
      if (stats.rank != null) {
        counts[stats.rank] = (counts[stats.rank] || 0) + 1;
      }
    }
    const maxRankInData = Math.max(0, ...Object.keys(counts).map((r) => Number.parseInt(r, 10)));
    const legendMaxRank = Math.min(maxRankInData || 0, 10);
    legendEl.innerHTML = "";
    if (legendMaxRank === 0) {
      const noDataRow = document.createElement("div");
      noDataRow.className = "legend-row";
      noDataRow.innerHTML = `<span class="legend-swatch" style="background:${NODATA_COLOR}"></span>データなし`;
      legendEl.appendChild(noDataRow);
      return;
    }
    for (let rank = 1; rank <= legendMaxRank; rank += 1) {
      const row = document.createElement("div");
      row.className = "legend-row";
      row.innerHTML = `<span class="legend-swatch" style="background:${getPartyRankColor(rank)}"></span>第${rank}位 (${(counts[rank] || 0).toLocaleString()})`;
      legendEl.appendChild(row);
    }
    if ((maxRankInData || 0) > legendMaxRank) {
      const tailCount = Object.entries(counts)
        .filter(([rank]) => Number.parseInt(rank, 10) > legendMaxRank)
        .reduce((acc, [, count]) => acc + count, 0);
      const tailRow = document.createElement("div");
      tailRow.className = "legend-row";
      tailRow.innerHTML = `<span class="legend-swatch" style="background:${getPartyRankColor(legendMaxRank + 1)}"></span>第${legendMaxRank + 1}位以下 (${tailCount.toLocaleString()})`;
      legendEl.appendChild(tailRow);
    }
    const noDataRow = document.createElement("div");
    noDataRow.className = "legend-row";
    noDataRow.innerHTML = `<span class="legend-swatch" style="background:${NODATA_COLOR}"></span>データなし`;
    legendEl.appendChild(noDataRow);
    return;
  }

  if (isRankMode()) {
    const rank = Number.parseInt(rankSelect.value, 10) || 1;
    const counts = {};
    const geo = geojsonByGranularity[granularitySelect.value];
    for (const feature of geo?.features || []) {
      const ranked = getRankedPartiesForFeature(feature, getExcludedPartyCodeForMode());
      const p = ranked[rank - 1];
      if (p) counts[p.code] = (counts[p.code] || 0) + 1;
    }
    const rankedParties = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    legendEl.innerHTML = "";
    for (const [code, nAreas] of rankedParties) {
      const row = document.createElement("div");
      row.className = "legend-row";
      row.innerHTML = `<span class="legend-swatch" style="background:${partyColor(code)}"></span>${partyNameByCode[code] || code} (${nAreas})`;
      legendEl.appendChild(row);
    }
    const noDataRow = document.createElement("div");
    noDataRow.className = "legend-row";
    noDataRow.innerHTML = `<span class="legend-swatch" style="background:${NODATA_COLOR}"></span>データなし`;
    legendEl.appendChild(noDataRow);
    return;
  }

  const legendPalette = (() => {
    if (isConcentrationMode()) return SHARE_COLORS;
    if (!(isSignedDiffMode() || isRulingRatioMode() || isSelectedRatioMode())) return SHARE_COLORS;
    if (activeCrossesZero) return SELECTED_VS_TOP_DIVERGING_COLORS;
    if (activeMin >= 0) return SELECTED_VS_TOP_BETTER_COLORS;
    return SELECTED_VS_TOP_WORSE_COLORS;
  })();
  const gradientStops = legendPalette.map((c, i) => `${c} ${(i / (legendPalette.length - 1)) * 100}%`).join(", ");
  const selectedMid = activeCrossesZero ? 0 : (activeMin + ((activeMax - activeMin) / 2));
  const ratioMid = Math.exp(selectedMid);
  const ratioLeft = Math.exp(activeMin);
  const ratioRight = Math.exp(activeMax);
  const midLabel = isConcentrationMode()
    ? (activeMax / 2).toFixed(3)
    : (
      (isRulingRatioMode() || isSelectedRatioMode())
        ? ratioLabel(ratioMid)
        : (isSignedDiffMode() ? ppLabel(selectedMid) : pctLabel(activeMax / 2))
    );
  const leftLabel = isConcentrationMode()
    ? "0.000"
    : (
      (isRulingRatioMode() || isSelectedRatioMode())
        ? ratioLabel(ratioLeft)
        : (isSignedDiffMode() ? ppLabel(activeMin) : "0 %")
    );
  const rightLabel = isConcentrationMode()
    ? activeMax.toFixed(3)
    : (
      (isRulingRatioMode() || isSelectedRatioMode())
        ? ratioLabel(ratioRight)
        : (isSignedDiffMode() ? ppLabel(activeMax) : pctLabel(activeMax))
    );
  const semanticRow = (isSignedDiffMode() || isRulingRatioMode() || isSelectedRatioMode())
    ? `<div class="legend-axis"><span>${isRulingVsOppositionMode() ? "野党が優勢" : "基準政党が劣勢"}</span><span>${(isRulingRatioMode() || isSelectedRatioMode()) ? "拮抗 (1.00)" : "拮抗"}</span><span>${isRulingVsOppositionMode() ? "与党が優勢" : "基準政党が優勢"}</span></div>`
    : "";
  legendEl.innerHTML = `
    <div class="legend-gradient" style="background: linear-gradient(to right, ${gradientStops});"></div>
    <div class="legend-axis">
      <span>${leftLabel}</span><span>${midLabel}</span><span>${rightLabel}</span>
    </div>
    ${semanticRow}
  `;
  const noData = document.createElement("div");
  noData.className = "legend-row";
  noData.innerHTML = `<span class="legend-swatch" style="background:${NODATA_COLOR}"></span>データなし`;
  legendEl.appendChild(noData);
}

function updateLegendTitle() {
  if (!legendTitleEl) return;
  if (isPartyRankMode()) {
    legendTitleEl.textContent = "凡例（順位）";
    return;
  }
  if (isRankMode()) {
    legendTitleEl.textContent = "凡例（政党）";
    return;
  }
  if (isSelectedVsTopMode()) {
    legendTitleEl.textContent = getSelectedMetricMode() === "ratio"
      ? "凡例（比: 基準/比較）"
      : "凡例（差分: 基準政党 - 比較対象）";
    return;
  }
  if (isRulingVsOppositionMode()) {
    legendTitleEl.textContent = getRulingMetricMode() === "ratio"
      ? "凡例（比: 与党/野党）"
      : "凡例（差分: 与党 - 野党）";
    return;
  }
  if (isConcentrationMode()) {
    legendTitleEl.textContent = "凡例（ハーフィンダール・ハーシュマン指数）";
    return;
  }
  legendTitleEl.textContent = "凡例（得票率）";
}

function getShare(muniCode, partyCode) {
  const rec = electionData[muniCode];
  if (!rec || !rec.parties) return null;
  const v = rec.parties[partyCode];
  return typeof v === "number" ? v : null;
}

function getAggregateShare(agg, partyCode) {
  if (!agg || !agg.valid_votes || !agg.party_votes) return null;
  const partyVotes = agg.party_votes[partyCode];
  if (typeof partyVotes !== "number" || Number.isNaN(partyVotes)) return null;
  return partyVotes / agg.valid_votes;
}

function getFeatureStats(feature, partyCode) {
  const granularity = granularitySelect.value;
  if (granularity === "muni") {
    const muniCode = String(feature.properties.muni_code || "").padStart(5, "0");
    const rec = electionData[muniCode] || {};
    const baseName = `${rec.name || feature.properties.muni_name || ""}`.trim();
    const prefName = `${rec.pref || feature.properties.pref_name || ""}`.trim();
    const fullName = (() => {
      if (!baseName) return "";
      if (!prefName) return baseName;
      if (baseName.startsWith(prefName)) return baseName;
      return `${prefName}${baseName}`;
    })();
    return {
      label: fullName,
      share: getShare(muniCode, partyCode),
      validVotes: rec.valid_votes ?? null,
    };
  }
  if (granularity === "pref") {
    const prefName = feature.properties.pref_name;
    const agg = prefAgg[prefName];
    return {
      label: prefName || "都道府県",
      share: getAggregateShare(agg, partyCode),
      validVotes: agg ? agg.valid_votes : null,
    };
  }
  const blockName = feature.properties.block_name;
  const agg = blockAgg[blockName];
  return {
    label: blockName || "ブロック",
    share: getAggregateShare(agg, partyCode),
    validVotes: agg ? agg.valid_votes : null,
  };
}

function getRankedPartiesForFeature(feature, excludedPartyCode = null) {
  const granularity = granularitySelect.value;
  if (granularity === "muni") {
    const muniCode = String(feature.properties.muni_code || "").padStart(5, "0");
    const rec = electionData[muniCode] || {};
    return Object.entries(rec.parties || {})
      .filter(([, share]) => typeof share === "number" && !Number.isNaN(share))
      .map(([code, share]) => ({ code, share, votes: (rec.valid_votes || 0) * share }))
      .filter((p) => p.code !== excludedPartyCode)
      .sort((a, b) => b.share - a.share);
  }

  const agg = granularity === "pref"
    ? prefAgg[feature.properties.pref_name]
    : blockAgg[feature.properties.block_name];
  if (!agg || !agg.valid_votes) return [];
  return Object.entries(agg.party_votes || {})
    .filter(([, votes]) => typeof votes === "number" && !Number.isNaN(votes) && votes > 0)
    .map(([code, votes]) => ({ code, votes, share: votes / agg.valid_votes }))
    .filter((p) => p.code !== excludedPartyCode)
    .sort((a, b) => b.share - a.share);
}

function isRankMode() {
  return plotModeSelect.value === "rank" || plotModeSelect.value === "opposition_rank";
}

function isPartyRankMode() {
  return plotModeSelect.value === "party_rank";
}

function isSelectedVsTopMode() {
  return plotModeSelect.value === "selected_diff";
}

function isRulingVsOppositionMode() {
  return plotModeSelect.value === "ruling_vs_opposition";
}

function getRulingMetricMode() {
  return rulingMetricSelect.value === "ratio" ? "ratio" : "diff";
}

function isRulingRatioMode() {
  return isRulingVsOppositionMode() && getRulingMetricMode() === "ratio";
}

function getSelectedMetricMode() {
  return selectedMetricSelect.value === "ratio" ? "ratio" : "diff";
}

function isSelectedRatioMode() {
  return isSelectedVsTopMode() && getSelectedMetricMode() === "ratio";
}

function isSignedDiffMode() {
  return (isSelectedVsTopMode() && !isSelectedRatioMode()) || (isRulingVsOppositionMode() && !isRulingRatioMode());
}

function isConcentrationMode() {
  return plotModeSelect.value === "concentration";
}

function getCompareTargetMode() {
  return compareTargetSelect.value === "top" ? "top" : "party";
}

function getCompareTargetLabel() {
  if (getCompareTargetMode() === "party") {
    const code = compareTargetSelect.value;
    return partyNameByCode[code] || code;
  }
  return "第1党";
}

function getCompareTargetPartyCode() {
  if (getCompareTargetMode() !== "party") return null;
  const code = compareTargetSelect.value;
  return parties.some((p) => p.code === code) ? code : null;
}

function isAnyRankMode() {
  return isRankMode() || isPartyRankMode();
}

function getExcludedPartyCodeForMode() {
  return plotModeSelect.value === "opposition_rank" ? RULING_PARTY_CODE : null;
}

function getPartyRankForFeature(feature, partyCode) {
  const ranked = getRankedPartiesForFeature(feature, null);
  for (let i = 0; i < ranked.length; i += 1) {
    if (ranked[i].code === partyCode) {
      return {
        rank: i + 1,
        share: ranked[i].share,
      };
    }
  }
  return {
    rank: null,
    share: null,
  };
}

function getSelectedGapForFeature(feature, selectedPartyCode, compareTargetMode) {
  const ranked = getRankedPartiesForFeature(feature, null);
  if (!ranked.length) {
    return {
      gap: null,
      selectedShare: null,
      targetShare: null,
      targetPartyCode: null,
    };
  }
  const selected = ranked.find((p) => p.code === selectedPartyCode) || null;
  if (!selected) {
    return {
      gap: null,
      selectedShare: null,
      targetShare: null,
      targetPartyCode: null,
    };
  }
  const selectedShare = selected.share;
  if (compareTargetMode === "party") {
    const targetPartyCode = getCompareTargetPartyCode();
    const targetParty = targetPartyCode
      ? (ranked.find((p) => p.code === targetPartyCode) || null)
      : null;
    if (!targetParty) {
      return {
        gap: null,
        selectedShare: null,
        targetShare: null,
        targetPartyCode: null,
      };
    }
    const targetShare = targetParty.share;
    return {
      gap: selectedShare - targetShare,
      selectedShare,
      targetShare,
      targetPartyCode,
    };
  }
  const top = ranked[0];
  return {
    gap: selectedShare - top.share,
    selectedShare,
    targetShare: top.share,
    targetPartyCode: top.code,
  };
}

function getSelectedValueForFeature(feature, selectedPartyCode, compareTargetMode, metricMode) {
  const gapInfo = getSelectedGapForFeature(feature, selectedPartyCode, compareTargetMode);
  if (metricMode === "ratio") {
    const ratio = (
      gapInfo.selectedShare != null &&
      gapInfo.targetShare != null &&
      gapInfo.targetShare > 0
    )
      ? (gapInfo.selectedShare / gapInfo.targetShare)
      : null;
    const logRatio = ratio != null ? Math.log(ratio) : null;
    return { ...gapInfo, ratio, logRatio, value: logRatio };
  }
  return { ...gapInfo, ratio: null, logRatio: null, value: gapInfo.gap };
}

function getConcentrationForFeature(feature) {
  const ranked = getRankedPartiesForFeature(feature, null);
  if (!ranked.length) return null;
  return ranked.reduce((acc, p) => acc + (p.share * p.share), 0);
}

function getRulingOppositionDiffForFeature(feature) {
  const ranked = getRankedPartiesForFeature(feature, null);
  if (!ranked.length) {
    return {
      gap: null,
      rulingShare: null,
      oppositionShare: null,
    };
  }
  let rulingShare = 0;
  let oppositionShare = 0;
  for (const p of ranked) {
    if (RULING_BLOC_CODES.has(p.code)) rulingShare += p.share;
    else oppositionShare += p.share;
  }
  return {
    gap: rulingShare - oppositionShare,
    rulingShare,
    oppositionShare,
  };
}

function computeActivePartyRankMax() {
  if (!isPartyRankMode()) {
    activePartyRankMax = 1;
    return;
  }
  const selectedCode = partySelect.value;
  const geo = geojsonByGranularity[granularitySelect.value];
  let maxRank = 1;
  for (const feature of geo?.features || []) {
    const rank = getPartyRankForFeature(feature, selectedCode).rank;
    if (rank != null && rank > maxRank) {
      maxRank = rank;
    }
  }
  activePartyRankMax = maxRank;
}

function getPartyRankColor(rank) {
  if (rank == null) return NODATA_COLOR;
  const maxRank = Math.max(activePartyRankMax, rank, 1);
  if (rank <= 1) return PARTY_RANK_COLORS[0];
  if (rank >= maxRank) return PARTY_RANK_COLORS[PARTY_RANK_COLORS.length - 1];
  const t = maxRank > 1 ? (rank - 1) / (maxRank - 1) : 0;
  return interpolateFromPalette(PARTY_RANK_COLORS, t);
}

function getFeatureRenderStats(feature) {
  if (isRankMode()) {
    const rank = Number.parseInt(rankSelect.value, 10) || 1;
    const ranked = getRankedPartiesForFeature(feature, getExcludedPartyCodeForMode());
    const chosen = ranked[rank - 1] || null;
    const base = getFeatureStats(feature, partySelect.value);
    const partyCode = chosen ? chosen.code : null;
    return {
      ...base,
      rank,
      share: chosen ? chosen.share : null,
      partyCode,
      partyName: partyCode ? (partyNameByCode[partyCode] || partyCode) : null,
    };
  }
  if (isPartyRankMode()) {
    const partyCode = partySelect.value;
    const base = getFeatureStats(feature, partyCode);
    const partyRank = getPartyRankForFeature(feature, partyCode);
    return {
      ...base,
      partyCode,
      partyName: partyNameByCode[partyCode] || partyCode,
      rank: partyRank.rank,
      share: partyRank.share,
    };
  }

  if (isSelectedVsTopMode()) {
    const selectedCode = partySelect.value;
    const base = getFeatureStats(feature, selectedCode);
    const compareTargetMode = getCompareTargetMode();
    const metricMode = getSelectedMetricMode();
    const valueInfo = getSelectedValueForFeature(feature, selectedCode, compareTargetMode, metricMode);
    const targetPartyCode = valueInfo.targetPartyCode;
    return {
      ...base,
      partyCode: selectedCode,
      partyName: partyNameByCode[selectedCode] || selectedCode,
      share: valueInfo.value,
      gap: valueInfo.gap,
      selectedShare: valueInfo.selectedShare,
      targetShare: valueInfo.targetShare,
      targetPartyCode,
      targetPartyName: targetPartyCode ? (partyNameByCode[targetPartyCode] || targetPartyCode) : getCompareTargetLabel(),
      compareTargetMode,
      compareTargetLabel: getCompareTargetLabel(),
      ratio: valueInfo.ratio,
      logRatio: valueInfo.logRatio,
      metricMode,
    };
  }

  if (isRulingVsOppositionMode()) {
    const base = getFeatureStats(feature, RULING_PARTY_CODE);
    const diff = getRulingOppositionDiffForFeature(feature);
    const ratio =
      (diff.rulingShare != null && diff.oppositionShare != null && diff.oppositionShare > 0)
        ? (diff.rulingShare / diff.oppositionShare)
        : null;
    const logRatio = ratio != null ? Math.log(ratio) : null;
    return {
      ...base,
      share: isRulingRatioMode() ? logRatio : diff.gap,
      gap: diff.gap,
      rulingShare: diff.rulingShare,
      oppositionShare: diff.oppositionShare,
      ratio,
      logRatio,
      metricMode: getRulingMetricMode(),
    };
  }

  if (isConcentrationMode()) {
    const partyCode = partySelect.value;
    const base = getFeatureStats(feature, partyCode);
    const concentration = getConcentrationForFeature(feature);
    return {
      ...base,
      partyCode,
      partyName: partyNameByCode[partyCode] || partyCode,
      share: concentration,
      concentration,
      effectivePartyCount:
        concentration && concentration > 0 ? (1 / concentration) : null,
    };
  }

  const partyCode = partySelect.value;
  const base = getFeatureStats(feature, partyCode);
  return {
    ...base,
    partyCode,
    partyName: partyNameByCode[partyCode] || partyCode,
  };
}

function buildPartyRankPopupRows(feature, selectedCode, compareTargetCode = null) {
  const ranked = getRankedPartiesForFeature(feature, null);
  if (!ranked.length) return "順位データ: N/A";
  return ranked
    .map((p, idx) => {
      const isSelected = p.code === selectedCode;
      const isCompareTarget = compareTargetCode && p.code === compareTargetCode;
      const label = `第${idx + 1}位 ${partyNameByCode[p.code] || p.code}: ${pct(p.share)}`;
      return (isSelected || isCompareTarget) ? `<strong>${label}</strong>` : label;
    })
    .join("<br>");
}

function getSharesForCurrentGranularity(partyCode) {
  const granularity = granularitySelect.value;
  if (granularity === "muni") {
    return Object.values(electionData)
      .map((rec) => rec?.parties?.[partyCode])
      .filter((x) => typeof x === "number" && !Number.isNaN(x));
  }
  if (granularity === "pref") {
    return Object.values(prefAgg)
      .map((agg) => getAggregateShare(agg, partyCode))
      .filter((x) => typeof x === "number" && !Number.isNaN(x));
  }
  return Object.values(blockAgg)
    .map((agg) => getAggregateShare(agg, partyCode))
    .filter((x) => typeof x === "number" && !Number.isNaN(x));
}

function getSelectedVsTopValuesForCurrentGranularity(selectedPartyCode, compareTargetMode, metricMode) {
  const geo = geojsonByGranularity[granularitySelect.value];
  const values = [];
  for (const feature of geo?.features || []) {
    const v = getSelectedValueForFeature(feature, selectedPartyCode, compareTargetMode, metricMode);
    if (typeof v.value === "number" && !Number.isNaN(v.value)) {
      values.push(v.value);
    }
  }
  return values;
}

function getRulingOppositionValuesForCurrentGranularity(metricMode) {
  const geo = geojsonByGranularity[granularitySelect.value];
  const values = [];
  for (const feature of geo?.features || []) {
    const diff = getRulingOppositionDiffForFeature(feature);
    if (metricMode === "ratio") {
      if (
        diff.rulingShare != null &&
        diff.oppositionShare != null &&
        diff.oppositionShare > 0
      ) {
        const ratio = diff.rulingShare / diff.oppositionShare;
        const logRatio = Math.log(ratio);
        if (!Number.isNaN(logRatio)) values.push(logRatio);
      }
    } else if (typeof diff.gap === "number" && !Number.isNaN(diff.gap)) {
      values.push(diff.gap);
    }
  }
  return values;
}

function buildAggregates() {
  prefAgg = {};
  blockAgg = {};
  for (const rec of Object.values(electionData)) {
    const prefName = rec.pref;
    const validVotes = Number(rec.valid_votes);
    if (!prefName || !Number.isFinite(validVotes) || validVotes <= 0) continue;
    if (!prefAgg[prefName]) {
      prefAgg[prefName] = { valid_votes: 0, party_votes: {} };
    }
    prefAgg[prefName].valid_votes += validVotes;
    for (const [partyCode, share] of Object.entries(rec.parties || {})) {
      if (typeof share !== "number" || Number.isNaN(share)) continue;
      const addVotes = share * validVotes;
      prefAgg[prefName].party_votes[partyCode] =
        (prefAgg[prefName].party_votes[partyCode] || 0) + addVotes;
    }
  }

  for (const [prefName, agg] of Object.entries(prefAgg)) {
    const blockName = prefToBlock[prefName];
    if (!blockName) continue;
    if (!blockAgg[blockName]) {
      blockAgg[blockName] = { valid_votes: 0, party_votes: {} };
    }
    blockAgg[blockName].valid_votes += agg.valid_votes;
    for (const [partyCode, votes] of Object.entries(agg.party_votes)) {
      blockAgg[blockName].party_votes[partyCode] =
        (blockAgg[blockName].party_votes[partyCode] || 0) + votes;
    }
  }
}

function getFeatureLabelText(feature) {
  const granularity = granularitySelect.value;
  if (granularity === "muni") {
    const muniCode = String(feature.properties.muni_code || "").padStart(5, "0");
    const rec = electionData[muniCode] || {};
    return `${rec.name || feature.properties.muni_name || ""}`.trim();
  }
  if (granularity === "pref") {
    return feature.properties.pref_name || "";
  }
  return feature.properties.block_name || "";
}

function ringAreaCoords(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % ring.length];
    const lng1 = p1[0];
    const lat1 = p1[1];
    const lng2 = p2[0];
    const lat2 = p2[1];
    if (
      typeof lng1 !== "number" || typeof lat1 !== "number" ||
      typeof lng2 !== "number" || typeof lat2 !== "number"
    ) {
      return 0;
    }
    area += (lng1 * lat2) - (lng2 * lat1);
  }
  return Math.abs(area / 2);
}

function getLabelAnchor(layer) {
  try {
    const props = layer?.feature?.properties || {};
    if (
      typeof props.label_lat === "number" &&
      typeof props.label_lng === "number"
    ) {
      return L.latLng(props.label_lat, props.label_lng);
    }

    const geom = layer?.feature?.geometry;
    if (!geom || !geom.type || !Array.isArray(geom.coordinates)) {
      return layer.getBounds().getCenter();
    }

    let polygons = [];
    if (geom.type === "Polygon") {
      polygons = [geom.coordinates];
    } else if (geom.type === "MultiPolygon") {
      polygons = geom.coordinates;
    } else {
      return layer.getBounds().getCenter();
    }

    const mapCenter = map.getCenter();
    const viewBounds = map.getBounds().pad(0.25);
    let best = null;
    for (const poly of polygons) {
      const outerRing = Array.isArray(poly) ? poly[0] : null;
      if (!outerRing || outerRing.length < 3) continue;
      const latlngRing = outerRing
        .map((p) => Array.isArray(p) && p.length >= 2 ? L.latLng(p[1], p[0]) : null)
        .filter((p) => p !== null);
      if (latlngRing.length < 3) continue;
      const polyLayer = L.polygon(latlngRing);
      const center = polyLayer.getCenter();
      const area = ringAreaCoords(outerRing);
      const inView = viewBounds.contains(center);
      const dist = center.distanceTo(mapCenter);
      // Prefer components currently in view; otherwise nearest to view center.
      const score = (inView ? 1_000_000_000 : 0) - dist + (area * 1_000);
      if (!best || score > best.score) {
        best = { score, center };
      }
    }

    if (best && best.center) {
      return best.center;
    }
    return layer.getBounds().getCenter();
  } catch (_err) {
    return layer.getBounds().getCenter();
  }
}

function updateLabels() {
  if (!geoLayer) return;
  const granularity = granularitySelect.value;
  const zoom = map.getZoom();

  const policy = (() => {
    if (granularity === "block") return { minZoom: 4, maxLabels: 30 };
    if (granularity === "pref") return { minZoom: 5, maxLabels: 47 };
    if (zoom >= 11) return { minZoom: 11, maxLabels: 300 };
    if (zoom >= 10) return { minZoom: 10, maxLabels: 180 };
    if (zoom >= 9) return { minZoom: 9, maxLabels: 90 };
    return { minZoom: 99, maxLabels: 0 };
  })();

  const clearAll = () => {
    geoLayer.eachLayer((layer) => {
      if (layer.getTooltip()) layer.unbindTooltip();
    });
  };

  if (!labelsVisible || zoom < policy.minZoom) {
    clearAll();
    return;
  }

  const viewBounds = map.getBounds().pad(0.15);
  const candidates = [];
  const anchorByLayer = new Map();
  geoLayer.eachLayer((layer) => {
    if (!layer.feature || !layer.getBounds) return;
    const anchor = getLabelAnchor(layer);
    anchorByLayer.set(layer, anchor);
    const b = layer.getBounds();
    if (!anchor || !viewBounds.contains(anchor)) {
      if (layer.getTooltip()) layer.unbindTooltip();
      return;
    }
    const props = layer.feature?.properties || {};
    const areaWeight = Number.isFinite(props.main_area_km2)
      ? Number(props.main_area_km2)
      : (Number.isFinite(props.area_km2)
          ? Number(props.area_km2)
          : Math.abs((b.getEast() - b.getWest()) * (b.getNorth() - b.getSouth())));
    candidates.push({ layer, areaWeight });
  });

  candidates.sort((a, b) => b.areaWeight - a.areaWeight);
  const selected = new Set(candidates.slice(0, policy.maxLabels).map((x) => x.layer));

  geoLayer.eachLayer((layer) => {
    if (!selected.has(layer)) {
      if (layer.getTooltip()) layer.unbindTooltip();
      return;
    }
    const label = getFeatureLabelText(layer.feature);
    if (!label) return;
    const anchor = anchorByLayer.get(layer) || getLabelAnchor(layer);
    const existing = layer.getTooltip();
    if (!existing || existing.getContent() !== label) {
      if (existing) layer.unbindTooltip();
      layer.bindTooltip(label, {
        permanent: true,
        direction: "center",
        className: "map-label",
        opacity: 0.95,
      });
      layer.openTooltip(anchor);
    } else if (anchor) {
      layer.openTooltip(anchor);
    }
  });
}

function renderGeoLayer() {
  const granularity = granularitySelect.value;
  const geo = geojsonByGranularity[granularity];
  if (!geo) return;
  if (geoLayer) {
    map.removeLayer(geoLayer);
  }
  geoLayer = L.geoJSON(geo, {
    renderer: canvasRenderer,
    style: featureStyle,
    onEachFeature,
  }).addTo(map);
  updatePrefBorderOverlay(granularity);
  currentGranularity = granularity;
  updateLabels();
}

function updatePrefBorderOverlay(granularity) {
  if (prefBorderLayer) {
    map.removeLayer(prefBorderLayer);
    prefBorderLayer = null;
  }
  if (granularity !== "muni" || !prefBordersVisible) return;
  const prefGeo = geojsonByGranularity.pref;
  if (!prefGeo) return;
  prefBorderLayer = L.geoJSON(prefGeo, {
    renderer: canvasRenderer,
    interactive: false,
    style: {
      fill: false,
      stroke: true,
      color: "#1f2937",
      weight: 1.0,
      opacity: 0.9,
    },
  }).addTo(map);
}

function featureStyle(feature) {
  const stats = getFeatureRenderStats(feature);
  let fillColor;
  if (isRankMode()) {
    fillColor = stats.partyCode ? partyColor(stats.partyCode) : NODATA_COLOR;
  } else if (isPartyRankMode()) {
    fillColor = getPartyRankColor(stats.rank);
  } else if (isConcentrationMode()) {
    fillColor = getColorFromPalette(stats.share, activeMax, SHARE_COLORS, CONCENTRATION_CONTRAST_GAMMA);
  } else if (isSignedDiffMode() || isRulingRatioMode() || isSelectedRatioMode()) {
    if (stats.share == null || Number.isNaN(stats.share)) {
      fillColor = NODATA_COLOR;
    } else if (activeCrossesZero) {
      const maxAbs = Math.max(Math.abs(activeMin), Math.abs(activeMax), 0.01);
      const t = clamp01((stats.share / maxAbs + 1) / 2);
      fillColor = interpolateFromPalette(SELECTED_VS_TOP_DIVERGING_COLORS, t);
    } else {
      const clippedGap = Math.max(activeMin, Math.min(activeMax, stats.share));
      const range = Math.max(activeMax - activeMin, 0.01);
      if (activeMin >= 0) {
        // All >= 0 means baseline is always better. Stronger better -> darker pink.
        const tBetter = clamp01((clippedGap - activeMin) / range);
        fillColor = interpolateFromPalette(SELECTED_VS_TOP_BETTER_COLORS, skewRight(tBetter));
      } else {
        // All <= 0 means baseline is always worse. Stronger worse -> darker green.
        const tWorse = clamp01((activeMax - clippedGap) / range);
        fillColor = interpolateFromPalette(SELECTED_VS_TOP_WORSE_COLORS, skewRight(tWorse));
      }
    }
  } else {
    fillColor = getColorFromPalette(stats.share, activeMax, SHARE_COLORS, CONCENTRATION_CONTRAST_GAMMA);
  }
  return {
    fillColor,
    weight: 0.4,
    color: "#626b75",
    opacity: 1,
    fillOpacity: 0.8,
  };
}

function getGranularityLabel() {
  if (granularitySelect.value === "muni") return "市区町村";
  if (granularitySelect.value === "pref") return "都道府県";
  return "ブロック";
}

function onEachFeature(feature, layer) {
  layer.on({
    mouseover: (e) => {
      e.target.setStyle({ weight: 1.3, color: "#1f2937" });
      e.target.bringToFront();
    },
    mouseout: (e) => {
      geoLayer.resetStyle(e.target);
    },
    click: (e) => {
      const stats = getFeatureRenderStats(feature);
      let popup;
      if (isRankMode()) {
        popup = `
          <strong>${stats.label}</strong><br>
          順位: ${
            plotModeSelect.value === "opposition_rank"
              ? `野党第${stats.rank}党`
              : `第${stats.rank}位`
          }<br>
          政党: ${stats.partyName || "N/A"}<br>
          得票率: ${pct(stats.share)}<br>
          有効投票数: ${(stats.validVotes ?? "N/A").toLocaleString?.() || stats.validVotes || "N/A"}
        `;
      } else if (isPartyRankMode()) {
        const selectedCode = partySelect.value;
        const allRanksHtml = buildPartyRankPopupRows(feature, selectedCode);
        popup = `
          <strong>${stats.label}</strong><br>
          政党: ${stats.partyName || "N/A"}<br>
          順位: ${stats.rank != null ? `第${stats.rank}位` : "N/A"}<br>
          得票率: ${pct(stats.share)}<br>
          有効投票数: ${(stats.validVotes ?? "N/A").toLocaleString?.() || stats.validVotes || "N/A"}<br>
          <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
          ${allRanksHtml}
        `;
      } else if (isSelectedVsTopMode()) {
        const targetLabel = stats.compareTargetLabel || "第1党";
        const diffText = stats.metricMode === "ratio"
          ? ratioLabel(stats.ratio)
          : ppSignedLabel(stats.gap);
        const summaryLabel = stats.metricMode === "ratio" ? "比" : "差";
        const allRanksHtml = buildPartyRankPopupRows(feature, partySelect.value, stats.targetPartyCode);
        popup = `
          <strong>${stats.label}</strong><br>
          <strong>${stats.partyName || "N/A"}</strong>と<strong>${targetLabel}</strong>の${summaryLabel}: ${diffText}<br>
          有効投票数: ${(stats.validVotes ?? "N/A").toLocaleString?.() || stats.validVotes || "N/A"}<br>
          <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
          ${allRanksHtml}
        `;
      } else if (isRulingVsOppositionMode()) {
        const diffText = stats.metricMode === "ratio"
          ? ratioLabel(stats.ratio)
          : ppSignedLabel(stats.gap);
        const diffLabel = stats.metricMode === "ratio"
          ? "与党（自民・維新）/野党（それ以外）"
          : "与党（自民・維新）と野党（それ以外）の差";
        const allRanksHtml = buildPartyRankPopupRows(feature, null, null);
        popup = `
          <strong>${stats.label}</strong><br>
          <strong>${diffLabel}</strong>: ${diffText}<br>
          有効投票数: ${(stats.validVotes ?? "N/A").toLocaleString?.() || stats.validVotes || "N/A"}<br>
          <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
          ${allRanksHtml}
        `;
      } else if (isConcentrationMode()) {
        const allRanksHtml = buildPartyRankPopupRows(feature, null, null);
        popup = `
          <strong>${stats.label}</strong><br>
          ハーフィンダール・ハーシュマン指数 (HHI): ${stats.concentration == null ? "N/A" : stats.concentration.toFixed(3)}<br>
          実効政党数 (1/HHI): ${
            stats.effectivePartyCount == null ? "N/A" : stats.effectivePartyCount.toFixed(2)
          }<br>
          有効投票数: ${(stats.validVotes ?? "N/A").toLocaleString?.() || stats.validVotes || "N/A"}<br>
          <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
          ${allRanksHtml}
        `;
      } else {
        const selectedCode = partySelect.value;
        const allRanksHtml = buildPartyRankPopupRows(feature, selectedCode);
        popup = `
          <strong>${stats.label}</strong><br>
          政党: ${stats.partyName || "N/A"}<br>
          得票率: ${pct(stats.share)}<br>
          有効投票数: ${(stats.validVotes ?? "N/A").toLocaleString?.() || stats.validVotes || "N/A"}<br>
          <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
          ${allRanksHtml}
        `;
      }
      e.target.bindPopup(popup).openPopup();
    },
  });
}

function updateStats() {
  if (isPartyRankMode()) {
    const selectedCode = partySelect.value;
    const partyName = partyNameByCode[selectedCode] || selectedCode;
    const counts = {};
    const geo = geojsonByGranularity[granularitySelect.value];
    for (const feature of geo?.features || []) {
      const rank = getPartyRankForFeature(feature, selectedCode).rank;
      if (rank != null) counts[rank] = (counts[rank] || 0) + 1;
    }
    const firstPlaceCount = counts[1] || 0;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    statsEl.innerHTML = `
      <div class="name">${partyName} の順位分布</div>
      <div>表示単位: ${
        granularitySelect.value === "muni"
          ? "市区町村"
          : (granularitySelect.value === "pref" ? "都道府県" : "ブロック")
      }</div>
      <div>第1位の件数: ${firstPlaceCount.toLocaleString()}</div>
      <div>最頻順位: ${top ? `第${top[0]}位` : "N/A"} (${top ? top[1].toLocaleString() : 0})</div>
    `;
    return;
  }

  if (isRankMode()) {
    const rank = Number.parseInt(rankSelect.value, 10) || 1;
    const counts = {};
    const geo = geojsonByGranularity[granularitySelect.value];
    for (const feature of geo?.features || []) {
      const ranked = getRankedPartiesForFeature(feature, getExcludedPartyCodeForMode());
      const p = ranked[rank - 1];
      if (p) counts[p.code] = (counts[p.code] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    statsEl.innerHTML = `
      <div class="name">${
        plotModeSelect.value === "opposition_rank"
          ? `野党第${rank}党`
          : `第${rank}位の政党`
      }</div>
      <div>表示単位: ${
        granularitySelect.value === "muni"
          ? "市区町村"
          : (granularitySelect.value === "pref" ? "都道府県" : "ブロック")
      }</div>
      <div>最多: ${top ? (partyNameByCode[top[0]] || top[0]) : "N/A"}</div>
      <div>件数: ${top ? top[1].toLocaleString() : 0}</div>
    `;
    return;
  }

  if (isSelectedVsTopMode()) {
    const selectedCode = partySelect.value;
    const selectedName = partyNameByCode[selectedCode] || selectedCode;
    const targetLabel = getCompareTargetLabel();
    const metricMode = getSelectedMetricMode();
    const geo = geojsonByGranularity[granularitySelect.value];
    const rows = [];
    for (const feature of geo?.features || []) {
      const s = getFeatureRenderStats(feature);
      if (metricMode === "ratio") {
        if (typeof s.ratio === "number" && !Number.isNaN(s.ratio)) rows.push(s);
      } else if (typeof s.gap === "number" && !Number.isNaN(s.gap)) {
        rows.push(s);
      }
    }
    if (!rows.length) {
      statsEl.innerHTML = `<div class="name">${selectedName}と${targetLabel}${metricMode === "ratio" ? "の比" : "の差"}</div><div>データなし</div>`;
      return;
    }
    const metricKey = metricMode === "ratio" ? "ratio" : "gap";
    const sortedAsc = [...rows].sort((a, b) => a[metricKey] - b[metricKey]);
    const sortedDesc = [...rows].sort((a, b) => b[metricKey] - a[metricKey]);
    const closest = sortedAsc[0];
    const farthest = sortedDesc[0];
    const avgValue = rows.reduce((acc, r) => acc + r[metricKey], 0) / rows.length;
    const fmt = (v) => (metricMode === "ratio" ? ratioLabel(v) : ppSignedLabel(v));
    statsEl.innerHTML = `
      <div class="name">${selectedName}と${targetLabel}${metricMode === "ratio" ? "の比" : "の差"}</div>
      <div>平均: ${fmt(avgValue)}</div>
      <div>最小: ${fmt(closest[metricKey])} (${closest.label})</div>
      <div>最大: ${fmt(farthest[metricKey])} (${farthest.label})</div>
    `;
    return;
  }

  if (isRulingVsOppositionMode()) {
    const geo = geojsonByGranularity[granularitySelect.value];
    const rows = [];
    for (const feature of geo?.features || []) {
      const s = getFeatureRenderStats(feature);
      if (getRulingMetricMode() === "ratio") {
        if (typeof s.ratio === "number" && !Number.isNaN(s.ratio)) rows.push(s);
      } else if (typeof s.gap === "number" && !Number.isNaN(s.gap)) {
        rows.push(s);
      }
    }
    if (!rows.length) {
      const emptyTitle = getRulingMetricMode() === "ratio"
        ? "与党（自民・維新）/野党（それ以外）"
        : "与党（自民・維新）と野党（それ以外）の差";
      statsEl.innerHTML = `<div class="name">${emptyTitle}</div><div>データなし</div>`;
      return;
    }
    const metricMode = getRulingMetricMode();
    const metricKey = metricMode === "ratio" ? "ratio" : "gap";
    const sortedAsc = [...rows].sort((a, b) => a[metricKey] - b[metricKey]);
    const sortedDesc = [...rows].sort((a, b) => b[metricKey] - a[metricKey]);
    const closest = sortedAsc[0];
    const farthest = sortedDesc[0];
    const avgValue = rows.reduce((acc, r) => acc + r[metricKey], 0) / rows.length;
    const fmt = (v) => (metricMode === "ratio" ? ratioLabel(v) : ppSignedLabel(v));
    const title = metricMode === "ratio"
      ? "与党（自民・維新）/野党（それ以外）"
      : "与党（自民・維新）と野党（それ以外）の差";
    statsEl.innerHTML = `
      <div class="name">${title}</div>
      <div>平均: ${fmt(avgValue)}</div>
      <div>最小: ${fmt(closest[metricKey])} (${closest.label})</div>
      <div>最大: ${fmt(farthest[metricKey])} (${farthest.label})</div>
    `;
    return;
  }

  if (isConcentrationMode()) {
    const geo = geojsonByGranularity[granularitySelect.value];
    const rows = [];
    for (const feature of geo?.features || []) {
      const s = getFeatureRenderStats(feature);
      if (typeof s.concentration === "number" && !Number.isNaN(s.concentration)) rows.push(s);
    }
    if (!rows.length) {
      statsEl.innerHTML = `<div class="name">ハーフィンダール・ハーシュマン指数 (HHI)</div><div>データなし</div>`;
      return;
    }
    const avgHHI = rows.reduce((acc, r) => acc + r.concentration, 0) / rows.length;
    const maxHHI = [...rows].sort((a, b) => b.concentration - a.concentration)[0];
    const minHHI = [...rows].sort((a, b) => a.concentration - b.concentration)[0];
    const avgEffective = avgHHI > 0 ? (1 / avgHHI) : null;
    statsEl.innerHTML = `
      <div class="name">ハーフィンダール・ハーシュマン指数 (HHI)</div>
      <div>表示単位: ${getGranularityLabel()}</div>
      <div>平均HHI: ${avgHHI.toFixed(3)}</div>
      <div>平均実効政党数 (1/HHI): ${avgEffective == null ? "N/A" : avgEffective.toFixed(2)}</div>
      <div>最も集中: ${maxHHI.label} (${maxHHI.concentration.toFixed(3)})</div>
      <div>最も分散: ${minHHI.label} (${minHHI.concentration.toFixed(3)})</div>
    `;
    return;
  }

  const selectedCode = partySelect.value;
  const summary = parties.find((p) => p.code === selectedCode);
  if (!summary) return;
  const geo = geojsonByGranularity[granularitySelect.value];
  const rows = [];
  for (const feature of geo?.features || []) {
    const s = getFeatureRenderStats(feature);
    if (typeof s.share === "number" && !Number.isNaN(s.share)) rows.push(s);
  }
  if (!rows.length) {
    statsEl.innerHTML = `
      <div class="name">${summary.name}</div>
      <div>全国得票数: ${summary.total_votes.toLocaleString()} 票</div>
      <div>市区町村数: ${summary.municipalities.toLocaleString()}</div>
      <div>データなし</div>
    `;
    return;
  }
  const sortedAsc = [...rows].sort((a, b) => a.share - b.share);
  const sortedDesc = [...rows].sort((a, b) => b.share - a.share);
  const minRow = sortedAsc[0];
  const maxRow = sortedDesc[0];
  const avgShare = rows.reduce((acc, r) => acc + r.share, 0) / rows.length;
  statsEl.innerHTML = `
    <div class="name">${summary.name}</div>
    <div>全国得票数: ${summary.total_votes.toLocaleString()} 票</div>
    <div>市区町村数: ${summary.municipalities.toLocaleString()}</div>
    <div>平均得票率: ${pct(avgShare)}</div>
    <div>最小得票率: ${pct(minRow.share)} (${minRow.label})</div>
    <div>最大得票率: ${pct(maxRow.share)} (${maxRow.label})</div>
  `;
}

function recolor() {
  if (!geoLayer) return;
  computeActivePartyRankMax();
  if (plotModeSelect.value === "share") {
    computeActiveScale();
    activeMin = 0;
    activeCrossesZero = false;
  } else if (isSelectedVsTopMode()) {
    const selectedCode = partySelect.value;
    const compareTargetMode = getCompareTargetMode();
    const metricMode = getSelectedMetricMode();
    const values = getSelectedVsTopValuesForCurrentGranularity(selectedCode, compareTargetMode, metricMode).sort((a, b) => a - b);
    if (!values.length) {
      activeMin = -0.01;
      activeMax = 0.01;
      activeCrossesZero = true;
    } else {
      const q05 = quantile(values, 0.05);
      const q95 = quantile(values, 0.95);
      // Always center selected_diff at 0 so white is a fixed neutral reference.
      const maxAbs = Math.max(Math.abs(q05), Math.abs(q95), 0.01);
      activeMin = -maxAbs;
      activeMax = maxAbs;
      activeCrossesZero = true;
    }
  } else if (isRulingVsOppositionMode()) {
    const metricMode = getRulingMetricMode();
    const values = getRulingOppositionValuesForCurrentGranularity(metricMode).sort((a, b) => a - b);
    if (!values.length) {
      activeMin = -0.01;
      activeMax = 0.01;
      activeCrossesZero = true;
    } else {
      const q05 = quantile(values, 0.05);
      const q95 = quantile(values, 0.95);
      const maxAbs = Math.max(Math.abs(q05), Math.abs(q95), 0.01);
      activeMin = -maxAbs;
      activeMax = maxAbs;
      activeCrossesZero = true;
    }
  } else if (isConcentrationMode()) {
    activeMin = 0;
    activeCrossesZero = false;
    const geo = geojsonByGranularity[granularitySelect.value];
    const values = [];
    for (const feature of geo?.features || []) {
      const stats = getFeatureRenderStats(feature);
      if (typeof stats.share === "number" && !Number.isNaN(stats.share)) {
        values.push(stats.share);
      }
    }
    values.sort((a, b) => a - b);
    const q95 = quantile(values, 0.95);
    activeMax = q95 > 0 ? q95 : 1;
  }
  updateLegend();
  geoLayer.setStyle(featureStyle);
  updateLabels();
  updateStats();
}

function populatePartySelect() {
  partySelect.innerHTML = "";
  for (const p of parties) {
    const option = document.createElement("option");
    option.value = p.code;
    option.textContent = p.name;
    partySelect.appendChild(option);
  }
}

function populateCompareTargetSelect() {
  const prev = compareTargetSelect.value;
  compareTargetSelect.innerHTML = "";
  const topOption = document.createElement("option");
  topOption.value = "top";
  topOption.textContent = "第1党";
  compareTargetSelect.appendChild(topOption);

  const group = document.createElement("optgroup");
  group.label = "各政党";
  for (const p of parties) {
    const option = document.createElement("option");
    option.value = p.code;
    option.textContent = p.name;
    group.appendChild(option);
  }
  compareTargetSelect.appendChild(group);

  const validValues = new Set(["top", ...parties.map((p) => p.code)]);
  compareTargetSelect.value = validValues.has(prev) ? prev : "top";
}

function populateRankSelect() {
  rankSelect.innerHTML = "";
  const maxRank = Math.max(parties.length, 1);
  for (let r = 1; r <= maxRank; r += 1) {
    const option = document.createElement("option");
    option.value = String(r);
    option.textContent = `第${r}位`;
    rankSelect.appendChild(option);
  }
}

function updateControlVisibility() {
  const isRank = isRankMode();
  const isPartyRank = isPartyRankMode();
  const isSelectedVsTop = isSelectedVsTopMode();
  const isRulingVsOpposition = isRulingVsOppositionMode();
  const isConcentration = isConcentrationMode();
  const isMuni = granularitySelect.value === "muni";
  const showModeHelp = isAnyRankMode() || isSelectedVsTop || isRulingVsOpposition || isConcentration;
  groupParty.classList.toggle("hidden", isRank || isConcentration || isRulingVsOpposition);
  groupCompareTarget.classList.toggle("hidden", !isSelectedVsTop);
  groupSelectedMetric.classList.toggle("hidden", !isSelectedVsTop);
  selectedMetricHelpEl?.classList.toggle("hidden", !isSelectedVsTop);
  if (isSelectedVsTop && selectedMetricHelpEl) {
    selectedMetricHelpEl.innerHTML = getSelectedMetricMode() === "ratio"
      ? "基準政党と比較対象の得票数の比率（基準/比較）を表示します。1.00が拮抗、1より大きいほど基準政党優勢、1より小さいほど基準政党劣勢です。"
      : "基準政党と比較対象の得票率の差（基準 - 比較）を表示します。0.0 ptが拮抗、正の値は基準政党優勢、負の値は基準政党劣勢です。";
  }
  groupRulingMetric.classList.toggle("hidden", !isRulingVsOpposition);
  rulingMetricHelpEl?.classList.toggle("hidden", !isRulingVsOpposition);
  if (isRulingVsOpposition && rulingMetricHelpEl) {
    rulingMetricHelpEl.innerHTML = getRulingMetricMode() === "ratio"
      ? "与党と野党の得票数の比率（与党/野党）を表示します。1.00が拮抗、1より大きいほど与党優勢、1より小さいほど野党優勢です。"
      : "与党と野党の得票率の差（与党 - 野党）を表示します。0.0 ptが拮抗、正の値は与党優勢、負の値は野党優勢です。";
  }
  groupScaleMode.classList.toggle("hidden", plotModeSelect.value !== "share");
  scaleHelpEl.classList.toggle("hidden", plotModeSelect.value !== "share");
  groupRank.classList.toggle("hidden", !isRank);
  groupPrefBorders.classList.toggle("hidden", !isMuni);
  modeHelpEl.classList.toggle("hidden", !showModeHelp);
  if (plotModeSelect.value === "opposition_rank") {
    modeHelpEl.textContent = "各地域で自民党を除いた第N位の政党を色分け表示します。";
  } else if (plotModeSelect.value === "party_rank") {
    modeHelpEl.textContent = "選択した政党の順位（第1位, 第2位, ...）を地域ごとに色分け表示します。";
  } else if (plotModeSelect.value === "rank") {
    modeHelpEl.textContent = "各地域で第N位の政党を色分け表示します。";
  } else if (plotModeSelect.value === "selected_diff") {
    modeHelpEl.textContent = "二つの政党（基準政党と比較対象）の比較を表示します。";
  } else if (plotModeSelect.value === "ruling_vs_opposition") {
    modeHelpEl.textContent = "与党（自民・維新）と野党（それ以外）の比較を表示します。";
  } else if (plotModeSelect.value === "concentration") {
    modeHelpEl.innerHTML = `<a href="${HHI_WIKI_URL}" target="_blank" rel="noopener noreferrer">ハーフィンダール・ハーシュマン指数 (HHI)</a> を表示します。値が高いほど特定政党への集中が強いことを示します。`;
  }
}

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (!params.toString()) {
    // Default state when opening index.html without query params.
    granularitySelect.value = "muni";
    plotModeSelect.value = "share";
    partySelect.value = parties.some((p) => p.code === "mirai") ? "mirai" : (partySelect.value || "");
    scaleModeSelect.value = "party";
    labelsVisible = true;
    labelToggle.checked = true;
    prefBordersVisible = true;
    prefBorderToggle.checked = true;
    return;
  }
  // Backward-compatible query parsing:
  // - selected_diff: prefer base/target, fallback to party/compareTarget
  // - other modes: keep using party
  const qParty = params.get("party");
  const qBase = params.get("base");
  const qScale = params.get("scale");
  const qGranularity = params.get("granularity");
  const qMode = params.get("mode");
  const qCompareTargetRaw = params.get("target") || params.get("compareTarget");
  const qCompareTarget = qCompareTargetRaw && qCompareTargetRaw.startsWith("party:")
    ? qCompareTargetRaw.slice("party:".length)
    : qCompareTargetRaw;
  const qMetric = params.get("metric");
  const qSelectedMetric = params.get("selectedMetric");
  const qRulingMetric = params.get("rulingMetric");
  const qRank = params.get("rank");
  const qLabels = params.get("labels");
  const qPrefBorders = params.get("prefBorders");
  const qPartyEffective = qBase || qParty;
  if (qPartyEffective && parties.some((p) => p.code === qPartyEffective)) {
    partySelect.value = qPartyEffective;
  }
  if (qScale && (qScale === "fixed" || qScale === "party")) {
    scaleModeSelect.value = qScale;
  }
  if (qGranularity && (qGranularity === "block" || qGranularity === "pref" || qGranularity === "muni")) {
    granularitySelect.value = qGranularity;
  }
  const normalizedMode = qMode === "selected_vs_top" ? "selected_diff" : qMode;
  if (
    normalizedMode &&
    (
      normalizedMode === "share" ||
      normalizedMode === "rank" ||
      normalizedMode === "opposition_rank" ||
      normalizedMode === "party_rank" ||
      normalizedMode === "selected_diff" ||
      normalizedMode === "ruling_vs_opposition" ||
      normalizedMode === "concentration"
    )
  ) {
    plotModeSelect.value = normalizedMode;
  }
  if (qRank) {
    const rankNum = Number.parseInt(qRank, 10);
    if (Number.isInteger(rankNum) && rankNum >= 1 && rankNum <= parties.length) {
      rankSelect.value = String(rankNum);
    }
  }
  if (
    qCompareTarget &&
    (
      qCompareTarget === "top" ||
      parties.some((p) => p.code === qCompareTarget)
    )
  ) {
    compareTargetSelect.value = qCompareTarget;
  }
  if (plotModeSelect.value === "selected_diff") {
    const metric = qMetric || qSelectedMetric;
    if (metric && (metric === "diff" || metric === "ratio")) {
      selectedMetricSelect.value = metric;
    }
  }
  if (plotModeSelect.value === "ruling_vs_opposition") {
    const metric = qMetric || qRulingMetric;
    if (metric && (metric === "diff" || metric === "ratio")) {
      rulingMetricSelect.value = metric;
    }
  }
  if (qLabels === "0" || qLabels === "false") {
    labelsVisible = false;
    labelToggle.checked = false;
  } else {
    // Default ON when omitted.
    labelsVisible = true;
    labelToggle.checked = true;
  }
  if (qPrefBorders === "0" || qPrefBorders === "false") {
    prefBordersVisible = false;
    prefBorderToggle.checked = false;
  } else {
    // Default ON when omitted.
    prefBordersVisible = true;
    prefBorderToggle.checked = true;
  }
  updateGeoPaneBlendMode();
}

function writeStateToUrl() {
  const url = new URL(window.location.href);
  const mode = plotModeSelect.value;

  // Always-relevant state
  url.searchParams.delete("granularity");
  if (granularitySelect.value !== "muni") {
    url.searchParams.set("granularity", granularitySelect.value);
  }
  url.searchParams.set("mode", mode);
  url.searchParams.delete("labels");
  url.searchParams.delete("prefBorders");
  if (!labelsVisible) url.searchParams.set("labels", "0");
  if (!prefBordersVisible) url.searchParams.set("prefBorders", "0");

  // Clear mode-specific params first.
  url.searchParams.delete("party");
  url.searchParams.delete("base");
  url.searchParams.delete("scale");
  url.searchParams.delete("compareTarget");
  url.searchParams.delete("target");
  url.searchParams.delete("metric");
  url.searchParams.delete("selectedMetric");
  url.searchParams.delete("rulingMetric");
  url.searchParams.delete("rank");

  if (mode === "share") {
    url.searchParams.set("party", partySelect.value);
    url.searchParams.set("scale", scaleModeSelect.value);
  } else if (mode === "party_rank") {
    url.searchParams.set("party", partySelect.value);
  } else if (mode === "rank" || mode === "opposition_rank") {
    url.searchParams.set("rank", rankSelect.value);
  } else if (mode === "selected_diff") {
    url.searchParams.set("base", partySelect.value);
    url.searchParams.set("target", compareTargetSelect.value);
    url.searchParams.set("metric", selectedMetricSelect.value);
  } else if (mode === "ruling_vs_opposition") {
    url.searchParams.set("metric", rulingMetricSelect.value);
  }

  window.history.replaceState({}, "", url);
}

function handleControlChange() {
  const currentMode = plotModeSelect.value;
  const modeChanged = lastPlotMode !== null && lastPlotMode !== currentMode;
  if (modeChanged && currentMode === "share") {
    if (parties.some((p) => p.code === "mirai")) {
      partySelect.value = "mirai";
    }
    scaleModeSelect.value = "party";
  }

  labelsVisible = labelToggle.checked;
  prefBordersVisible = prefBorderToggle.checked;
  updateGeoPaneBlendMode();
  if (geoLayer && granularitySelect.value !== currentGranularity) {
    renderGeoLayer();
  }
  updatePrefBorderOverlay(granularitySelect.value);
  updateControlVisibility();
  writeStateToUrl();
  recolor();
  lastPlotMode = currentMode;
}

async function init() {
  const [muniGeojson, prefGeojson, blockGeojson, election, partyList] = await Promise.all([
    fetch("./data/municipalities.geojson").then((r) => r.json()),
    fetch("./data/prefectures.geojson").then((r) => r.json()),
    fetch("./data/blocks.geojson").then((r) => r.json()),
    fetch("./data/election_data.json").then((r) => r.json()),
    fetch("./data/parties.json").then((r) => r.json()),
  ]);

  geojsonByGranularity = {
    muni: muniGeojson,
    pref: prefGeojson,
    block: blockGeojson,
  };
  electionData = election;
  parties = partyList;
  partyNameByCode = Object.fromEntries(parties.map((p) => [p.code, p.name]));
  buildPartyColorMap();
  for (const f of prefGeojson.features || []) {
    if (f?.properties?.pref_name && f?.properties?.block_name) {
      prefToBlock[f.properties.pref_name] = f.properties.block_name;
    }
  }
  buildAggregates();
  ensureGeoPane();
  populatePartySelect();
  populateCompareTargetSelect();
  populateRankSelect();
  readStateFromUrl();
  lastPlotMode = plotModeSelect.value;
  updateControlVisibility();
  renderGeoLayer();

  partySelect.addEventListener("change", handleControlChange);
  scaleModeSelect.addEventListener("change", handleControlChange);
  granularitySelect.addEventListener("change", handleControlChange);
  plotModeSelect.addEventListener("change", handleControlChange);
  compareTargetSelect.addEventListener("change", handleControlChange);
  selectedMetricSelect.addEventListener("change", handleControlChange);
  rulingMetricSelect.addEventListener("change", handleControlChange);
  rankSelect.addEventListener("change", handleControlChange);
  labelToggle.addEventListener("change", handleControlChange);
  prefBorderToggle.addEventListener("change", handleControlChange);
  map.on("zoomend", updateLabels);
  map.on("moveend", updateLabels);
  writeStateToUrl();
  recolor();
}

init().catch((err) => {
  console.error(err);
  statsEl.innerHTML = "データ読み込みに失敗しました。";
});
