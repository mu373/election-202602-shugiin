import { useEffect, useRef } from 'react';
import {
  GRANULARITIES,
  METRIC_MODES,
  PLOT_MODES,
  SCALE_MODES,
  SELECTED_DIFF_DEFAULT_BASE,
  SELECTED_DIFF_DEFAULT_TARGET,
} from '../lib/constants';
import { useElectionStore } from '../store/electionStore';
import type { MetricMode, PlotMode } from '../types';

const plotModes = new Set<string>(PLOT_MODES);
const granularities = new Set<string>(GRANULARITIES);
const metricModes = new Set<string>(METRIC_MODES);
const scaleModes = new Set<string>(SCALE_MODES);

function toBool(value: string | null, defaultValue: boolean): boolean {
  if (value == null) return defaultValue;
  return !(value === '0' || value === 'false');
}

export function useUrlState(): void {
  const loaded = useElectionStore((s) => s.loaded);
  const parties = useElectionStore((s) => s.parties);
  const hydrateUi = useElectionStore((s) => s.hydrateUi);
  const plotMode = useElectionStore((s) => s.plotMode);
  const granularity = useElectionStore((s) => s.granularity);
  const selectedParty = useElectionStore((s) => s.selectedParty);
  const compareTarget = useElectionStore((s) => s.compareTarget);
  const selectedMetric = useElectionStore((s) => s.selectedMetric);
  const rulingMetric = useElectionStore((s) => s.rulingMetric);
  const scaleMode = useElectionStore((s) => s.scaleMode);
  const rank = useElectionStore((s) => s.rank);
  const labelsVisible = useElectionStore((s) => s.labelsVisible);
  const prefBordersVisible = useElectionStore((s) => s.prefBordersVisible);

  const hydrated = useRef(false);

  useEffect(() => {
    if (!loaded || hydrated.current) return;

    const params = new URLSearchParams(window.location.search);
    const defaultRank = parties.length >= 2 ? 2 : 1;

    if (!params.toString()) {
      hydrated.current = true;
      return;
    }

    const qMode = params.get('mode');
    const qGranularity = params.get('granularity');
    const qParty = params.get('party');
    const qBase = params.get('base');
    const qScale = params.get('scale');
    const qTarget = params.get('target');
    const qMetric = params.get('metric');
    const qRank = params.get('rank');
    const qLabels = params.get('labels');
    const qPrefBorders = params.get('prefBorders');

    const validPartyCodes = new Set(parties.map((p) => p.code));

    const nextMode: PlotMode = (qMode && plotModes.has(qMode) ? qMode : 'share') as PlotMode;
    const nextGranularity = qGranularity && granularities.has(qGranularity) ? qGranularity : 'muni';

    let nextSelectedParty = selectedParty;
    if (nextMode === 'share' || nextMode === 'party_rank') {
      if (qParty && validPartyCodes.has(qParty)) nextSelectedParty = qParty;
      else if (nextMode === 'party_rank' && validPartyCodes.has('mirai')) nextSelectedParty = 'mirai';
    } else if (nextMode === 'selected_diff') {
      if (qBase && validPartyCodes.has(qBase)) nextSelectedParty = qBase;
      else if (validPartyCodes.has(SELECTED_DIFF_DEFAULT_BASE)) nextSelectedParty = SELECTED_DIFF_DEFAULT_BASE;
    }

    const nextScaleMode = qScale && scaleModes.has(qScale) ? qScale : scaleMode;

    let nextCompareTarget = compareTarget;
    if (qTarget && (qTarget === 'top' || validPartyCodes.has(qTarget))) {
      nextCompareTarget = qTarget;
    } else if (nextMode === 'selected_diff' && validPartyCodes.has(SELECTED_DIFF_DEFAULT_TARGET)) {
      nextCompareTarget = SELECTED_DIFF_DEFAULT_TARGET;
    }

    const rankNum = qRank ? Number.parseInt(qRank, 10) : defaultRank;
    const rank = Number.isInteger(rankNum) ? rankNum : defaultRank;

    let nextSelectedMetric: MetricMode = selectedMetric;
    let nextRulingMetric: MetricMode = rulingMetric;
    if (qMetric && metricModes.has(qMetric)) {
      if (nextMode === 'selected_diff') nextSelectedMetric = qMetric as MetricMode;
      if (nextMode === 'ruling_vs_opposition') nextRulingMetric = qMetric as MetricMode;
    }

    hydrateUi({
      plotMode: nextMode,
      granularity: nextGranularity as 'muni' | 'pref' | 'block',
      selectedParty: nextSelectedParty,
      compareTarget: nextCompareTarget,
      scaleMode: nextScaleMode as 'fixed' | 'party',
      selectedMetric: nextSelectedMetric,
      rulingMetric: nextRulingMetric,
      rank,
      labelsVisible: toBool(qLabels, true),
      prefBordersVisible: toBool(qPrefBorders, true),
    });

    hydrated.current = true;
  }, [
    loaded,
    parties,
    selectedParty,
    compareTarget,
    scaleMode,
    selectedMetric,
    rulingMetric,
    hydrateUi,
  ]);

  useEffect(() => {
    if (!loaded || !hydrated.current) return;

    const url = new URL(window.location.href);
    const mode = plotMode;

    url.searchParams.delete('granularity');
    if (granularity !== 'muni') {
      url.searchParams.set('granularity', granularity);
    }

    url.searchParams.set('mode', mode);

    url.searchParams.delete('labels');
    url.searchParams.delete('prefBorders');
    if (!labelsVisible) url.searchParams.set('labels', '0');
    if (!prefBordersVisible) url.searchParams.set('prefBorders', '0');

    url.searchParams.delete('party');
    url.searchParams.delete('base');
    url.searchParams.delete('scale');
    url.searchParams.delete('target');
    url.searchParams.delete('metric');
    url.searchParams.delete('rank');

    if (mode === 'share') {
      url.searchParams.set('party', selectedParty);
      url.searchParams.set('scale', scaleMode);
    } else if (mode === 'party_rank') {
      url.searchParams.set('party', selectedParty);
    } else if (mode === 'rank' || mode === 'opposition_rank') {
      url.searchParams.set('rank', String(rank));
    } else if (mode === 'selected_diff') {
      url.searchParams.set('base', selectedParty);
      url.searchParams.set('target', compareTarget);
      url.searchParams.set('metric', selectedMetric);
    } else if (mode === 'ruling_vs_opposition') {
      url.searchParams.set('metric', rulingMetric);
    }

    window.history.replaceState({}, '', url);
  }, [
    loaded,
    plotMode,
    granularity,
    selectedParty,
    compareTarget,
    selectedMetric,
    rulingMetric,
    scaleMode,
    rank,
    labelsVisible,
    prefBordersVisible,
  ]);
}
