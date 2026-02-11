import { state } from "./state.js";
import { granularitySelect, plotModeSelect, partySelect, rankSelect, statsEl } from "./dom.js";
import {
  isPartyRankMode,
  isRankMode,
  isSelectedVsTopMode,
  isRulingVsOppositionMode,
  isConcentrationMode,
  getCompareTargetLabel,
  getSelectedMetricMode,
  getRulingMetricMode,
  getExcludedPartyCodeForMode,
  getPartyRankForFeature,
  getFeatureRenderStats,
} from "./modes.js";
import { getRankedPartiesForFeature } from "./data.js";
import { pct, ppSignedLabel, ratioLabel } from "./format.js";

function getGranularityLabel() {
  if (granularitySelect.value === "muni") return "市区町村";
  if (granularitySelect.value === "pref") return "都道府県";
  return "ブロック";
}

export function updateStats() {
  if (isPartyRankMode()) {
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
      <div class="name">${partyName} の順位分布</div>
      <div>表示単位: ${getGranularityLabel()}</div>
      <div>第1位の件数: ${firstPlaceCount.toLocaleString()}</div>
      <div>最頻順位: ${top ? `第${top[0]}位` : "N/A"} (${top ? top[1].toLocaleString() : 0})</div>
    `;
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
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    statsEl.innerHTML = `
      <div class="name">${
        plotModeSelect.value === "opposition_rank"
          ? `野党第${rank}党`
          : `第${rank}位の政党`
      }</div>
      <div>表示単位: ${getGranularityLabel()}</div>
      <div>最多: ${top ? (state.partyNameByCode[top[0]] || top[0]) : "N/A"}</div>
      <div>件数: ${top ? top[1].toLocaleString() : 0}</div>
    `;
    return;
  }

  if (isSelectedVsTopMode()) {
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
    const geo = state.geojsonByGranularity[granularitySelect.value];
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
