import { NODATA_COLOR, PARTY_RANK_COLORS } from '../../constants';
import { interpolateFromPalette } from '../../colors';
import { pct } from '../../format';
import { getPartyRankForFeature } from '../featureMetrics';
import { MODE_LABELS } from '../labels';
import type { ModeHandler } from '../types';
import {
  asDataContext,
  renderStatsHtml,
  resolveStatsHeading,
} from './shared';

/** Returns the color for a given party rank using the rank color palette. */
export function getPartyRankColor(rank: number | null | undefined, activePartyRankMax: number): string {
  if (rank == null) return NODATA_COLOR;
  const maxRank = Math.max(activePartyRankMax, rank, 1);
  if (rank <= 1) return PARTY_RANK_COLORS[0];
  if (rank >= maxRank) return PARTY_RANK_COLORS[PARTY_RANK_COLORS.length - 1];
  const t = maxRank > 1 ? (rank - 1) / (maxRank - 1) : 0;
  return interpolateFromPalette(PARTY_RANK_COLORS, t);
}

/** Scans all features to find the maximum rank of selectedParty in party_rank mode. */
export function computeActivePartyRankMax(ctx: { selectedParty: string; granularity: string; electionData: Record<string, unknown>; prefAgg: Record<string, unknown>; blockAgg: Record<string, unknown> }, geo: { features?: unknown[] } | null): number {
  const dataCtx = asDataContext(ctx as any);
  let maxRank = 1;
  for (const feature of geo?.features || []) {
    const rank = getPartyRankForFeature(feature as any, ctx.selectedParty, dataCtx).rank;
    if (rank != null && rank > maxRank) maxRank = rank;
  }
  return maxRank;
}

export const handler: ModeHandler = {
  getRenderStats(feature, baseStats, ctx) {
    const partyCode = ctx.selectedParty;
    const dataCtx = asDataContext(ctx);
    const partyRank = getPartyRankForFeature(feature, partyCode, dataCtx);
    return {
      ...baseStats,
      partyCode,
      partyName: ctx.partyNameByCode[partyCode] || partyCode,
      rank: partyRank.rank,
      share: partyRank.share,
    };
  },

  getColor(stats, ctx) {
    return getPartyRankColor(stats.rank, ctx.activePartyRankMax);
  },

  buildPopupHtml(stats, feature, ctx, helpers) {
    const allRanksHtml = helpers.buildPartyRankPopupRows(feature, ctx.selectedParty, null);
    return `
      <strong>${stats.label}</strong><br>
      政党: ${stats.partyName || 'N/A'}<br>
      順位: ${stats.rank != null ? `第${stats.rank}位` : 'N/A'}<br>
      得票率: ${pct(stats.share)}<br>
      得票数: ${helpers.formatPartyVotes(stats.share, stats.validVotes)} 票<br>
      地域の有効投票総数: ${helpers.validVotesText}<br>
      <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
      ${allRanksHtml}
    `;
  },

  buildStatsHtml(geo, modeCtx, labelCtx, granularityLabel) {
    const statsHeading = resolveStatsHeading(handler.labels, labelCtx);
    const dataCtx = asDataContext(modeCtx);
    const counts: Record<number, number> = {};

    for (const feature of geo?.features || []) {
      const rank = getPartyRankForFeature(feature, modeCtx.selectedParty, dataCtx).rank;
      if (rank != null) counts[rank] = (counts[rank] || 0) + 1;
    }

    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return renderStatsHtml(statsHeading, [
      `表示単位: ${granularityLabel}`,
      `第1位の件数: ${(counts[1] || 0).toLocaleString()}`,
      `最頻順位: ${top ? `第${top[0]}位` : 'N/A'} (${top ? Number(top[1]).toLocaleString() : 0})`,
    ]);
  },

  computeScale(geo, modeCtx, _state) {
    const maxRank = computeActivePartyRankMax(modeCtx, geo);
    return {
      activeMax: maxRank,
      activeMin: 0,
      activeCrossesZero: false,
    };
  },

  controls: {
    showPartySelector: true,
    showCompareTarget: false,
    showSelectedMetric: false,
    showRulingMetric: false,
    showScaleMode: false,
    showRankSelector: false,
    showModeHelp: true,
  },

  labels: MODE_LABELS.party_rank,
};
