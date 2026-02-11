import {
  FIXED_BREAKS,
  NODATA_COLOR,
  PARTY_QUANTILES,
  PARTY_RANK_COLORS,
  RULING_BLOC_CODES,
  RULING_PARTY_CODE,
} from './constants';
import { interpolateFromPalette, quantile } from './colors';
import {
  getFeatureStats,
  getRankedPartiesForFeature,
  getSharesForCurrentGranularity,
} from './data';
import { pct } from './format';
import type {
  DataContext,
  ElectionFeature,
  ElectionGeoJson,
  MetricMode,
  ModeContext,
  PlotMode,
  RankedParty,
  RenderStats,
} from '../types';

function asDataContext(ctx: ModeContext): DataContext {
  return {
    granularity: ctx.granularity,
    electionData: ctx.electionData,
    prefAgg: ctx.prefAgg,
    blockAgg: ctx.blockAgg,
  };
}

export function isRankMode(mode: PlotMode): boolean {
  return mode === 'rank' || mode === 'opposition_rank';
}

export function isPartyRankMode(mode: PlotMode): boolean {
  return mode === 'party_rank';
}

export function isSelectedVsTopMode(mode: PlotMode): boolean {
  return mode === 'selected_diff';
}

export function isRulingVsOppositionMode(mode: PlotMode): boolean {
  return mode === 'ruling_vs_opposition';
}

export function getRulingMetricMode(metric: MetricMode): MetricMode {
  return metric === 'ratio' ? 'ratio' : 'diff';
}

export function isRulingRatioMode(mode: PlotMode, metric: MetricMode): boolean {
  return isRulingVsOppositionMode(mode) && getRulingMetricMode(metric) === 'ratio';
}

export function getSelectedMetricMode(metric: MetricMode): MetricMode {
  return metric === 'ratio' ? 'ratio' : 'diff';
}

export function isSelectedRatioMode(mode: PlotMode, metric: MetricMode): boolean {
  return isSelectedVsTopMode(mode) && getSelectedMetricMode(metric) === 'ratio';
}

export function isSignedDiffMode(mode: PlotMode, selectedMetric: MetricMode, rulingMetric: MetricMode): boolean {
  return (
    (isSelectedVsTopMode(mode) && !isSelectedRatioMode(mode, selectedMetric))
    || (isRulingVsOppositionMode(mode) && !isRulingRatioMode(mode, rulingMetric))
  );
}

export function isConcentrationMode(mode: PlotMode): boolean {
  return mode === 'concentration';
}

export function isWinnerMarginMode(mode: PlotMode): boolean {
  return mode === 'winner_margin';
}

export function isNationalDivergenceMode(mode: PlotMode): boolean {
  return mode === 'js_divergence';
}

export function isAnyRankMode(mode: PlotMode): boolean {
  return isRankMode(mode) || isPartyRankMode(mode);
}

export function getCompareTargetMode(compareTarget: string): 'top' | 'party' {
  return compareTarget === 'top' ? 'top' : 'party';
}

export function getCompareTargetLabel(compareTarget: string, partyNameByCode: Record<string, string>): string {
  if (getCompareTargetMode(compareTarget) === 'party') {
    return partyNameByCode[compareTarget] || compareTarget;
  }
  return '第1党';
}

export function getCompareTargetPartyCode(compareTarget: string, parties: { code: string }[]): string | null {
  if (getCompareTargetMode(compareTarget) !== 'party') return null;
  return parties.some((p) => p.code === compareTarget) ? compareTarget : null;
}

export function getExcludedPartyCodeForMode(mode: PlotMode): string | null {
  return mode === 'opposition_rank' ? RULING_PARTY_CODE : null;
}

export function getPartyRankForFeature(
  feature: ElectionFeature,
  partyCode: string,
  dataContext: DataContext,
): { rank: number | null; share: number | null } {
  const ranked = getRankedPartiesForFeature(feature, null, dataContext);
  for (let i = 0; i < ranked.length; i += 1) {
    if (ranked[i].code === partyCode) {
      return {
        rank: i + 1,
        share: ranked[i].share,
      };
    }
  }
  return { rank: null, share: null };
}

