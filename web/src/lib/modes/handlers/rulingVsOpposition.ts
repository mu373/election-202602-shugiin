import {
  NODATA_COLOR,
  RULING_PARTY_CODE,
  SELECTED_VS_TOP_BETTER_COLORS,
  SELECTED_VS_TOP_DIVERGING_COLORS,
  SELECTED_VS_TOP_WORSE_COLORS,
} from '../../constants';
import { clamp01, interpolateFromPalette, skewRight } from '../../colors';
import { getFeatureStats } from '../../data';
import { ppSignedLabel, ratioLabel } from '../../format';
import { getRulingOppositionDiffForFeature } from '../featureMetrics';
import { MODE_LABELS } from '../labels';
import { resolveLabel, type LabelContext } from '../labelUtils';
import type { ModeHandler } from '../types';
import {
  asDataContext,
  computeSymmetricScale,
  renderNoDataStatsHtml,
  renderStatsHtml,
  resolveStatsHeading,
} from './shared';

export const handler: ModeHandler = {
  getRenderStats(feature, _baseStats, ctx) {
    const dataCtx = asDataContext(ctx);
    const base = getFeatureStats(feature, RULING_PARTY_CODE, dataCtx);
    const diff = getRulingOppositionDiffForFeature(feature, ctx);
    const ratio = (
      diff.rulingShare != null
      && diff.oppositionShare != null
      && diff.oppositionShare > 0
    )
      ? diff.rulingShare / diff.oppositionShare
      : null;
    const logRatio = ratio != null ? Math.log(ratio) : null;
    const metricMode = ctx.rulingMetric;

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
  },

  getColor(stats, ctx) {
    if (stats.share == null || Number.isNaN(stats.share)) return NODATA_COLOR;

    if (ctx.activeCrossesZero) {
      const maxAbs = Math.max(Math.abs(ctx.activeMin), Math.abs(ctx.activeMax), 0.01);
      const t = clamp01((stats.share / maxAbs + 1) / 2);
      return interpolateFromPalette(SELECTED_VS_TOP_DIVERGING_COLORS, t);
    }
    const clippedGap = Math.max(ctx.activeMin, Math.min(ctx.activeMax, stats.share));
    const range = Math.max(ctx.activeMax - ctx.activeMin, 0.01);
    if (ctx.activeMin >= 0) {
      const tBetter = clamp01((clippedGap - ctx.activeMin) / range);
      return interpolateFromPalette(SELECTED_VS_TOP_BETTER_COLORS, skewRight(tBetter));
    }
    const tWorse = clamp01((ctx.activeMax - clippedGap) / range);
    return interpolateFromPalette(SELECTED_VS_TOP_WORSE_COLORS, skewRight(tWorse));
  },

  buildPopupHtml(stats, feature, ctx, helpers) {
    const labelCtx = {
      mode: ctx.plotMode,
      partyName: '',
      targetName: '',
      metricMode: ctx.rulingMetric,
      rankN: '1',
      modeText: '',
    } as LabelContext;
    const diffText = stats.metricMode === 'ratio' ? ratioLabel(stats.ratio) : ppSignedLabel(stats.gap);
    const diffLabel = handler.labels.popupMetricName
      ? resolveLabel(handler.labels.popupMetricName, labelCtx)
      : '';
    const allRanksHtml = helpers.buildPartyRankPopupRows(feature, null, null);

    return `
      <strong>${stats.label}</strong><br>
      <strong>${diffLabel}</strong>: ${diffText}<br>
      地域の有効投票総数: ${helpers.validVotesText}<br>
      <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
      ${allRanksHtml}
    `;
  },

  buildStatsHtml(geo, modeCtx, labelCtx, _granularityLabel) {
    const statsHeading = resolveStatsHeading(handler.labels, labelCtx);
    const metricMode = modeCtx.rulingMetric;

    const values: number[] = [];
    for (const feature of geo?.features || []) {
      const diff = getRulingOppositionDiffForFeature(feature, modeCtx);
      if (metricMode === 'ratio') {
        if (diff.rulingShare != null && diff.oppositionShare != null && diff.oppositionShare > 0) {
          const ratio = diff.rulingShare / diff.oppositionShare;
          if (!Number.isNaN(ratio)) values.push(ratio);
        }
      } else if (typeof diff.gap === 'number' && !Number.isNaN(diff.gap)) {
        values.push(diff.gap);
      }
    }

    if (!values.length) return renderNoDataStatsHtml(statsHeading);

    let sum = 0, minVal = values[0], maxVal = values[0];
    for (const v of values) {
      sum += v;
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
    const avg = sum / values.length;
    const formatValue = (v: number) => (metricMode === 'ratio' ? ratioLabel(v) : ppSignedLabel(v));
    return renderStatsHtml(statsHeading, [
      `平均: ${formatValue(avg)}`,
      `最小: ${formatValue(minVal)}`,
      `最大: ${formatValue(maxVal)}`,
    ]);
  },

  computeScale(geo, modeCtx, state) {
    const metricMode = state.rulingMetric as 'diff' | 'ratio';
    const values: number[] = [];
    for (const feature of geo?.features || []) {
      const diff = getRulingOppositionDiffForFeature(feature, modeCtx);
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
    const scale = computeSymmetricScale(values);
    return { ...scale, activeCrossesZero: true };
  },

  controls: {
    showPartySelector: false,
    showCompareTarget: false,
    showSelectedMetric: false,
    showRulingMetric: true,
    showScaleMode: false,
    showRankSelector: false,
    showModeHelp: true,
  },

  labels: MODE_LABELS.ruling_vs_opposition,
};
