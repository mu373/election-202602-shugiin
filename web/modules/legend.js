import { state } from "./state.js";
import { granularitySelect, rankSelect, legendTitleEl, legendEl } from "./dom.js";
import {
  NODATA_COLOR,
  SHARE_COLORS,
  SELECTED_VS_TOP_BETTER_COLORS,
  SELECTED_VS_TOP_WORSE_COLORS,
  SELECTED_VS_TOP_DIVERGING_COLORS,
} from "./constants.js";
import {
  isPartyRankMode,
  isRankMode,
  isSelectedVsTopMode,
  isRulingVsOppositionMode,
  isConcentrationMode,
  isWinnerMarginMode,
  isNationalDivergenceMode,
  isSignedDiffMode,
  isRulingRatioMode,
  isSelectedRatioMode,
  getExcludedPartyCodeForMode,
  getPartyRankColor,
  getFeatureRenderStats,
} from "./modes.js";
import { partyColor, getRankedPartiesForFeature } from "./data.js";
import { pctLabel, ppLabel, ratioLabel } from "./format.js";
import { MODE_LABELS, buildLabelContext, resolveLabel } from "./mode-labels.js";

export function updateLegend() {
  updateLegendTitle();
  if (isPartyRankMode()) {
    const counts = {};
    const geo = state.geojsonByGranularity[granularitySelect.value];
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
    const geo = state.geojsonByGranularity[granularitySelect.value];
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
      row.innerHTML = `<span class="legend-swatch" style="background:${partyColor(code)}"></span>${state.partyNameByCode[code] || code} (${nAreas})`;
      legendEl.appendChild(row);
    }
    const noDataRow = document.createElement("div");
    noDataRow.className = "legend-row";
    noDataRow.innerHTML = `<span class="legend-swatch" style="background:${NODATA_COLOR}"></span>データなし`;
    legendEl.appendChild(noDataRow);
    return;
  }

  const legendPalette = (() => {
    if (isConcentrationMode() || isWinnerMarginMode() || isNationalDivergenceMode()) return SHARE_COLORS;
    if (!(isSignedDiffMode() || isRulingRatioMode() || isSelectedRatioMode())) return SHARE_COLORS;
    if (state.activeCrossesZero) return SELECTED_VS_TOP_DIVERGING_COLORS;
    if (state.activeMin >= 0) return SELECTED_VS_TOP_BETTER_COLORS;
    return SELECTED_VS_TOP_WORSE_COLORS;
  })();
  const gradientStops = legendPalette.map((c, i) => `${c} ${(i / (legendPalette.length - 1)) * 100}%`).join(", ");
  const selectedMid = state.activeCrossesZero ? 0 : (state.activeMin + ((state.activeMax - state.activeMin) / 2));
  const ratioMid = Math.exp(selectedMid);
  const ratioLeft = Math.exp(state.activeMin);
  const ratioRight = Math.exp(state.activeMax);
  const midLabel = isConcentrationMode()
    ? (state.activeMax / 2).toFixed(3)
    : (isWinnerMarginMode()
      ? ppLabel(state.activeMax / 2)
    : (isNationalDivergenceMode()
      ? (state.activeMax / 2).toFixed(3)
    : (
      (isRulingRatioMode() || isSelectedRatioMode())
        ? ratioLabel(ratioMid)
        : (isSignedDiffMode() ? ppLabel(selectedMid) : pctLabel(state.activeMax / 2))
    )));
  const leftLabel = isConcentrationMode()
    ? "0.000"
    : (isWinnerMarginMode()
      ? ppLabel(0)
    : (isNationalDivergenceMode()
      ? "0.000"
    : (
      (isRulingRatioMode() || isSelectedRatioMode())
        ? ratioLabel(ratioLeft)
        : (isSignedDiffMode() ? ppLabel(state.activeMin) : "0 %")
    )));
  const rightLabel = isConcentrationMode()
    ? state.activeMax.toFixed(3)
    : (isWinnerMarginMode()
      ? ppLabel(state.activeMax)
    : (isNationalDivergenceMode()
      ? state.activeMax.toFixed(3)
    : (
      (isRulingRatioMode() || isSelectedRatioMode())
        ? ratioLabel(ratioRight)
        : (isSignedDiffMode() ? ppLabel(state.activeMax) : pctLabel(state.activeMax))
    )));
  const ctx = buildLabelContext();
  const config = MODE_LABELS[ctx.mode];
  const semanticLeft = config?.semanticLeft ? resolveLabel(config.semanticLeft, ctx) : "";
  const semanticRight = config?.semanticRight ? resolveLabel(config.semanticRight, ctx) : "";
  const semanticRow = (isSignedDiffMode() || isRulingRatioMode() || isSelectedRatioMode())
    ? `<div class="legend-axis"><span>${semanticLeft}</span><span>${(isRulingRatioMode() || isSelectedRatioMode()) ? "拮抗 (1.00)" : "拮抗"}</span><span>${semanticRight}</span></div>`
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

export function updateLegendTitle() {
  if (!legendTitleEl) return;
  const ctx = buildLabelContext();
  const config = MODE_LABELS[ctx.mode];
  legendTitleEl.textContent = config?.legendTitle
    ? resolveLabel(config.legendTitle, ctx)
    : "凡例（得票率）";
}
