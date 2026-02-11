import { CONCENTRATION_CONTRAST_GAMMA, SHARE_COLORS } from '../../constants';
import { getColorFromPalette } from '../../colors';
import { getFeatureStats } from '../../data';
import { ppLabel, pct } from '../../format';
import { getWinnerMarginForFeature } from '../featureMetrics';
import { MODE_LABELS } from '../labels';
import { resolveLabel, type LabelContext } from '../labelUtils';
import type { ModeHandler } from '../types';
import {
  asDataContext,
  computeQ95Max,
  renderNoDataStatsHtml,
  renderStatsHtml,
  resolveStatsHeading,
  summarizeMetricRows,
} from './shared';

export const handler: ModeHandler = {
  getRenderStats(feature, baseStats, ctx) {
    const top2 = getWinnerMarginForFeature(feature, ctx);
    return {
      ...baseStats,
      share: top2.margin,
      margin: top2.margin,
      winnerPartyCode: top2.winner?.code ?? null,
      winnerPartyName: top2.winner ? (ctx.partyNameByCode[top2.winner.code] || top2.winner.code) : null,
      winnerShare: top2.winner?.share ?? null,
      runnerUpPartyCode: top2.runnerUp?.code ?? null,
      runnerUpPartyName: top2.runnerUp ? (ctx.partyNameByCode[top2.runnerUp.code] || top2.runnerUp.code) : null,
      runnerUpShare: top2.runnerUp?.share ?? null,
    };
  },

  getColor(stats, ctx) {
    return getColorFromPalette(stats.share, ctx.activeMax, SHARE_COLORS, CONCENTRATION_CONTRAST_GAMMA);
  },

  buildPopupHtml(stats, feature, ctx, helpers) {
    const labelCtx = {
      mode: ctx.plotMode, partyName: '', targetName: '', metricMode: null, rankN: '1', modeText: '',
    } as LabelContext;
    const metricLabel = handler.labels.popupMetricName
      ? resolveLabel(handler.labels.popupMetricName, labelCtx)
      : '上位2党の得票率差';
    const allRanksHtml = helpers.buildPartyRankPopupRows(feature, null, null);

    return `
      <strong>${stats.label}</strong><br>
      ${metricLabel}: ${stats.margin == null ? 'N/A' : ppLabel(stats.margin)}<br>
      1位: ${stats.winnerPartyName || 'N/A'}（${pct(stats.winnerShare)}）<br>
      2位: ${stats.runnerUpPartyName || 'N/A'}（${pct(stats.runnerUpShare)}）<br>
      地域の有効投票総数: ${helpers.validVotesText}<br>
      <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
      ${allRanksHtml}
    `;
  },

  buildStatsHtml(geo, modeCtx, labelCtx, granularityLabel) {
    const statsHeading = resolveStatsHeading(handler.labels, labelCtx);
    const dataCtx = asDataContext(modeCtx);
    const values: { row: { label: string }; value: number }[] = [];
    for (const feature of geo?.features || []) {
      const top2 = getWinnerMarginForFeature(feature, modeCtx);
      if (typeof top2.margin === 'number' && !Number.isNaN(top2.margin)) {
        const base = getFeatureStats(feature, modeCtx.selectedParty, dataCtx);
        values.push({ row: { label: base.label }, value: top2.margin });
      }
    }

    if (!values.length) return renderNoDataStatsHtml(statsHeading);

    const summary = summarizeMetricRows(values);
    return renderStatsHtml(statsHeading, [
      `表示単位: ${granularityLabel}`,
      `平均: ${ppLabel(summary.avg)}`,
      `最も接戦: ${summary.min.row.label} (${ppLabel(summary.min.value)})`,
      `最も大差: ${summary.max.row.label} (${ppLabel(summary.max.value)})`,
    ]);
  },

  computeScale(geo, modeCtx) {
    const values: number[] = [];
    for (const feature of geo?.features || []) {
      const top2 = getWinnerMarginForFeature(feature, modeCtx);
      if (typeof top2.margin === 'number' && !Number.isNaN(top2.margin)) values.push(top2.margin);
    }
    return { activeMax: values.length ? computeQ95Max(values) : 1, activeMin: 0, activeCrossesZero: false };
  },

  controls: {
    showPartySelector: false,
    showCompareTarget: false,
    showSelectedMetric: false,
    showRulingMetric: false,
    showScaleMode: false,
    showRankSelector: false,
    showModeHelp: true,
  },

  labels: MODE_LABELS.winner_margin,
};