export function getSelectedGapForFeature(
  feature: ElectionFeature,
  selectedPartyCode: string,
  compareTarget: string,
  ctx: ModeContext,
): {
  gap: number | null;
  selectedShare: number | null;
  targetShare: number | null;
  targetPartyCode: string | null;
} {
  const ranked = getRankedPartiesForFeature(feature, null, asDataContext(ctx));
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
  const compareTargetMode = getCompareTargetMode(compareTarget);
  if (compareTargetMode === 'party') {
    const targetPartyCode = getCompareTargetPartyCode(compareTarget, ctx.parties);
    const targetParty = targetPartyCode ? ranked.find((p) => p.code === targetPartyCode) || null : null;

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

export function getSelectedValueForFeature(
  feature: ElectionFeature,
  selectedPartyCode: string,
  compareTarget: string,
  metricMode: MetricMode,
  ctx: ModeContext,
): {
  gap: number | null;
  selectedShare: number | null;
  targetShare: number | null;
  targetPartyCode: string | null;
  ratio: number | null;
  logRatio: number | null;
  value: number | null;
} {
  const gapInfo = getSelectedGapForFeature(feature, selectedPartyCode, compareTarget, ctx);

  if (metricMode === 'ratio') {
    const ratio = (
      gapInfo.selectedShare != null
      && gapInfo.targetShare != null
      && gapInfo.targetShare > 0
    )
      ? gapInfo.selectedShare / gapInfo.targetShare
      : null;

    const logRatio = ratio != null ? Math.log(ratio) : null;
    return { ...gapInfo, ratio, logRatio, value: logRatio };
  }

  return { ...gapInfo, ratio: null, logRatio: null, value: gapInfo.gap };
}

export function getConcentrationForFeature(feature: ElectionFeature, ctx: ModeContext): number | null {
  const ranked = getRankedPartiesForFeature(feature, null, asDataContext(ctx));
  if (!ranked.length) return null;
  return ranked.reduce((acc, p) => acc + p.share * p.share, 0);
}

export function getRulingOppositionDiffForFeature(
  feature: ElectionFeature,
  ctx: ModeContext,
): {
  gap: number | null;
  rulingShare: number | null;
  oppositionShare: number | null;
} {
  const ranked = getRankedPartiesForFeature(feature, null, asDataContext(ctx));
  if (!ranked.length) {
    return { gap: null, rulingShare: null, oppositionShare: null };
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

export function getWinnerMarginForFeature(
  feature: ElectionFeature,
  ctx: ModeContext,
): {
  margin: number | null;
  winner: RankedParty | null;
  runnerUp: RankedParty | null;
} {
  const ranked = getRankedPartiesForFeature(feature, null, asDataContext(ctx));
  if (ranked.length < 2) {
    return { margin: null, winner: null, runnerUp: null };
  }

  const winner = ranked[0];
  const runnerUp = ranked[1];
  return {
    margin: winner.share - runnerUp.share,
    winner,
    runnerUp,
  };
}

function getNationalPartyShareMap(parties: { code: string; total_votes: number }[]): Record<string, number> | null {
  const totalVotes = parties.reduce((acc, p) => acc + (Number(p.total_votes) || 0), 0);
  if (!Number.isFinite(totalVotes) || totalVotes <= 0) return null;

  const shareMap: Record<string, number> = {};
  for (const p of parties) {
    const votes = Number(p.total_votes) || 0;
    shareMap[p.code] = votes / totalVotes;
  }
  return shareMap;
}

function getFeaturePartyShareMap(feature: ElectionFeature, ctx: ModeContext): Record<string, number> | null {
  const ranked = getRankedPartiesForFeature(feature, null, asDataContext(ctx));
  if (!ranked.length) return null;

  const shareMap: Record<string, number> = {};
  for (const p of ranked) {
    shareMap[p.code] = p.share;
  }
  return shareMap;
}

function jsDivergenceBase2(
  featureShares: Record<string, number>,
  nationalShares: Record<string, number>,
  partyCodes: string[],
): number {
  let js = 0;
  for (const code of partyCodes) {
    const p = featureShares[code] || 0;
    const q = nationalShares[code] || 0;
    const m = (p + q) / 2;
    if (p > 0 && m > 0) js += 0.5 * p * Math.log2(p / m);
    if (q > 0 && m > 0) js += 0.5 * q * Math.log2(q / m);
  }
  return js;
}

export function getNationalDivergenceForFeature(feature: ElectionFeature, ctx: ModeContext): number | null {
  const nationalShares = getNationalPartyShareMap(ctx.parties);
  const featureShares = getFeaturePartyShareMap(feature, ctx);
  if (!nationalShares || !featureShares) return null;

  const partyCodes = ctx.parties.map((p) => p.code);
  const js = jsDivergenceBase2(featureShares, nationalShares, partyCodes);
  if (!Number.isFinite(js) || js < 0) return null;
  return Math.sqrt(js);
}

export function computeActivePartyRankMax(ctx: ModeContext, geo: ElectionGeoJson | null): number {
  if (!isPartyRankMode(ctx.plotMode)) return 1;

  let maxRank = 1;
  for (const feature of geo?.features || []) {
    const rank = getPartyRankForFeature(feature, ctx.selectedParty, asDataContext(ctx)).rank;
    if (rank != null && rank > maxRank) maxRank = rank;
  }
  return maxRank;
}

export function getPartyRankColor(rank: number | null | undefined, activePartyRankMax: number): string {
  if (rank == null) return NODATA_COLOR;
  const maxRank = Math.max(activePartyRankMax, rank, 1);
  if (rank <= 1) return PARTY_RANK_COLORS[0];
  if (rank >= maxRank) return PARTY_RANK_COLORS[PARTY_RANK_COLORS.length - 1];
  const t = maxRank > 1 ? (rank - 1) / (maxRank - 1) : 0;
  return interpolateFromPalette(PARTY_RANK_COLORS, t);
}

export function getFeatureRenderStats(feature: ElectionFeature, ctx: ModeContext): RenderStats {
  if (isRankMode(ctx.plotMode)) {
    const ranked = getRankedPartiesForFeature(feature, getExcludedPartyCodeForMode(ctx.plotMode), asDataContext(ctx));
    const chosen = ranked[Math.max(0, ctx.rank - 1)] || null;
    const base = getFeatureStats(feature, ctx.selectedParty, asDataContext(ctx));
    const partyCode = chosen ? chosen.code : null;
    const actualRank = partyCode ? getPartyRankForFeature(feature, partyCode, asDataContext(ctx)).rank : null;
    return {
      ...base,
      rank: ctx.rank,
      actualRank,
      share: chosen ? chosen.share : null,
      partyCode,
      partyName: partyCode ? (ctx.partyNameByCode[partyCode] || partyCode) : null,
    };
  }

  if (isPartyRankMode(ctx.plotMode)) {
    const partyCode = ctx.selectedParty;
    const base = getFeatureStats(feature, partyCode, asDataContext(ctx));
    const partyRank = getPartyRankForFeature(feature, partyCode, asDataContext(ctx));
    return {
      ...base,
      partyCode,
      partyName: ctx.partyNameByCode[partyCode] || partyCode,
      rank: partyRank.rank,
      share: partyRank.share,
    };
  }

  if (isSelectedVsTopMode(ctx.plotMode)) {
    const selectedCode = ctx.selectedParty;
    const base = getFeatureStats(feature, selectedCode, asDataContext(ctx));
    const metricMode = getSelectedMetricMode(ctx.selectedMetric);
    const valueInfo = getSelectedValueForFeature(feature, selectedCode, ctx.compareTarget, metricMode, ctx);
    const targetPartyCode = valueInfo.targetPartyCode;
    return {
      ...base,
      partyCode: selectedCode,
      partyName: ctx.partyNameByCode[selectedCode] || selectedCode,
      share: valueInfo.value,
      gap: valueInfo.gap,
      selectedShare: valueInfo.selectedShare,
      targetShare: valueInfo.targetShare,
      targetPartyCode,
      targetPartyName: targetPartyCode
        ? (ctx.partyNameByCode[targetPartyCode] || targetPartyCode)
        : getCompareTargetLabel(ctx.compareTarget, ctx.partyNameByCode),
      compareTargetMode: getCompareTargetMode(ctx.compareTarget),
      compareTargetLabel: getCompareTargetLabel(ctx.compareTarget, ctx.partyNameByCode),
      ratio: valueInfo.ratio,
      logRatio: valueInfo.logRatio,
      metricMode,
    };
  }

  if (isRulingVsOppositionMode(ctx.plotMode)) {
    const base = getFeatureStats(feature, RULING_PARTY_CODE, asDataContext(ctx));
    const diff = getRulingOppositionDiffForFeature(feature, ctx);
    const ratio = (
      diff.rulingShare != null
      && diff.oppositionShare != null
      && diff.oppositionShare > 0
    )
      ? diff.rulingShare / diff.oppositionShare
      : null;
    const logRatio = ratio != null ? Math.log(ratio) : null;
    const metricMode = getRulingMetricMode(ctx.rulingMetric);

    return {
      ...base,
      share: metricMode === 'ratio' ? logRatio : diff.gap,
      gap: diff.gap,
      rulingShare: diff.rulingShare,
      oppositionShare: diff.oppositionShare,
      ratio,
      logRatio,
      metricMode,
    };
  }

  if (isConcentrationMode(ctx.plotMode)) {
    const partyCode = ctx.selectedParty;
    const base = getFeatureStats(feature, partyCode, asDataContext(ctx));
    const concentration = getConcentrationForFeature(feature, ctx);
    return {
      ...base,
      partyCode,
      partyName: ctx.partyNameByCode[partyCode] || partyCode,
      share: concentration,
      concentration,
      effectivePartyCount: concentration && concentration > 0 ? 1 / concentration : null,
    };
  }

  if (isWinnerMarginMode(ctx.plotMode)) {
    const base = getFeatureStats(feature, ctx.selectedParty, asDataContext(ctx));
    const top2 = getWinnerMarginForFeature(feature, ctx);
    return {
      ...base,
      share: top2.margin,
      margin: top2.margin,
      winnerPartyCode: top2.winner?.code ?? null,
      winnerPartyName: top2.winner ? (ctx.partyNameByCode[top2.winner.code] || top2.winner.code) : null,
      winnerShare: top2.winner?.share ?? null,
      runnerUpPartyCode: top2.runnerUp?.code ?? null,
      runnerUpPartyName: top2.runnerUp ? (ctx.partyNameByCode[top2.runnerUp.code] || top2.runnerUp.code) : null,
      runnerUpShare: top2.runnerUp?.share ?? null,
    };
  }

  if (isNationalDivergenceMode(ctx.plotMode)) {
    const base = getFeatureStats(feature, ctx.selectedParty, asDataContext(ctx));
    const nationalDivergence = getNationalDivergenceForFeature(feature, ctx);
    return {
      ...base,
      share: nationalDivergence,
      nationalDivergence,
    };
  }

  const partyCode = ctx.selectedParty;
  const base = getFeatureStats(feature, partyCode, asDataContext(ctx));
  return {
    ...base,
    partyCode,
    partyName: ctx.partyNameByCode[partyCode] || partyCode,
  };
}

export function buildPartyBreaks(
  partyCode: string,
  ctx: Pick<ModeContext, 'granularity' | 'electionData' | 'prefAgg' | 'blockAgg'>,
): number[] {
  const shares = getSharesForCurrentGranularity(
    partyCode,
    ctx.granularity,
    ctx.electionData,
    ctx.prefAgg,
    ctx.blockAgg,
  ).sort((a, b) => a - b);

  if (!shares.length) return [...FIXED_BREAKS];

  const breaks = PARTY_QUANTILES.map((q) => quantile(shares, q));
  breaks[0] = 0;
  for (let i = 1; i < breaks.length; i += 1) {
    if (breaks[i] < breaks[i - 1]) breaks[i] = breaks[i - 1];
  }
  return breaks;
}

export function computeActiveScale(
  mode: 'fixed' | 'party',
  selectedPartyCode: string,
  ctx: Pick<ModeContext, 'granularity' | 'electionData' | 'prefAgg' | 'blockAgg'>,
): { breaks: number[]; max: number } {
  if (mode === 'party') {
    const breaks = buildPartyBreaks(selectedPartyCode, ctx);
    const shares = getSharesForCurrentGranularity(
      selectedPartyCode,
      ctx.granularity,
      ctx.electionData,
      ctx.prefAgg,
      ctx.blockAgg,
    );

    if (!shares.length) {
      return { breaks, max: 0.01 };
    }

    const sortedShares = [...shares].sort((a, b) => a - b);
    const q95 = quantile(sortedShares, 0.95);
    return { breaks, max: q95 > 0 ? q95 : 0.01 };
  }

  const breaks = [...FIXED_BREAKS];
  return {
    breaks,
    max: breaks[breaks.length - 1] > 0 ? breaks[breaks.length - 1] : 0.01,
  };
}

export function buildPartyRankPopupRows(
  feature: ElectionFeature,
  selectedCode: string | null,
  compareTargetCode: string | null,
  partyNameByCode: Record<string, string>,
  mode: PlotMode,
  ctx: DataContext,
): string {
  const ranked = getRankedPartiesForFeature(feature, null, ctx);
  if (!ranked.length) return '順位データ: N/A';

  return ranked
    .map((p, idx) => {
      const isTopTwo = isWinnerMarginMode(mode) && idx < 2;
      const isSelected = selectedCode != null && p.code === selectedCode;
      const isCompareTarget = compareTargetCode != null && p.code === compareTargetCode;
      const label = `第${idx + 1}位 ${partyNameByCode[p.code] || p.code}: ${pct(p.share)}`;
      return (isTopTwo || isSelected || isCompareTarget) ? `<strong>${label}</strong>` : label;
    })
    .join('<br>');
}

export function getSelectedVsTopValuesForCurrentGranularity(
  selectedPartyCode: string,
  compareTarget: string,
  metricMode: MetricMode,
  geo: ElectionGeoJson | null,
  ctx: ModeContext,
): number[] {
  const values: number[] = [];
  for (const feature of geo?.features || []) {
    const v = getSelectedValueForFeature(feature, selectedPartyCode, compareTarget, metricMode, ctx);
    if (typeof v.value === 'number' && !Number.isNaN(v.value)) values.push(v.value);
  }
  return values;
}

export function getWinnerMarginValuesForCurrentGranularity(
  geo: ElectionGeoJson | null,
  ctx: ModeContext,
): number[] {
  const values: number[] = [];
  for (const feature of geo?.features || []) {
    const top2 = getWinnerMarginForFeature(feature, ctx);
    if (typeof top2.margin === 'number' && !Number.isNaN(top2.margin)) values.push(top2.margin);
  }
  return values;
}

export function getRulingOppositionValuesForCurrentGranularity(
  metricMode: MetricMode,
  geo: ElectionGeoJson | null,
  ctx: ModeContext,
): number[] {
  const values: number[] = [];
  for (const feature of geo?.features || []) {
    const diff = getRulingOppositionDiffForFeature(feature, ctx);
    if (metricMode === 'ratio') {
      if (diff.rulingShare != null && diff.oppositionShare != null && diff.oppositionShare > 0) {
        const ratio = diff.rulingShare / diff.oppositionShare;
        const logRatio = Math.log(ratio);
        if (!Number.isNaN(logRatio)) values.push(logRatio);
      }
    } else if (typeof diff.gap === 'number' && !Number.isNaN(diff.gap)) {
      values.push(diff.gap);
    }
  }
  return values;
}

export function getNationalDivergenceValuesForCurrentGranularity(
  geo: ElectionGeoJson | null,
  ctx: ModeContext,
): number[] {
  const values: number[] = [];
  for (const feature of geo?.features || []) {
    const value = getNationalDivergenceForFeature(feature, ctx);
    if (typeof value === 'number' && !Number.isNaN(value)) values.push(value);
  }
  return values;
}
