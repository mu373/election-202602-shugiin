import {
  NODATA_COLOR,
  SELECTED_VS_TOP_BETTER_COLORS,
  SELECTED_VS_TOP_DIVERGING_COLORS,
  SELECTED_VS_TOP_WORSE_COLORS,
} from '../../constants';
import { clamp01, interpolateFromPalette, skewRight } from '../../colors';
import { ppSignedLabel, ratioLabel } from '../../format';
import { getSelectedValueForFeature } from '../featureMetrics';
import { MODE_LABELS } from '../labels';
import type { ModeHandler } from '../types';
import {
  computeSymmetricScale,
  renderNoDataStatsHtml,
  renderStatsHtml,
  resolveStatsHeading,
} from './shared';

function getCompareTargetMode(compareTarget: string): 'top' | 'party' {
  return compareTarget === 'top' ? 'top' : 'party';
}

function getCompareTargetLabel(compareTarget: string, partyNameByCode: Record<string, string>): string {
  if (getCompareTargetMode(compareTarget) === 'party') {
    return partyNameByCode[compareTarget] || compareTarget;
  }
  return '第1党';
}

export const handler: ModeHandler = {
  getRenderStats(feature, baseStats, ctx) {
    const selectedCode = ctx.selectedParty;
    const metricMode = ctx.selectedMetric;
    const valueInfo = getSelectedValueForFeature(feature, selectedCode, ctx.compareTarget, metricMode, ctx);
    const targetPartyCode = valueInfo.targetPartyCode;
    return {
      ...baseStats,
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
    const diffText = stats.metricMode === 'ratio' ? ratioLabel(stats.ratio) : ppSignedLabel(stats.gap);
    const summaryLabel = stats.metricMode === 'ratio' ? '比' : '差';
    const allRanksHtml = helpers.buildPartyRankPopupRows(feature, ctx.selectedParty, stats.targetPartyCode ?? null);

    return `
      <strong>${stats.label}</strong><br>
      <strong>${stats.partyName || 'N/A'}</strong>と<strong>${stats.compareTargetLabel || '第1党'}</strong>の${summaryLabel}: ${diffText}<br>
      地域の有効投票総数: ${helpers.validVotesText}<br>
      <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
      ${allRanksHtml}
    `;
  },

  buildStatsHtml(geo, modeCtx, labelCtx, _granularityLabel) {
    const statsHeading = resolveStatsHeading(handler.labels, labelCtx);
    const metricMode = modeCtx.selectedMetric;

    const values: number[] = [];
    for (const feature of geo?.features || []) {
      const v = getSelectedValueForFeature(feature, modeCtx.selectedParty, modeCtx.compareTarget, metricMode, modeCtx);
      const val = metricMode === 'ratio' ? v.ratio : v.gap;
      if (typeof val === 'number' && !Number.isNaN(val)) values.push(val);
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
    const metricMode = state.selectedMetric as 'diff' | 'ratio';
    const values: number[] = [];
    for (const feature of geo?.features || []) {
      const v = getSelectedValueForFeature(feature, modeCtx.selectedParty, modeCtx.compareTarget, metricMode, modeCtx);
      if (typeof v.value === 'number' && !Number.isNaN(v.value)) values.push(v.value);
    }
    const scale = computeSymmetricScale(values);
    return { ...scale, activeCrossesZero: true };
  },

  controls: {
    showPartySelector: true,
    showCompareTarget: true,
    showSelectedMetric: true,
    showRulingMetric: false,
    showScaleMode: false,
    showRankSelector: false,
    showModeHelp: true,
    partySelectorLabel: '基準政党',
  },

  labels: MODE_LABELS.selected_diff,
};
