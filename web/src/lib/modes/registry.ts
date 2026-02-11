import type { PlotMode } from '../../types';
import type { ModeHandler } from './types';
import { handler as shareHandler } from './handlers/share';
import { handler as partyRankHandler } from './handlers/partyRank';
import { rankHandler, oppositionRankHandler } from './handlers/rank';
import { handler as selectedDiffHandler } from './handlers/selectedDiff';
import { handler as rulingVsOppositionHandler } from './handlers/rulingVsOpposition';
import { handler as winnerMarginHandler } from './handlers/winnerMargin';
import { handler as concentrationHandler } from './handlers/concentration';
import { handler as jsDivergenceHandler } from './handlers/jsDivergence';

export const MODE_HANDLERS: Record<PlotMode, ModeHandler> = {
  share: shareHandler,
  party_rank: partyRankHandler,
  rank: rankHandler,
  opposition_rank: oppositionRankHandler,
  selected_diff: selectedDiffHandler,
  ruling_vs_opposition: rulingVsOppositionHandler,
  winner_margin: winnerMarginHandler,
  concentration: concentrationHandler,
  js_divergence: jsDivergenceHandler,
};

export function getModeHandler(mode: PlotMode): ModeHandler {
  return MODE_HANDLERS[mode];
}
