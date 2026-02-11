import { state } from "./state.js";
import {
  plotModeSelect,
  partySelect,
  scaleModeSelect,
  rankSelect,
  granularitySelect,
  compareTargetSelect,
  selectedMetricSelect,
  rulingMetricSelect,
} from "./dom.js";
import {
  RULING_PARTY_CODE,
  RULING_BLOC_CODES,
  FIXED_BREAKS,
  PARTY_QUANTILES,
  PARTY_RANK_COLORS,
  NODATA_COLOR,
} from "./constants.js";
import { quantile, interpolateFromPalette } from "./colors.js";
import {
  getFeatureStats,
  getRankedPartiesForFeature,
  getSharesForCurrentGranularity,
  getAggregateShare,
} from "./data.js";
import { pct } from "./format.js";

export function isRankMode() {
  return plotModeSelect.value === "rank" || plotModeSelect.value === "opposition_rank";
}

export function isPartyRankMode() {
  return plotModeSelect.value === "party_rank";
}

export function isSelectedVsTopMode() {
  return plotModeSelect.value === "selected_diff";
}

export function isRulingVsOppositionMode() {
  return plotModeSelect.value === "ruling_vs_opposition";
}

export function getRulingMetricMode() {
  return rulingMetricSelect.value === "ratio" ? "ratio" : "diff";
}

export function isRulingRatioMode() {
  return isRulingVsOppositionMode() && getRulingMetricMode() === "ratio";
}

export function getSelectedMetricMode() {
  return selectedMetricSelect.value === "ratio" ? "ratio" : "diff";
}

export function isSelectedRatioMode() {
  return isSelectedVsTopMode() && getSelectedMetricMode() === "ratio";
}

export function isSignedDiffMode() {
  return (isSelectedVsTopMode() && !isSelectedRatioMode()) || (isRulingVsOppositionMode() && !isRulingRatioMode());
}

export function isConcentrationMode() {
  return plotModeSelect.value === "concentration";
}

export function isAnyRankMode() {
  return isRankMode() || isPartyRankMode();
}

export function getCompareTargetMode() {
  return compareTargetSelect.value === "top" ? "top" : "party";
}

export function getCompareTargetLabel() {
  if (getCompareTargetMode() === "party") {
    const code = compareTargetSelect.value;
    return state.partyNameByCode[code] || code;
  }
  return "第1党";
}

export function getCompareTargetPartyCode() {
  if (getCompareTargetMode() !== "party") return null;
  const code = compareTargetSelect.value;
  return state.parties.some((p) => p.code === code) ? code : null;
}

export function getExcludedPartyCodeForMode() {
  return plotModeSelect.value === "opposition_rank" ? RULING_PARTY_CODE : null;
}

