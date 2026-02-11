import type {
  Aggregate,
  ElectionGeoJson,
  ElectionRecord,
  GeoJsonByGranularity,
  MetricMode,
  ModeContext,
  Party,
  PlotMode,
} from '../types';
import { getModeHandler } from './modes/registry';
import { buildLabelContext } from './modes/labelUtils';

/** Input state slice needed by buildStatsHtml. */
export interface StatsModeState {
  plotMode: PlotMode;
  granularity: 'muni' | 'pref' | 'block';
  selectedParty: string;
  compareTarget: string;
  selectedMetric: MetricMode;
  rulingMetric: MetricMode;
  scaleMode: 'fixed' | 'party';
  rank: number;
  electionData: Record<string, ElectionRecord>;
  prefAgg: Record<string, Aggregate>;
  blockAgg: Record<string, Aggregate>;
  parties: Party[];
  partyNameByCode: Record<string, string>;
  activePartyRankMax: number;
  geojsonByGranularity: GeoJsonByGranularity;
}

/** Returns a Japanese label for the granularity level. */
function getGranularityLabel(granularity: 'muni' | 'pref' | 'block'): string {
  if (granularity === 'muni') return '市区町村';
  if (granularity === 'pref') return '都道府県';
  return 'ブロック';
}

/** Builds the complete stats HTML string for the sidebar/stats panel based on the current mode. */
export function buildStatsHtml(state: StatsModeState): string {
  const geo: ElectionGeoJson | null = state.geojsonByGranularity[state.granularity];
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
  const labelCtx = buildLabelContext({
    plotMode: state.plotMode,
    selectedParty: state.selectedParty,
    compareTarget: state.compareTarget,
    selectedMetric: state.selectedMetric,
    rulingMetric: state.rulingMetric,
    rank: state.rank,
    partyNameByCode: state.partyNameByCode,
    parties: state.parties,
  });
  const granularityLabel = getGranularityLabel(state.granularity);

  const handler = getModeHandler(state.plotMode);
  return handler.buildStatsHtml(geo, modeCtx, labelCtx, granularityLabel);
}
