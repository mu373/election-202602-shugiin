import type { Feature } from 'geojson';
import type L from 'leaflet';
import { create } from 'zustand';
import {
  DATA_FILE_NAMES,
  DEFAULT_GRANULARITY,
  DEFAULT_PLOT_MODE,
  DEFAULT_RULING_METRIC,
  DEFAULT_SCALE_MODE,
  DEFAULT_SELECTED_METRIC,
  FIXED_BREAKS,
  GITHUB_RAW_BASE,
  LOCAL_DATA_BASE,
  SELECTED_DIFF_DEFAULT_BASE,
  SELECTED_DIFF_DEFAULT_TARGET,
} from '../lib/constants';
import { quantile } from '../lib/colors';
import { buildAggregates, buildPartyColorMap } from '../lib/data';
import {
  computeActivePartyRankMax,
  computeActiveScale,
  getFeatureRenderStats,
  getNationalDivergenceValuesForCurrentGranularity,
  getRulingOppositionValuesForCurrentGranularity,
  getSelectedVsTopValuesForCurrentGranularity,
  getWinnerMarginValuesForCurrentGranularity,
  isConcentrationMode,
  isNationalDivergenceMode,
  isRulingVsOppositionMode,
  isSelectedVsTopMode,
  isWinnerMarginMode,
} from '../lib/modes';
import type {
  Aggregate,
  ElectionGeoJson,
  ElectionRecord,
  GeoJsonByGranularity,
  Granularity,
  MetricMode,
  ModeContext,
  Party,
  PlotMode,
  ScaleMode,
} from '../types';

interface ElectionStore {
  geojsonByGranularity: GeoJsonByGranularity;
  electionData: Record<string, ElectionRecord>;
  parties: Party[];
  partyNameByCode: Record<string, string>;
  partyColorByCode: Record<string, string>;
  prefToBlock: Record<string, string>;
  prefAgg: Record<string, Aggregate>;
  blockAgg: Record<string, Aggregate>;

  plotMode: PlotMode;
  granularity: Granularity;
  selectedParty: string;
  compareTarget: string;
  selectedMetric: MetricMode;
  rulingMetric: MetricMode;
  scaleMode: ScaleMode;
  rank: number;
  labelsVisible: boolean;
  prefBordersVisible: boolean;

  activeBreaks: number[];
  activeMax: number;
  activeMin: number;
  activeCrossesZero: boolean;
  activePartyRankMax: number;
  lastPlotMode: PlotMode | null;

  loading: boolean;
  loaded: boolean;

  geoLayer: L.GeoJSON | null;

  loadData: () => Promise<void>;
  setPlotMode: (mode: PlotMode) => void;
  setGranularity: (g: Granularity) => void;
  setSelectedParty: (code: string) => void;
  setCompareTarget: (target: string) => void;
  setSelectedMetric: (m: MetricMode) => void;
  setRulingMetric: (m: MetricMode) => void;
  setScaleMode: (s: ScaleMode) => void;
  setRank: (r: number) => void;
  setLabelsVisible: (v: boolean) => void;
  setPrefBordersVisible: (v: boolean) => void;
  setGeoLayer: (layer: L.GeoJSON | null) => void;
  hydrateUi: (ui: Partial<Pick<ElectionStore,
    'plotMode' | 'granularity' | 'selectedParty' | 'compareTarget' | 'selectedMetric' | 'rulingMetric' | 'scaleMode' | 'rank' | 'labelsVisible' | 'prefBordersVisible'
  >>) => void;
  recompute: () => void;
}

function getConfiguredDataSourceMode(): 'local' | 'remote' | null {
  const mode = import.meta.env.VITE_DATA_SOURCE_MODE as string | undefined;
  if (mode === 'local' || mode === 'remote') return mode;
  return null;
}

function getDataUrlOrder(fileName: string): string[] {
  const localUrl = `${LOCAL_DATA_BASE}/${fileName}`;
  const remoteUrl = `${GITHUB_RAW_BASE}/${fileName}`;
  const mode = getConfiguredDataSourceMode() || 'remote';
  return mode === 'local' ? [localUrl] : [remoteUrl, localUrl];
}

async function loadDataWithFallback(fileName: string): Promise<unknown> {
  const urls = getDataUrlOrder(fileName);
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'unknown error';
  throw new Error(`Failed to load ${fileName}: ${message}`);
}