export function getPartyRankForFeature(feature, partyCode) {
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

export function getSelectedGapForFeature(feature, selectedPartyCode, compareTargetMode) {
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

export function getSelectedValueForFeature(feature, selectedPartyCode, compareTargetMode, metricMode) {
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

export function getConcentrationForFeature(feature) {
  const ranked = getRankedPartiesForFeature(feature, null);
  if (!ranked.length) return null;
  return ranked.reduce((acc, p) => acc + (p.share * p.share), 0);
}

export function getRulingOppositionDiffForFeature(feature) {
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

export function computeActivePartyRankMax() {
  if (!isPartyRankMode()) {
    state.activePartyRankMax = 1;
    return;
  }
  const selectedCode = partySelect.value;
  const geo = state.geojsonByGranularity[granularitySelect.value];
  let maxRank = 1;
  for (const feature of geo?.features || []) {
    const rank = getPartyRankForFeature(feature, selectedCode).rank;
    if (rank != null && rank > maxRank) {
      maxRank = rank;
    }
  }
  state.activePartyRankMax = maxRank;
}

export function getPartyRankColor(rank) {
  if (rank == null) return NODATA_COLOR;
  const maxRank = Math.max(state.activePartyRankMax, rank, 1);
  if (rank <= 1) return PARTY_RANK_COLORS[0];
  if (rank >= maxRank) return PARTY_RANK_COLORS[PARTY_RANK_COLORS.length - 1];
  const t = maxRank > 1 ? (rank - 1) / (maxRank - 1) : 0;
  return interpolateFromPalette(PARTY_RANK_COLORS, t);
}

export function getFeatureRenderStats(feature) {
  if (isRankMode()) {
    const rank = Number.parseInt(rankSelect.value, 10) || 1;
    const ranked = getRankedPartiesForFeature(feature, getExcludedPartyCodeForMode());
    const chosen = ranked[rank - 1] || null;
    const base = getFeatureStats(feature, partySelect.value);
    const partyCode = chosen ? chosen.code : null;
    const actualRank = partyCode ? getPartyRankForFeature(feature, partyCode).rank : null;
    return {
      ...base,
      rank,
      actualRank,
      share: chosen ? chosen.share : null,
      partyCode,
      partyName: partyCode ? (state.partyNameByCode[partyCode] || partyCode) : null,
    };
  }
  if (isPartyRankMode()) {
    const partyCode = partySelect.value;
    const base = getFeatureStats(feature, partyCode);
    const partyRank = getPartyRankForFeature(feature, partyCode);
    return {
      ...base,
      partyCode,
      partyName: state.partyNameByCode[partyCode] || partyCode,
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
      partyName: state.partyNameByCode[selectedCode] || selectedCode,
      share: valueInfo.value,
      gap: valueInfo.gap,
      selectedShare: valueInfo.selectedShare,
      targetShare: valueInfo.targetShare,
      targetPartyCode,
      targetPartyName: targetPartyCode ? (state.partyNameByCode[targetPartyCode] || targetPartyCode) : getCompareTargetLabel(),
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
      partyName: state.partyNameByCode[partyCode] || partyCode,
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
    partyName: state.partyNameByCode[partyCode] || partyCode,
  };
}

export function buildPartyBreaks(partyCode) {
  const shares = getSharesForCurrentGranularity(partyCode).sort((a, b) => a - b);
  if (!shares.length) return [...FIXED_BREAKS];
  const breaks = PARTY_QUANTILES.map((q) => quantile(shares, q));
  breaks[0] = 0;
  for (let i = 1; i < breaks.length; i += 1) {
    if (breaks[i] < breaks[i - 1]) breaks[i] = breaks[i - 1];
  }
  return breaks;
}

export function computeActiveScale() {
  const mode = scaleModeSelect.value;
  const selectedPartyCode = partySelect.value;
  if (mode === "party") {
    state.activeBreaks = buildPartyBreaks(selectedPartyCode);
    const shares = getSharesForCurrentGranularity(selectedPartyCode);
    if (!shares.length) {
      state.activeMax = 0.01;
    } else {
      const sortedShares = [...shares].sort((a, b) => a - b);
      const q95 = quantile(sortedShares, 0.95);
      state.activeMax = q95 > 0 ? q95 : 0.01;
    }
  } else {
    state.activeBreaks = [...FIXED_BREAKS];
    state.activeMax = state.activeBreaks[state.activeBreaks.length - 1] > 0 ? state.activeBreaks[state.activeBreaks.length - 1] : 0.01;
  }
}

export function buildPartyRankPopupRows(feature, selectedCode, compareTargetCode = null) {
  const ranked = getRankedPartiesForFeature(feature, null);
  if (!ranked.length) return "順位データ: N/A";
  return ranked
    .map((p, idx) => {
      const isSelected = p.code === selectedCode;
      const isCompareTarget = compareTargetCode && p.code === compareTargetCode;
      const label = `第${idx + 1}位 ${state.partyNameByCode[p.code] || p.code}: ${pct(p.share)}`;
      return (isSelected || isCompareTarget) ? `<strong>${label}</strong>` : label;
    })
    .join("<br>");
}

export function getSelectedVsTopValuesForCurrentGranularity(selectedPartyCode, compareTargetMode, metricMode) {
  const geo = state.geojsonByGranularity[granularitySelect.value];
  const values = [];
  for (const feature of geo?.features || []) {
    const v = getSelectedValueForFeature(feature, selectedPartyCode, compareTargetMode, metricMode);
    if (typeof v.value === "number" && !Number.isNaN(v.value)) {
      values.push(v.value);
    }
  }
  return values;
}

export function getRulingOppositionValuesForCurrentGranularity(metricMode) {
  const geo = state.geojsonByGranularity[granularitySelect.value];
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
