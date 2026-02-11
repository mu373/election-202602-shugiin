import { CONCENTRATION_CONTRAST_GAMMA, SHARE_COLORS } from '../../constants';
import { getColorFromPalette } from '../../colors';
import { getFeatureStats } from '../../data';
import { getNationalDivergenceForFeature } from '../featureMetrics';
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
    const nationalDivergence = getNationalDivergenceForFeature(feature, ctx);
    return {
      ...baseStats,
      share: nationalDivergence,
      nationalDivergence,
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
      : '全国平均からの乖離度';
    const allRanksHtml = helpers.buildPartyRankPopupRows(feature, null, null);

    return `
      <strong>${stats.label}</strong><br>
      ${metricLabel}: ${stats.nationalDivergence == null ? 'N/A' : stats.nationalDivergence.toFixed(3)}<br>
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
      const d = getNationalDivergenceForFeature(feature, modeCtx);
      if (typeof d === 'number' && !Number.isNaN(d)) {
        const base = getFeatureStats(feature, modeCtx.selectedParty, dataCtx);
        values.push({ row: { label: base.label }, value: d });
      }
    }

    if (!values.length) return renderNoDataStatsHtml(statsHeading);

    const summary = summarizeMetricRows(values);
    return renderStatsHtml(statsHeading, [
      `表示単位: ${granularityLabel}`,
      `平均: ${summary.avg.toFixed(3)}`,
      `最も全国平均から乖離: ${summary.max.row.label} (${summary.max.value.toFixed(3)})`,
      `最も全国平均に近い: ${summary.min.row.label} (${summary.min.value.toFixed(3)})`,
    ]);
  },

  computeScale(geo, modeCtx) {
    const values: number[] = [];
    for (const feature of geo?.features || []) {
      const d = getNationalDivergenceForFeature(feature, modeCtx);
      if (typeof d === 'number' && !Number.isNaN(d)) values.push(d);
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

  labels: MODE_LABELS.js_divergence,
};
