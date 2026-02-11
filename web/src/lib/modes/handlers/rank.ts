import { NODATA_COLOR, RULING_PARTY_CODE } from '../../constants';
import { partyColor, getRankedPartiesForFeature } from '../../data';
import { pct } from '../../format';
import { getPartyRankForFeature } from '../featureMetrics';
import { MODE_LABELS } from '../labels';
import type { ModeHandler } from '../types';
import { asDataContext, renderStatsHtml, resolveStatsHeading } from './shared';

function getExcludedPartyCodeForMode(isOpposition: boolean): string | null {
  return isOpposition ? RULING_PARTY_CODE : null;
}

function makeHandler(isOpposition: boolean): ModeHandler {
  const excludedCode = getExcludedPartyCodeForMode(isOpposition);

  const labels = isOpposition ? MODE_LABELS.opposition_rank : MODE_LABELS.rank;

  return {
    getRenderStats(feature, baseStats, ctx) {
      const dataCtx = asDataContext(ctx);
      const ranked = getRankedPartiesForFeature(feature, excludedCode, dataCtx);
      const chosen = ranked[Math.max(0, ctx.rank - 1)] || null;
      const partyCode = chosen ? chosen.code : null;
      const actualRank = partyCode ? getPartyRankForFeature(feature, partyCode, dataCtx).rank : null;
      return {
        ...baseStats,
        rank: ctx.rank,
        actualRank,
        share: chosen ? chosen.share : null,
        partyCode,
        partyName: partyCode ? (ctx.partyNameByCode[partyCode] || partyCode) : null,
      };
    },

    getColor(stats, ctx) {
      return stats.partyCode ? partyColor(stats.partyCode, ctx.colorMap) : NODATA_COLOR;
    },

    buildPopupHtml(stats, feature, ctx, helpers) {
      const rankLabel = stats.actualRank != null ? `第${stats.actualRank}位` : 'N/A';
      const conditionLabel = isOpposition ? `野党第${ctx.rank}党` : null;
      const allRanksHtml = helpers.buildPartyRankPopupRows(feature, stats.partyCode ?? null, null);

      return `
        <strong>${stats.label}</strong><br>
        順位: ${rankLabel}<br>
        ${conditionLabel ? `表示条件: ${conditionLabel}<br>` : ''}
        政党: ${stats.partyName || 'N/A'}<br>
        得票率: ${pct(stats.share)}<br>
        得票数: ${helpers.formatPartyVotes(stats.share, stats.validVotes)} 票<br>
        地域の有効投票総数: ${helpers.validVotesText}<br>
        <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
        ${allRanksHtml}
      `;
    },

    buildStatsHtml(geo, modeCtx, labelCtx, granularityLabel) {
      const statsHeading = resolveStatsHeading(labels, labelCtx);
      const dataCtx = asDataContext(modeCtx);
      const counts: Record<string, number> = {};

      for (const feature of geo?.features || []) {
        const ranked = getRankedPartiesForFeature(feature, excludedCode, dataCtx);
        const p = ranked[modeCtx.rank - 1];
        if (p) counts[p.code] = (counts[p.code] || 0) + 1;
      }

      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const top = sorted[0];
      const bottom = sorted[sorted.length - 1];
      return renderStatsHtml(statsHeading, [
        `表示単位: ${granularityLabel}`,
        `最多: ${top ? `${modeCtx.partyNameByCode[top[0]] || top[0]} (${top[1].toLocaleString()})` : 'N/A'}`,
        `最少: ${bottom ? `${modeCtx.partyNameByCode[bottom[0]] || bottom[0]} (${bottom[1].toLocaleString()})` : 'N/A'}`,
      ]);
    },

    computeScale() {
      return { activeMax: 1, activeMin: 0, activeCrossesZero: false };
    },

    controls: {
      showPartySelector: false,
      showCompareTarget: false,
      showSelectedMetric: false,
      showRulingMetric: false,
      showScaleMode: false,
      showRankSelector: true,
      showModeHelp: true,
    },

    fillOpacity: 0.55,

    labels,
  };
}

export const rankHandler: ModeHandler = makeHandler(false);
export const oppositionRankHandler: ModeHandler = makeHandler(true);
