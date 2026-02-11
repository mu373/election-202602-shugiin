import type { Feature, FeatureCollection, Geometry } from 'geojson';

/** All available plot/visualization modes. */
export const PLOT_MODES = [
  'share',
  'party_rank',
  'rank',
  'opposition_rank',
  'selected_diff',
  'ruling_vs_opposition',
  'winner_margin',
  'concentration',
  'js_divergence',
] as const;

/** Available geographic granularity levels. */
export const GRANULARITIES = ['muni', 'pref', 'block'] as const;

/** Metric display modes for comparison views. */
export const METRIC_MODES = ['diff', 'ratio'] as const;

/** Color-scale modes for the share view. */
export const SCALE_MODES = ['fixed', 'party'] as const;

export type PlotMode = (typeof PLOT_MODES)[number];
export type Granularity = (typeof GRANULARITIES)[number];
export type MetricMode = (typeof METRIC_MODES)[number];
export type ScaleMode = (typeof SCALE_MODES)[number];

/** A political party with national-level summary data. */
export interface Party {
  code: string;
  name: string;
  total_votes: number;
  municipalities: number;
}

/** Municipality-level election record with party vote shares. */
export interface ElectionRecord {
  name?: string;
  pref?: string;
  valid_votes?: number;
  parties?: Record<string, number>;
}

/** Aggregated vote totals for a prefecture or block. */
export interface Aggregate {
  valid_votes: number;
  party_votes: Record<string, number>;
}

/** GeoJSON feature properties used in the election map. */
export interface GeoProps {
  muni_code?: string | number;
  muni_name?: string;
  pref_name?: string;
  block_name?: string;
  label_lng?: number;
  label_lat?: number;
  area_km2?: number;
  main_area_km2?: number;
  [key: string]: unknown;
}

/** A GeoJSON feature with election-specific properties. */
export type ElectionFeature = Feature<Geometry, GeoProps | null>;

/** A GeoJSON feature collection with election-specific properties. */
export type ElectionGeoJson = FeatureCollection<Geometry, GeoProps | null>;

/** Pre-loaded GeoJSON data keyed by granularity. */
export interface GeoJsonByGranularity {
  muni: ElectionGeoJson | null;
  pref: ElectionGeoJson | null;
  block: ElectionGeoJson | null;
}

/** Minimal data context needed for feature lookups (granularity + data sources). */
export interface DataContext {
  granularity: Granularity;
  electionData: Record<string, ElectionRecord>;
  prefAgg: Record<string, Aggregate>;
  blockAgg: Record<string, Aggregate>;
}

/** Full mode context: data context plus UI selections and party metadata. */
export interface ModeContext extends DataContext {
  plotMode: PlotMode;
  selectedParty: string;
  rank: number;
  compareTarget: string;
  selectedMetric: MetricMode;
  rulingMetric: MetricMode;
  parties: Party[];
  partyNameByCode: Record<string, string>;
  activePartyRankMax: number;
}

/** Basic feature statistics (label, share, valid votes). */
export interface FeatureStats {
  label: string;
  share: number | null;
  validVotes: number | null;
}

/** Extended render statistics for a feature, including mode-specific fields. */
export interface RenderStats extends FeatureStats {
  rank?: number | null;
  actualRank?: number | null;
  partyCode?: string | null;
  partyName?: string | null;
  gap?: number | null;
  selectedShare?: number | null;
  targetShare?: number | null;
  targetPartyCode?: string | null;
  targetPartyName?: string | null;
  compareTargetMode?: 'top' | 'party';
  compareTargetLabel?: string;
  ratio?: number | null;
  logRatio?: number | null;
  metricMode?: MetricMode;
  rulingShare?: number | null;
  oppositionShare?: number | null;
  concentration?: number | null;
  effectivePartyCount?: number | null;
  margin?: number | null;
  winnerPartyCode?: string | null;
  winnerPartyName?: string | null;
  winnerShare?: number | null;
  runnerUpPartyCode?: string | null;
  runnerUpPartyName?: string | null;
  runnerUpShare?: number | null;
  nationalDivergence?: number | null;
}

/** A party entry in a ranked list with code, share, and raw vote count. */
export interface RankedParty {
  code: string;
  share: number;
  votes: number;
}
