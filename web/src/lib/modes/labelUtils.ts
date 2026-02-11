import type { MetricMode, Party, PlotMode } from '../../types';
import { MODE_TEXT_BY_VALUE } from './labels';

/** Resolved label context used by mode label templates. */
export interface LabelContext {
  mode: PlotMode;
  partyName: string;
  targetName: string;
  metricMode: MetricMode | null;
  rankN: string;
  modeText: string;
}

/** Input state needed to build a LabelContext. */
export interface LabelState {
  plotMode: PlotMode;
  selectedParty: string;
  compareTarget: string;
  selectedMetric: MetricMode;
  rulingMetric: MetricMode;
  rank: number;
  partyNameByCode: Record<string, string>;
  parties: Party[];
}

/** Builds a LabelContext from the current UI state for use with mode label templates. */
export function buildLabelContext(state: LabelState): LabelContext {
  const mode = state.plotMode;
  const partyName = state.partyNameByCode[state.selectedParty] || '';
  const targetName = state.compareTarget === 'top'
    ? '第1党'
    : (state.partyNameByCode[state.compareTarget] || '比較対象');
  const metricMode = mode === 'selected_diff'
    ? state.selectedMetric
    : mode === 'ruling_vs_opposition'
      ? state.rulingMetric
      : null;
  const rankN = String(state.rank || 1);
  const modeText = MODE_TEXT_BY_VALUE[mode] || mode;
  return { mode, partyName, targetName, metricMode, rankN, modeText };
}

/** Resolves a label template: returns the string as-is, or calls the function with the context. */
export function resolveLabel(
  labelOrFn: string | ((ctx: LabelContext) => string),
  ctx: LabelContext,
): string {
  if (typeof labelOrFn === 'function') return labelOrFn(ctx);
  return labelOrFn;
}
