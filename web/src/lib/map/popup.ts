import type { Feature } from 'geojson';
import { getFeatureRenderStats } from '../modes/rendering';
import { getModeHandler } from '../modes/registry';
import { buildPartyRankPopupRows, formatPartyVotes } from '../modes/handlers/shared';
import type { MapRenderContext } from './featureStyle';

/** Builds the full popup HTML for a clicked feature based on the current mode. */
export function buildPopupHtml(feature: Feature, ctx: MapRenderContext): string {
  const stats = getFeatureRenderStats(feature, ctx);
  const handler = getModeHandler(ctx.plotMode);
  const validVotesText = typeof stats.validVotes === 'number' ? stats.validVotes.toLocaleString() : 'N/A';

  const helpers = {
    buildPartyRankPopupRows: (
      feat: Feature,
      selectedCode: string | null,
      compareTargetCode: string | null,
    ) => buildPartyRankPopupRows(
      feat as any,
      selectedCode,
      compareTargetCode,
      ctx.partyNameByCode,
      ctx.plotMode === 'winner_margin',
      ctx,
    ),
    formatPartyVotes,
    validVotesText,
  };

  return handler.buildPopupHtml(stats, feature as any, ctx, helpers);
}
