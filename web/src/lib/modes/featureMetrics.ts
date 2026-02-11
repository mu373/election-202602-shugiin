import { RULING_BLOC_CODES } from '../constants';
import { getRankedPartiesForFeature } from '../data';
import type {
  DataContext,
  ElectionFeature,
  MetricMode,
  ModeContext,
  RankedParty,
} from '../../types';

function getCompareTargetMode(compareTarget: string): 'top' | 'party' {
  return compareTarget === 'top' ? 'top' : 'party';
}

function getCompareTargetPartyCode(compareTarget: string, parties: { code: string }[]): string | null {
  if (getCompareTargetMode(compareTarget) !== 'party') return null;
  return parties.some((p) => p.code === compareTarget) ? compareTarget : null;
}

/** Extracts the DataContext subset from a full ModeContext. */
function asDataContext(ctx: ModeContext): DataContext {
  return {
    granularity: ctx.granularity,
    electionData: ctx.electionData,
    prefAgg: ctx.prefAgg,
    blockAgg: ctx.blockAgg,
  };
}

/** Returns the rank and vote share of `partyCode` within a feature's ranked list. */
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

/** Computes the vote-share gap between a selected party and a comparison target for a feature. */
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
    return { gap: null, selectedShare: null, targetShare: null, targetPartyCode: null };
  }

  const selected = ranked.find((p) => p.code === selectedPartyCode) || null;
  if (!selected) {
    return { gap: null, selectedShare: null, targetShare: null, targetPartyCode: null };
  }

  const selectedShare = selected.share;
  const compareTargetMode = getCompareTargetMode(compareTarget);
  if (compareTargetMode === 'party') {
    const targetPartyCode = getCompareTargetPartyCode(compareTarget, ctx.parties);
    const targetParty = targetPartyCode ? ranked.find((p) => p.code === targetPartyCode) || null : null;

    if (!targetParty) {
      return { gap: null, selectedShare: null, targetShare: null, targetPartyCode: null };
    }

    const targetShare = targetParty.share;
    return { gap: selectedShare - targetShare, selectedShare, targetShare, targetPartyCode };
  }

  const top = ranked[0];
  return {
    gap: selectedShare - top.share,
    selectedShare,
    targetShare: top.share,
    targetPartyCode: top.code,
  };
}

/**
 * Computes the comparison value (diff or ratio) between a selected party and a target.
 * When `metricMode` is 'ratio', returns the log-ratio; otherwise returns the gap.
 */
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

/**
 * Computes the Herfindahl-Hirschman Index (HHI) for a feature.
 * HHI = sum of squared vote shares; higher values indicate concentration.
 */
export function getConcentrationForFeature(feature: ElectionFeature, ctx: ModeContext): number | null {
  const ranked = getRankedPartiesForFeature(feature, null, asDataContext(ctx));
  if (!ranked.length) return null;
  return ranked.reduce((acc, p) => acc + p.share * p.share, 0);
}

/** Computes the vote-share difference between ruling-bloc and opposition-bloc parties. */
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

  return { gap: rulingShare - oppositionShare, rulingShare, oppositionShare };
}

/** Computes the margin (share difference) between the top two parties in a feature. */
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
  return { margin: winner.share - runnerUp.share, winner, runnerUp };
}

/** Computes the national party vote-share distribution from total_votes fields. */
export function getNationalPartyShareMap(parties: { code: string; total_votes: number }[]): Record<string, number> | null {
  const totalVotes = parties.reduce((acc, p) => acc + (Number(p.total_votes) || 0), 0);
  if (!Number.isFinite(totalVotes) || totalVotes <= 0) return null;

  const shareMap: Record<string, number> = {};
  for (const p of parties) {
    const votes = Number(p.total_votes) || 0;
    shareMap[p.code] = votes / totalVotes;
  }
  return shareMap;
}

/** Computes the party vote-share distribution for a single feature. */
export function getFeaturePartyShareMap(feature: ElectionFeature, ctx: ModeContext): Record<string, number> | null {
  const ranked = getRankedPartiesForFeature(feature, null, asDataContext(ctx));
  if (!ranked.length) return null;

  const shareMap: Record<string, number> = {};
  for (const p of ranked) {
    shareMap[p.code] = p.share;
  }
  return shareMap;
}

/**
 * Computes the Jensen-Shannon divergence (base-2) between two distributions.
 * JSD is a symmetric measure of the difference between two probability distributions.
 * @param featureShares - local vote-share distribution
 * @param nationalShares - national vote-share distribution
 * @param partyCodes - list of party codes to compare across
 */
export function jsDivergenceBase2(
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

/**
 * Computes the Jensen-Shannon distance (sqrt of JSD) between a feature's vote
 * distribution and the national average. Returns null if data is missing.
 */
export function getNationalDivergenceForFeature(feature: ElectionFeature, ctx: ModeContext): number | null {
  const nationalShares = getNationalPartyShareMap(ctx.parties);
  const featureShares = getFeaturePartyShareMap(feature, ctx);
  if (!nationalShares || !featureShares) return null;

  const partyCodes = ctx.parties.map((p) => p.code);
  const js = jsDivergenceBase2(featureShares, nationalShares, partyCodes);
  if (!Number.isFinite(js) || js < 0) return null;
  return Math.sqrt(js);
}
