import type { ModeContext } from '../../../types';
import {
  CONCENTRATION_CONTRAST_GAMMA,
  FIXED_BREAKS,
  PARTY_QUANTILES,
  SHARE_COLORS,
} from '../../constants';
import { getColorFromPalette, quantile } from '../../colors';
import { getFeatureStats, getSharesForCurrentGranularity } from '../../data';
import { pct } from '../../format';
import { MODE_LABELS } from '../labels';
import type { ModeHandler } from '../types';
import { asDataContext, summarizeMetricRows } from './shared';

function buildPartyBreaks(
  partyCode: string,
  ctx: Pick<ModeContext, 'granularity' | 'electionData' | 'prefAgg' | 'blockAgg'>,
): number[] {
  const shares = getSharesForCurrentGranularity(
    partyCode, ctx.granularity, ctx.electionData, ctx.prefAgg, ctx.blockAgg,
  ).sort((a, b) => a - b);

  if (!shares.length) return [...FIXED_BREAKS];

  const breaks = PARTY_QUANTILES.map((q) => quantile(shares, q));
  breaks[0] = 0;
  for (let i = 1; i < breaks.length; i += 1) {
    if (breaks[i] < breaks[i - 1]) breaks[i] = breaks[i - 1];
  }
  return breaks;
}

function computeActiveScale(
  mode: 'fixed' | 'party',
  selectedPartyCode: string,
  ctx: Pick<ModeContext, 'granularity' | 'electionData' | 'prefAgg' | 'blockAgg'>,
): { breaks: number[]; max: number } {
  if (mode === 'party') {
    const breaks = buildPartyBreaks(selectedPartyCode, ctx);
    const shares = getSharesForCurrentGranularity(
      selectedPartyCode, ctx.granularity, ctx.electionData, ctx.prefAgg, ctx.blockAgg,
    );
    if (!shares.length) return { breaks, max: 0.01 };
    const sortedShares = [...shares].sort((a, b) => a - b);
    const q95 = quantile(sortedShares, 0.95);
    return { breaks, max: q95 > 0 ? q95 : 0.01 };
  }
  const breaks = [...FIXED_BREAKS];
  return { breaks, max: breaks[breaks.length - 1] > 0 ? breaks[breaks.length - 1] : 0.01 };
}

export const handler: ModeHandler = {
  getRenderStats(_feature, baseStats, ctx) {
    return {
      ...baseStats,
      partyCode: ctx.selectedParty,
      partyName: ctx.partyNameByCode[ctx.selectedParty] || ctx.selectedParty,
    };
  },

  getColor(stats, ctx) {
    return getColorFromPalette(stats.share, ctx.activeMax, SHARE_COLORS, CONCENTRATION_CONTRAST_GAMMA);
  },

  buildPopupHtml(stats, feature, ctx, helpers) {
    const allRanksHtml = helpers.buildPartyRankPopupRows(feature, ctx.selectedParty, null);
    return `
      <strong>${stats.label}</strong><br>
      政党: ${stats.partyName || 'N/A'}<br>
      得票率: ${pct(stats.share)}<br>
      得票数: ${helpers.formatPartyVotes(stats.share, stats.validVotes)} 票<br>
      地域の有効投票総数: ${helpers.validVotesText}<br>
      <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
      ${allRanksHtml}
    `;
  },

  buildStatsHtml(geo, modeCtx, _labelCtx, _granularityLabel) {
    const summary = modeCtx.parties.find((p) => p.code === modeCtx.selectedParty);
    if (!summary) return '<div>データなし</div>';

    const dataCtx = asDataContext(modeCtx);
    const rows: { row: { label: string }; value: number }[] = [];
    for (const feature of geo?.features || []) {
      const stats = getFeatureStats(feature, modeCtx.selectedParty, dataCtx);
      if (typeof stats.share === 'number' && !Number.isNaN(stats.share)) {
        rows.push({ row: { label: stats.label }, value: stats.share });
      }
    }

    if (!rows.length) {
      return `
        <div class="name">${summary.name}</div>
        <div>全国得票数: ${summary.total_votes.toLocaleString()} 票</div>
        <div>市区町村数: ${summary.municipalities.toLocaleString()}</div>
        <div>データなし</div>
      `;
    }

    const rowSummary = summarizeMetricRows(rows);
    return `
      <div class="name">${summary.name}</div>
      <div>全国得票数: ${summary.total_votes.toLocaleString()} 票</div>
      <div>市区町村数: ${summary.municipalities.toLocaleString()}</div>
      <div>平均得票率: ${pct(rowSummary.avg)}</div>
      <div>最小得票率: ${pct(rowSummary.min.value)} (${rowSummary.min.row.label})</div>
      <div>最大得票率: ${pct(rowSummary.max.value)} (${rowSummary.max.row.label})</div>
    `;
  },

  computeScale(_geo, modeCtx, state) {
    const scale = computeActiveScale(state.scaleMode, state.selectedParty, modeCtx);
    return {
      activeBreaks: scale.breaks,
      activeMax: scale.max,
      activeMin: 0,
      activeCrossesZero: false,
    };
  },

  controls: {
    showPartySelector: true,
    showCompareTarget: false,
    showSelectedMetric: false,
    showRulingMetric: false,
    showScaleMode: true,
    showRankSelector: false,
    showModeHelp: false,
  },

  labels: MODE_LABELS.share,
};
