import { getFeatureStats } from '../data';
import { getModeHandler } from './registry';
import { computeActivePartyRankMax, getPartyRankColor } from './handlers/partyRank';
import { buildPartyRankPopupRows } from './handlers/shared';
import type {
  DataContext,
  ElectionFeature,
  ModeContext,
  PlotMode,
  RenderStats,
} from '../../types';

/** Computes all render-relevant statistics for a single feature given the current mode. */
export function getFeatureRenderStats(feature: ElectionFeature, ctx: ModeContext): RenderStats {
  const dataCtx: DataContext = {
    granularity: ctx.granularity,
    electionData: ctx.electionData,
    prefAgg: ctx.prefAgg,
    blockAgg: ctx.blockAgg,
  };
  const baseStats = getFeatureStats(feature, ctx.selectedParty, dataCtx);
  const handler = getModeHandler(ctx.plotMode);
  return handler.getRenderStats(feature, baseStats, ctx);
}

export { getPartyRankColor, computeActivePartyRankMax };

/** Builds the HTML party-rank rows shown in popups, bolding highlighted parties. */
export function buildPartyRankPopupRowsCompat(
  feature: ElectionFeature,
  selectedCode: string | null,
  compareTargetCode: string | null,
  partyNameByCode: Record<string, string>,
  mode: PlotMode,
  ctx: DataContext,
): string {
  return buildPartyRankPopupRows(
    feature,
    selectedCode,
    compareTargetCode,
    partyNameByCode,
    mode === 'winner_margin',
    ctx as ModeContext,
  );
}
