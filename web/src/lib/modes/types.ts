import type {
  ElectionFeature,
  ElectionGeoJson,
  FeatureStats,
  ModeContext,
  RenderStats,
} from '../../types';
import type { MapRenderContext } from '../map/featureStyle';
import type { LabelContext } from './labelUtils';

export interface ModeHandler {
  /** Computes all render-relevant stats for a single feature in this mode. */
  getRenderStats: (feature: ElectionFeature, baseStats: FeatureStats, ctx: ModeContext) => RenderStats;

  /** Returns the fill color for a feature in this mode. */
  getColor: (stats: RenderStats, ctx: MapRenderContext) => string;

  /** Builds the popup HTML for a clicked feature in this mode. */
  buildPopupHtml: (
    stats: RenderStats,
    feature: ElectionFeature,
    ctx: MapRenderContext,
    helpers: PopupHelpers,
  ) => string;

  /** Builds the stats panel HTML for this mode. */
  buildStatsHtml: (
    geo: ElectionGeoJson | null,
    modeCtx: ModeContext,
    labelCtx: LabelContext,
    granularityLabel: string,
  ) => string;

  /** Computes scale min/max/crossesZero for this mode. */
  computeScale: (
    geo: ElectionGeoJson | null,
    modeCtx: ModeContext,
    state: ScaleState,
  ) => ScaleResult;

  /** Which controls to show in the control panel. */
  controls: ModeControls;

  /** Fill opacity for features in this mode. */
  fillOpacity?: number;

  /** Mode label configuration. */
  labels: ModeLabelConfig;
}

export interface ModeControls {
  showPartySelector: boolean;
  showCompareTarget: boolean;
  showSelectedMetric: boolean;
  showRulingMetric: boolean;
  showScaleMode: boolean;
  showRankSelector: boolean;
  showModeHelp: boolean;
  partySelectorLabel?: string;
}

export interface ScaleState {
  scaleMode: 'fixed' | 'party';
  selectedParty: string;
  selectedMetric: string;
  rulingMetric: string;
  compareTarget: string;
  activeBreaks: number[];
  activeMax: number;
  activeMin: number;
  activeCrossesZero: boolean;
}

export interface ScaleResult {
  activeBreaks?: number[];
  activeMax: number;
  activeMin: number;
  activeCrossesZero: boolean;
}

export interface PopupHelpers {
  buildPartyRankPopupRows: (
    feature: ElectionFeature,
    selectedCode: string | null,
    compareTargetCode: string | null,
  ) => string;
  formatPartyVotes: (share: number | null | undefined, validVotes: number | null | undefined) => string;
  validVotesText: string;
}

export interface ModeLabelConfig {
  modeHeading: string | ((ctx: LabelContext) => string);
  modeSummary: string | ((ctx: LabelContext) => string);
  legendSectionTitle: string | ((ctx: LabelContext) => string);
  statsHeading: string | ((ctx: LabelContext) => string) | null;
  popupMetricName: string | ((ctx: LabelContext) => string) | null;
  controlHelp: string | ((ctx: LabelContext) => string) | null;
  controlHelpIsHtml?: boolean;
  statsHeadingIsHtml?: boolean;
  lowSideLabel?: string | ((ctx: LabelContext) => string);
  highSideLabel?: string | ((ctx: LabelContext) => string);
}