function buildModeContext(state: ElectionStore): ModeContext {
  return {
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
}

function sanitizeRank(rank: number, partiesLength: number): number {
  const max = Math.max(partiesLength, 1);
  const safe = Number.isFinite(rank) ? Math.floor(rank) : 1;
  return Math.max(1, Math.min(max, safe));
}

export const useElectionStore = create<ElectionStore>((set, get) => ({
  geojsonByGranularity: { muni: null, pref: null, block: null },
  electionData: {},
  parties: [],
  partyNameByCode: {},
  partyColorByCode: {},
  prefToBlock: {},
  prefAgg: {},
  blockAgg: {},

  plotMode: DEFAULT_PLOT_MODE,
  granularity: DEFAULT_GRANULARITY,
  selectedParty: '',
  compareTarget: 'top',
  selectedMetric: DEFAULT_SELECTED_METRIC,
  rulingMetric: DEFAULT_RULING_METRIC,
  scaleMode: DEFAULT_SCALE_MODE,
  rank: 2,
  labelsVisible: true,
  prefBordersVisible: true,

  activeBreaks: [...FIXED_BREAKS],
  activeMax: 1,
  activeMin: 0,
  activeCrossesZero: false,
  activePartyRankMax: 1,
  lastPlotMode: null,

  loading: false,
  loaded: false,

  geoLayer: null,

  async loadData() {
    if (get().loading || get().loaded) return;
    set({ loading: true });

    try {
      const [
        muniGeojson,
        prefGeojson,
        blockGeojson,
        election,
        partyList,
      ] = await Promise.all(DATA_FILE_NAMES.map((fileName) => loadDataWithFallback(fileName)));

      const geojsonByGranularity: GeoJsonByGranularity = {
        muni: muniGeojson as ElectionGeoJson,
        pref: prefGeojson as ElectionGeoJson,
        block: blockGeojson as ElectionGeoJson,
      };

      const electionData = election as Record<string, ElectionRecord>;
      const parties = partyList as Party[];
      const partyNameByCode = Object.fromEntries(parties.map((p) => [p.code, p.name]));
      const partyColorByCode = buildPartyColorMap(parties);

      const prefToBlock: Record<string, string> = {};
      for (const f of (geojsonByGranularity.pref?.features || [])) {
        const feature = f as Feature;
        const props = (feature.properties || {}) as { pref_name?: string; block_name?: string };
        if (props.pref_name && props.block_name) prefToBlock[props.pref_name] = props.block_name;
      }

      const { prefAgg, blockAgg } = buildAggregates(electionData, prefToBlock);
      const defaultParty = parties.some((p) => p.code === 'mirai')
        ? 'mirai'
        : (parties[0]?.code || '');

      set({
        geojsonByGranularity,
        electionData,
        parties,
        partyNameByCode,
        partyColorByCode,
        prefToBlock,
        prefAgg,
        blockAgg,
        selectedParty: get().selectedParty || defaultParty,
        rank: sanitizeRank(get().rank || (parties.length >= 2 ? 2 : 1), parties.length),
        loading: false,
        loaded: true,
      });

      get().recompute();
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  setPlotMode(mode) {
    const state = get();
    const modeChanged = state.lastPlotMode !== null && state.lastPlotMode !== mode;
    const next: Partial<ElectionStore> = { plotMode: mode, lastPlotMode: mode };

    if (modeChanged && mode === 'share') {
      if (state.parties.some((p) => p.code === 'mirai')) next.selectedParty = 'mirai';
      next.scaleMode = 'party';
    }

    if (modeChanged && mode === 'selected_diff') {
      if (state.parties.some((p) => p.code === SELECTED_DIFF_DEFAULT_BASE)) {
        next.selectedParty = SELECTED_DIFF_DEFAULT_BASE;
      }
      if (state.parties.some((p) => p.code === SELECTED_DIFF_DEFAULT_TARGET)) {
        next.compareTarget = SELECTED_DIFF_DEFAULT_TARGET;
      }
    }

    if (modeChanged && mode === 'party_rank') {
      if (state.parties.some((p) => p.code === 'mirai')) next.selectedParty = 'mirai';
    }

    set(next as Pick<ElectionStore, 'plotMode'>);
    get().recompute();
  },

  setGranularity(g) {
    set({ granularity: g });
    get().recompute();
  },

  setSelectedParty(code) {
    set({ selectedParty: code });
    get().recompute();
  },

  setCompareTarget(target) {
    set({ compareTarget: target });
    get().recompute();
  },

  setSelectedMetric(m) {
    set({ selectedMetric: m });
    get().recompute();
  },

  setRulingMetric(m) {
    set({ rulingMetric: m });
    get().recompute();
  },

  setScaleMode(s) {
    set({ scaleMode: s });
    get().recompute();
  },

  setRank(r) {
    const rank = sanitizeRank(r, get().parties.length);
    set({ rank });
    get().recompute();
  },

  setLabelsVisible(v) {
    set({ labelsVisible: v });
  },

  setPrefBordersVisible(v) {
    set({ prefBordersVisible: v });
  },

  setGeoLayer(layer) {
    set({ geoLayer: layer });
  },

  hydrateUi(ui) {
    const partiesLength = get().parties.length;
    const next: Partial<ElectionStore> = { ...ui };

    if (ui.rank != null) {
      next.rank = sanitizeRank(ui.rank, partiesLength);
    }

    set(next);
    get().recompute();
  },

  recompute() {
    const state = get();
    const geo = state.geojsonByGranularity[state.granularity];
    const modeCtx = buildModeContext(state);

    const activePartyRankMax = computeActivePartyRankMax(modeCtx, geo);
    let activeBreaks = state.activeBreaks;
    let activeMax = state.activeMax;
    let activeMin = state.activeMin;
    let activeCrossesZero = state.activeCrossesZero;

    if (state.plotMode === 'share') {
      const scale = computeActiveScale(state.scaleMode, state.selectedParty, modeCtx);
      activeBreaks = scale.breaks;
      activeMax = scale.max;
      activeMin = 0;
      activeCrossesZero = false;
    } else if (isSelectedVsTopMode(state.plotMode)) {
      const values = getSelectedVsTopValuesForCurrentGranularity(
        state.selectedParty,
        state.compareTarget,
        state.selectedMetric,
        geo,
        modeCtx,
      ).sort((a, b) => a - b);

      if (!values.length) {
        activeMin = -0.01;
        activeMax = 0.01;
        activeCrossesZero = true;
      } else {
        const q05 = quantile(values, 0.05);
        const q95 = quantile(values, 0.95);
        const maxAbs = Math.max(Math.abs(q05), Math.abs(q95), 0.01);
        activeMin = -maxAbs;
        activeMax = maxAbs;
        activeCrossesZero = true;
      }
    } else if (isRulingVsOppositionMode(state.plotMode)) {
      const values = getRulingOppositionValuesForCurrentGranularity(
        state.rulingMetric,
        geo,
        modeCtx,
      ).sort((a, b) => a - b);

      if (!values.length) {
        activeMin = -0.01;
        activeMax = 0.01;
        activeCrossesZero = true;
      } else {
        const q05 = quantile(values, 0.05);
        const q95 = quantile(values, 0.95);
        const maxAbs = Math.max(Math.abs(q05), Math.abs(q95), 0.01);
        activeMin = -maxAbs;
        activeMax = maxAbs;
        activeCrossesZero = true;
      }
    } else if (isConcentrationMode(state.plotMode)) {
      activeMin = 0;
      activeCrossesZero = false;

      const values: number[] = [];
      for (const feature of geo?.features || []) {
        const stats = getFeatureRenderStats(feature, { ...modeCtx, activePartyRankMax });
        if (typeof stats.share === 'number' && !Number.isNaN(stats.share)) values.push(stats.share);
      }

      values.sort((a, b) => a - b);
      const q95 = quantile(values, 0.95);
      activeMax = q95 > 0 ? q95 : 1;
    } else if (isWinnerMarginMode(state.plotMode)) {
      activeMin = 0;
      activeCrossesZero = false;

      const values = getWinnerMarginValuesForCurrentGranularity(geo, modeCtx).sort((a, b) => a - b);
      const q95 = quantile(values, 0.95);
      activeMax = q95 > 0 ? q95 : 1;
    } else if (isNationalDivergenceMode(state.plotMode)) {
      activeMin = 0;
      activeCrossesZero = false;

      const values = getNationalDivergenceValuesForCurrentGranularity(geo, modeCtx).sort((a, b) => a - b);
      const q95 = quantile(values, 0.95);
      activeMax = q95 > 0 ? q95 : 1;
    }

    set({
      activePartyRankMax,
      activeBreaks,
      activeMax,
      activeMin,
      activeCrossesZero,
    });
  },
}));

export type { ElectionStore };
