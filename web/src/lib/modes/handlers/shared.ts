import type { ElectionFeature, ModeContext, RenderStats } from '../../../types';
import { getRankedPartiesForFeature } from '../../data';
import { pct } from '../../format';
import { quantile } from '../../colors';
import type { LabelContext } from '../labelUtils';
import { resolveLabel } from '../labelUtils';
import type { ModeLabelConfig } from '../types';

/** Extracts the DataContext subset from a full ModeContext. */
export function asDataContext(ctx: ModeContext) {
  return {
    granularity: ctx.granularity,
    electionData: ctx.electionData,
    prefAgg: ctx.prefAgg,
    blockAgg: ctx.blockAgg,
  };
}

/** Builds the HTML party-rank rows shown in popups. */
export function buildPartyRankPopupRows(
  feature: ElectionFeature,
  selectedCode: string | null,
  compareTargetCode: string | null,
  partyNameByCode: Record<string, string>,
  isWinnerMargin: boolean,
  ctx: ModeContext,
): string {
  const ranked = getRankedPartiesForFeature(feature, null, asDataContext(ctx));
  if (!ranked.length) return '順位データ: N/A';

  return ranked
    .map((p, idx) => {
      const isTopTwo = isWinnerMargin && idx < 2;
      const isSelected = selectedCode != null && p.code === selectedCode;
      const isCompareTarget = compareTargetCode != null && p.code === compareTargetCode;
      const label = `第${idx + 1}位 ${partyNameByCode[p.code] || p.code}: ${pct(p.share)}`;
      return (isTopTwo || isSelected || isCompareTarget) ? `<strong>${label}</strong>` : label;
    })
    .join('<br>');
}

/** Formats a party's estimated vote count from share x valid votes. */
export function formatPartyVotes(share: number | null | undefined, validVotes: number | null | undefined): string {
  if (
    typeof share !== 'number'
    || Number.isNaN(share)
    || typeof validVotes !== 'number'
    || Number.isNaN(validVotes)
  ) {
    return 'N/A';
  }
  return Math.round(share * validVotes).toLocaleString();
}

interface MetricRow<T = RenderStats> {
  row: T;
  value: number;
}

/** Computes average, min, and max from a non-empty array of metric rows. */
export function summarizeMetricRows<T>(rows: MetricRow<T>[]): { avg: number; min: MetricRow<T>; max: MetricRow<T> } {
  const first = rows[0];
  let sum = 0;
  let min = first;
  let max = first;
  for (const entry of rows) {
    sum += entry.value;
    if (entry.value < min.value) min = entry;
    if (entry.value > max.value) max = entry;
  }
  return { avg: sum / rows.length, min, max };
}

/** Wraps lines into a named stats HTML block. */
export function renderStatsHtml(name: string, lines: string[]): string {
  const content = lines.map((line) => `<div>${line}</div>`).join('\n');
  return `
    <div class="name">${name}</div>
    ${content}
  `;
}

/** Returns a "no data" stats block. */
export function renderNoDataStatsHtml(name: string): string {
  return renderStatsHtml(name, ['データなし']);
}

/** Resolves the stats panel heading from the mode label config. */
export function resolveStatsHeading(labels: ModeLabelConfig, labelCtx: LabelContext): string {
  return labels.statsHeading ? resolveLabel(labels.statsHeading, labelCtx) : '';
}

/** Computes q95 max from an array of values. */
export function computeQ95Max(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const q95 = quantile(sorted, 0.95);
  return q95 > 0 ? q95 : 1;
}

/** Computes symmetric min/max from an array of values. */
export function computeSymmetricScale(values: number[]): { activeMin: number; activeMax: number } {
  if (!values.length) return { activeMin: -0.01, activeMax: 0.01 };
  const sorted = [...values].sort((a, b) => a - b);
  const q05 = quantile(sorted, 0.05);
  const q95 = quantile(sorted, 0.95);
  const maxAbs = Math.max(Math.abs(q05), Math.abs(q95), 0.01);
  return { activeMin: -maxAbs, activeMax: maxAbs };
}
