import { computeActivePartyRankMax } from '../lib/modes/handlers/partyRank';
import { getModeHandler } from '../lib/modes/registry';
import type { ModeContext } from '../types';
import type { ElectionStore } from './electionStore';

/** Clamps a rank value to [1, partiesLength]. */
export function sanitizeRank(rank: number, partiesLength: number): number {
  const max = Math.max(partiesLength, 1);
  const safe = Number.isFinite(rank) ? Math.floor(rank) : 1;
  return Math.max(1, Math.min(max, safe));
}

/** Recomputes all derived scale/break values based on the current store state. */
export function recompute(
  get: () => ElectionStore,
  set: (partial: Partial<ElectionStore>) => void,
): void {
  const state = get();
  const geo = state.geojsonByGranularity[state.granularity];
  const modeCtx: ModeContext = {
    plotMode: state.plotMode,
    granularity: state.granularity,
    selectedParty: state.selectedParty,
    compareTarget: state.compareTarget,
    selectedMetric: state.selectedMetric,
    rulingMetric: state.rulingMetric,
    rank: state.rank,
    electionData: state.electionData,
    prefAgg: state.prefAgg,
    blockAgg: state.blockAgg,
    parties: state.parties,
    partyNameByCode: state.partyNameByCode,
    activePartyRankMax: state.activePartyRankMax,
  };

  const activePartyRankMax = state.plotMode === 'party_rank'
    ? computeActivePartyRankMax(modeCtx, geo)
    : 1;

  const handler = getModeHandler(state.plotMode);
  const scale = handler.computeScale(geo, modeCtx, {
    scaleMode: state.scaleMode,
    selectedParty: state.selectedParty,
    selectedMetric: state.selectedMetric,
    rulingMetric: state.rulingMetric,
    compareTarget: state.compareTarget,
    activeBreaks: state.activeBreaks,
    activeMax: state.activeMax,
    activeMin: state.activeMin,
    activeCrossesZero: state.activeCrossesZero,
  });

  set({
    activePartyRankMax,
    activeBreaks: scale.activeBreaks ?? state.activeBreaks,
    activeMax: scale.activeMax,
    activeMin: scale.activeMin,
    activeCrossesZero: scale.activeCrossesZero,
  });
}
