import { state } from "./state.js";
import { granularitySelect, plotModeSelect, partySelect, rankSelect, statsEl, statsMirrorEl } from "./dom.js";
import {
  isPartyRankMode,
  isRankMode,
  isSelectedVsTopMode,
  isRulingVsOppositionMode,
  isConcentrationMode,
  isWinnerMarginMode,
  isNationalDivergenceMode,
  getCompareTargetLabel,
  getSelectedMetricMode,
  getRulingMetricMode,
  getExcludedPartyCodeForMode,
  getPartyRankForFeature,
  getFeatureRenderStats,
} from "./modes.js";
import { getRankedPartiesForFeature } from "./data.js";
import { pct, ppLabel, ppSignedLabel, ratioLabel } from "./format.js";
import { MODE_LABELS, buildLabelContext, resolveLabel } from "./mode-labels.js";

function getGranularityLabel() {
  if (granularitySelect.value === "muni") return "市区町村";
  if (granularitySelect.value === "pref") return "都道府県";
  return "ブロック";
}

export function updateStats() {
  updateStatsContent();
  if (statsMirrorEl) statsMirrorEl.innerHTML = statsEl.innerHTML;
}

function updateStatsContent() {
  if (isPartyRankMode()) {
    const ctx = buildLabelContext();
    const config = MODE_LABELS[ctx.mode];
    const selectedCode = partySelect.value;
    const partyName = state.partyNameByCode[selectedCode] || selectedCode;
    const counts = {};
    const geo = state.geojsonByGranularity[granularitySelect.value];
    for (const feature of geo?.features || []) {
      const rank = getPartyRankForFeature(feature, selectedCode).rank;
      if (rank != null) counts[rank] = (counts[rank] || 0) + 1;
    }
    const firstPlaceCount = counts[1] || 0;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    statsEl.innerHTML = `
      <div class="name">${resolveLabel(config.statsTitle, ctx)}</div>
      <div>表示単位: ${getGranularityLabel()}</div>
      <div>第1位の件数: ${firstPlaceCount.toLocaleString()}</div>
      <div>最頻順位: ${top ? `第${top[0]}位` : "N/A"} (${top ? top[1].toLocaleString() : 0})</div>
    `;
    return;
  }

  if (isRankMode()) {
    const ctx = buildLabelContext();
    const config = MODE_LABELS[ctx.mode];
    const rank = Number.parseInt(rankSelect.value, 10) || 1;
    const counts = {};
    const geo = state.geojsonByGranularity[granularitySelect.value];
    for (const feature of geo?.features || []) {
      const ranked = getRankedPartiesForFeature(feature, getExcludedPartyCodeForMode());
      const p = ranked[rank - 1];
      if (p) counts[p.code] = (counts[p.code] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    statsEl.innerHTML = `
      <div class="name">${resolveLabel(config.statsTitle, ctx)}</div>
      <div>表示単位: ${getGranularityLabel()}</div>
      <div>最多: ${top ? `${state.partyNameByCode[top[0]] || top[0]} (${top[1].toLocaleString()})` : "N/A"}</div>
      <div>最少: ${bottom ? `${state.partyNameByCode[bottom[0]] || bottom[0]} (${bottom[1].toLocaleString()})` : "N/A"}</div>
    `;
    return;
  }

  if (isSelectedVsTopMode()) {
    const ctx = buildLabelContext();
    const config = MODE_LABELS[ctx.mode];
    const selectedCode = partySelect.value;
    const selectedName = state.partyNameByCode[selectedCode] || selectedCode;
    const targetLabel = getCompareTargetLabel();
    const metricMode = getSelectedMetricMode();
    const geo = state.geojsonByGranularity[granularitySelect.value];
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
      statsEl.innerHTML = `<div class="name">${resolveLabel(config.statsTitle, ctx)}</div><div>データなし</div>`;
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
      <div class="name">${resolveLabel(config.statsTitle, ctx)}</div>
      <div>平均: ${fmt(avgValue)}</div>
      <div>最小: ${fmt(closest[metricKey])} (${closest.label})</div>
      <div>最大: ${fmt(farthest[metricKey])} (${farthest.label})</div>
    `;
    return;
  }

  if (isRulingVsOppositionMode()) {
    const ctx = buildLabelContext();
    const config = MODE_LABELS[ctx.mode];
    const geo = state.geojsonByGranularity[granularitySelect.value];
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
      statsEl.innerHTML = `<div class="name">${resolveLabel(config.statsTitle, ctx)}</div><div>データなし</div>`;
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
    statsEl.innerHTML = `
      <div class="name">${resolveLabel(config.statsTitle, ctx)}</div>
      <div>平均: ${fmt(avgValue)}</div>
      <div>最小: ${fmt(closest[metricKey])} (${closest.label})</div>
      <div>最大: ${fmt(farthest[metricKey])} (${farthest.label})</div>
    `;
    return;
  }

  if (isConcentrationMode()) {
    const ctx = buildLabelContext();
    const config = MODE_LABELS[ctx.mode];
    const geo = state.geojsonByGranularity[granularitySelect.value];
    const rows = [];
    for (const feature of geo?.features || []) {
      const s = getFeatureRenderStats(feature);
      if (typeof s.concentration === "number" && !Number.isNaN(s.concentration)) rows.push(s);
    }
    if (!rows.length) {
      statsEl.innerHTML = `<div class="name">${resolveLabel(config.statsTitle, ctx)}</div><div>データなし</div>`;
      return;
    }
    const avgHHI = rows.reduce((acc, r) => acc + r.concentration, 0) / rows.length;
    const maxHHI = [...rows].sort((a, b) => b.concentration - a.concentration)[0];
    const minHHI = [...rows].sort((a, b) => a.concentration - b.concentration)[0];
    const avgEffective = avgHHI > 0 ? (1 / avgHHI) : null;
    statsEl.innerHTML = `
      <div class="name">${resolveLabel(config.statsTitle, ctx)}</div>
      <div>表示単位: ${getGranularityLabel()}</div>
      <div>平均HHI: ${avgHHI.toFixed(3)}</div>
      <div>平均実効政党数 (1/HHI): ${avgEffective == null ? "N/A" : avgEffective.toFixed(2)}</div>
      <div>最も集中: ${maxHHI.label} (${maxHHI.concentration.toFixed(3)})</div>
      <div>最も分散: ${minHHI.label} (${minHHI.concentration.toFixed(3)})</div>
    `;
    return;
  }

  if (isWinnerMarginMode()) {
    const ctx = buildLabelContext();
    const config = MODE_LABELS[ctx.mode];
    const geo = state.geojsonByGranularity[granularitySelect.value];
    const rows = [];
    for (const feature of geo?.features || []) {
      const s = getFeatureRenderStats(feature);
      if (typeof s.margin === "number" && !Number.isNaN(s.margin)) rows.push(s);
    }
    if (!rows.length) {
      statsEl.innerHTML = `<div class="name">${resolveLabel(config.statsTitle, ctx)}</div><div>データなし</div>`;
      return;
    }
    const avg = rows.reduce((acc, r) => acc + r.margin, 0) / rows.length;
    const maxRow = [...rows].sort((a, b) => b.margin - a.margin)[0];
    const minRow = [...rows].sort((a, b) => a.margin - b.margin)[0];
    statsEl.innerHTML = `
      <div class="name">${resolveLabel(config.statsTitle, ctx)}</div>
      <div>表示単位: ${getGranularityLabel()}</div>
      <div>平均: ${ppLabel(avg)}</div>
      <div>最も接戦: ${minRow.label} (${ppLabel(minRow.margin)})</div>
      <div>最も大差: ${maxRow.label} (${ppLabel(maxRow.margin)})</div>
    `;
    return;
  }

  if (isNationalDivergenceMode()) {
    const ctx = buildLabelContext();
    const config = MODE_LABELS[ctx.mode];
    const geo = state.geojsonByGranularity[granularitySelect.value];
    const rows = [];
    for (const feature of geo?.features || []) {
      const s = getFeatureRenderStats(feature);
      if (typeof s.nationalDivergence === "number" && !Number.isNaN(s.nationalDivergence)) rows.push(s);
    }
    if (!rows.length) {
      statsEl.innerHTML = `<div class="name">${resolveLabel(config.statsTitle, ctx)}</div><div>データなし</div>`;
      return;
    }
    const avg = rows.reduce((acc, r) => acc + r.nationalDivergence, 0) / rows.length;
    const maxRow = [...rows].sort((a, b) => b.nationalDivergence - a.nationalDivergence)[0];
    const minRow = [...rows].sort((a, b) => a.nationalDivergence - b.nationalDivergence)[0];
    statsEl.innerHTML = `
      <div class="name">${resolveLabel(config.statsTitle, ctx)}</div>
      <div>表示単位: ${getGranularityLabel()}</div>
      <div>平均: ${avg.toFixed(3)}</div>
      <div>最も全国平均から乖離: ${maxRow.label} (${maxRow.nationalDivergence.toFixed(3)})</div>
      <div>最も全国平均に近い: ${minRow.label} (${minRow.nationalDivergence.toFixed(3)})</div>
    `;
    return;
  }

  const selectedCode = partySelect.value;
  const summary = state.parties.find((p) => p.code === selectedCode);
  if (!summary) return;
  const geo = state.geojsonByGranularity[granularitySelect.value];
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
