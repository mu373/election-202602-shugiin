import { CONCENTRATION_CONTRAST_GAMMA, SHARE_COLORS } from '../../constants';
import { getColorFromPalette } from '../../colors';
import { getFeatureStats } from '../../data';
import { getConcentrationForFeature } from '../featureMetrics';
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
    const concentration = getConcentrationForFeature(feature, ctx);
    return {
      ...baseStats,
      partyCode: ctx.selectedParty,
      partyName: ctx.partyNameByCode[ctx.selectedParty] || ctx.selectedParty,
      share: concentration,
      concentration,
      effectivePartyCount: concentration && concentration > 0 ? 1 / concentration : null,
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
      : 'HHI';
    const allRanksHtml = helpers.buildPartyRankPopupRows(feature, null, null);

    return `
      <strong>${stats.label}</strong><br>
      ${metricLabel}: ${stats.concentration == null ? 'N/A' : stats.concentration.toFixed(3)}<br>
      実効政党数 (1/HHI): ${stats.effectivePartyCount == null ? 'N/A' : stats.effectivePartyCount.toFixed(2)}<br>
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
      const c = getConcentrationForFeature(feature, modeCtx);
      if (typeof c === 'number' && !Number.isNaN(c)) {
        const base = getFeatureStats(feature, modeCtx.selectedParty, dataCtx);
        values.push({ row: { label: base.label }, value: c });
      }
    }

    if (!values.length) return renderNoDataStatsHtml(statsHeading);

    const summary = summarizeMetricRows(values);
    const avgHHI = summary.avg;
    const avgEffective = avgHHI > 0 ? 1 / avgHHI : null;

    return renderStatsHtml(statsHeading, [
      `表示単位: ${granularityLabel}`,
      `平均HHI: ${avgHHI.toFixed(3)}`,
      `平均実効政党数 (1/HHI): ${avgEffective == null ? 'N/A' : avgEffective.toFixed(2)}`,
      `最も集中: ${summary.max.row.label} (${summary.max.value.toFixed(3)})`,
      `最も分散: ${summary.min.row.label} (${summary.min.value.toFixed(3)})`,
    ]);
  },

  computeScale(geo, modeCtx) {
    const values: number[] = [];
    for (const feature of geo?.features || []) {
      const c = getConcentrationForFeature(feature, modeCtx);
      if (typeof c === 'number' && !Number.isNaN(c)) values.push(c);
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

  labels: MODE_LABELS.concentration,
};
