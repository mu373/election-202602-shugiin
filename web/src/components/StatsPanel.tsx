import { useMemo } from 'react';
import { ppLabel, ppSignedLabel, pct, ratioLabel } from '../lib/format';
import { MODE_LABELS, buildLabelContext, resolveLabel } from '../lib/modeLabels';
import {
  getFeatureRenderStats,
  getPartyRankForFeature,
  isConcentrationMode,
  isNationalDivergenceMode,
  isPartyRankMode,
  isRankMode,
  isRulingVsOppositionMode,
  isSelectedVsTopMode,
  isWinnerMarginMode,
} from '../lib/modes';
import { getRankedPartiesForFeature } from '../lib/data';
import { useElectionStore } from '../store/electionStore';
import type { ModeContext } from '../types';

interface StatsPanelProps {
  mirror?: boolean;
}

function getGranularityLabel(granularity: 'muni' | 'pref' | 'block'): string {
  if (granularity === 'muni') return '市区町村';
  if (granularity === 'pref') return '都道府県';
  return 'ブロック';
}

function buildModeContext(state: ReturnType<typeof useElectionStore.getState>): ModeContext {
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

export function StatsPanel({ mirror = false }: StatsPanelProps) {
  const state = useElectionStore((s) => s);
  const geo = state.geojsonByGranularity[state.granularity];
  const modeCtx = useMemo(() => buildModeContext(state), [state]);

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

  const html = useMemo(() => {
    if (isPartyRankMode(state.plotMode)) {
      const config = MODE_LABELS[labelCtx.mode];
      const counts: Record<number, number> = {};

      for (const feature of geo?.features || []) {
        const rank = getPartyRankForFeature(feature, state.selectedParty, modeCtx).rank;
        if (rank != null) counts[rank] = (counts[rank] || 0) + 1;
      }

      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return `
        <div class="name">${config.statsTitle ? resolveLabel(config.statsTitle, labelCtx) : ''}</div>
        <div>表示単位: ${getGranularityLabel(state.granularity)}</div>
        <div>第1位の件数: ${(counts[1] || 0).toLocaleString()}</div>
        <div>最頻順位: ${top ? `第${top[0]}位` : 'N/A'} (${top ? Number(top[1]).toLocaleString() : 0})</div>
      `;
    }

    if (isRankMode(state.plotMode)) {
      const config = MODE_LABELS[labelCtx.mode];
      const counts: Record<string, number> = {};
      for (const feature of geo?.features || []) {
        const ranked = getRankedPartiesForFeature(feature, state.plotMode === 'opposition_rank' ? 'jimin' : null, modeCtx);
        const p = ranked[state.rank - 1];
        if (p) counts[p.code] = (counts[p.code] || 0) + 1;
      }

      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const top = sorted[0];
      const bottom = sorted[sorted.length - 1];
      return `
        <div class="name">${config.statsTitle ? resolveLabel(config.statsTitle, labelCtx) : ''}</div>
        <div>表示単位: ${getGranularityLabel(state.granularity)}</div>
        <div>最多: ${top ? `${state.partyNameByCode[top[0]] || top[0]} (${top[1].toLocaleString()})` : 'N/A'}</div>
        <div>最少: ${bottom ? `${state.partyNameByCode[bottom[0]] || bottom[0]} (${bottom[1].toLocaleString()})` : 'N/A'}</div>
      `;
    }

    if (isSelectedVsTopMode(state.plotMode)) {
      const config = MODE_LABELS[labelCtx.mode];
      const metricMode = state.selectedMetric;
      const rows = [] as Array<ReturnType<typeof getFeatureRenderStats>>;

      for (const feature of geo?.features || []) {
        const s = getFeatureRenderStats(feature, modeCtx);
        if (metricMode === 'ratio') {
          if (typeof s.ratio === 'number' && !Number.isNaN(s.ratio)) rows.push(s);
        } else if (typeof s.gap === 'number' && !Number.isNaN(s.gap)) {
          rows.push(s);
        }
      }

      if (!rows.length) {
        return `<div class="name">${config.statsTitle ? resolveLabel(config.statsTitle, labelCtx) : ''}</div><div>データなし</div>`;
      }

      const metricKey = metricMode === 'ratio' ? 'ratio' : 'gap';
      const sortedAsc = [...rows].sort((a, b) => (a[metricKey] as number) - (b[metricKey] as number));
      const sortedDesc = [...rows].sort((a, b) => (b[metricKey] as number) - (a[metricKey] as number));
      const avgValue = rows.reduce((acc, r) => acc + (r[metricKey] as number), 0) / rows.length;
      const fmt = (v: number) => (metricMode === 'ratio' ? ratioLabel(v) : ppSignedLabel(v));

      return `
        <div class="name">${config.statsTitle ? resolveLabel(config.statsTitle, labelCtx) : ''}</div>
        <div>平均: ${fmt(avgValue)}</div>
        <div>最小: ${fmt(sortedAsc[0][metricKey] as number)} (${sortedAsc[0].label})</div>
        <div>最大: ${fmt(sortedDesc[0][metricKey] as number)} (${sortedDesc[0].label})</div>
      `;
    }

    if (isRulingVsOppositionMode(state.plotMode)) {
      const config = MODE_LABELS[labelCtx.mode];
      const metricMode = state.rulingMetric;
      const rows = [] as Array<ReturnType<typeof getFeatureRenderStats>>;

      for (const feature of geo?.features || []) {
        const s = getFeatureRenderStats(feature, modeCtx);
        if (metricMode === 'ratio') {
          if (typeof s.ratio === 'number' && !Number.isNaN(s.ratio)) rows.push(s);
        } else if (typeof s.gap === 'number' && !Number.isNaN(s.gap)) {
          rows.push(s);
        }
      }

      if (!rows.length) {
        return `<div class="name">${config.statsTitle ? resolveLabel(config.statsTitle, labelCtx) : ''}</div><div>データなし</div>`;
      }

      const metricKey = metricMode === 'ratio' ? 'ratio' : 'gap';
      const sortedAsc = [...rows].sort((a, b) => (a[metricKey] as number) - (b[metricKey] as number));
      const sortedDesc = [...rows].sort((a, b) => (b[metricKey] as number) - (a[metricKey] as number));
      const avgValue = rows.reduce((acc, r) => acc + (r[metricKey] as number), 0) / rows.length;
      const fmt = (v: number) => (metricMode === 'ratio' ? ratioLabel(v) : ppSignedLabel(v));

      return `
        <div class="name">${config.statsTitle ? resolveLabel(config.statsTitle, labelCtx) : ''}</div>
        <div>平均: ${fmt(avgValue)}</div>
        <div>最小: ${fmt(sortedAsc[0][metricKey] as number)} (${sortedAsc[0].label})</div>
        <div>最大: ${fmt(sortedDesc[0][metricKey] as number)} (${sortedDesc[0].label})</div>
      `;
    }

    if (isConcentrationMode(state.plotMode)) {
      const config = MODE_LABELS[labelCtx.mode];
      const rows = [] as Array<ReturnType<typeof getFeatureRenderStats>>;

      for (const feature of geo?.features || []) {
        const s = getFeatureRenderStats(feature, modeCtx);
        if (typeof s.concentration === 'number' && !Number.isNaN(s.concentration)) rows.push(s);
      }

      if (!rows.length) {
        return `<div class="name">${config.statsTitle ? resolveLabel(config.statsTitle, labelCtx) : ''}</div><div>データなし</div>`;
      }

      const avgHHI = rows.reduce((acc, r) => acc + (r.concentration as number), 0) / rows.length;
      const maxHHI = [...rows].sort((a, b) => (b.concentration as number) - (a.concentration as number))[0];
      const minHHI = [...rows].sort((a, b) => (a.concentration as number) - (b.concentration as number))[0];
      const avgEffective = avgHHI > 0 ? 1 / avgHHI : null;

      return `
        <div class="name">${config.statsTitle ? resolveLabel(config.statsTitle, labelCtx) : ''}</div>
        <div>表示単位: ${getGranularityLabel(state.granularity)}</div>
        <div>平均HHI: ${avgHHI.toFixed(3)}</div>
        <div>平均実効政党数 (1/HHI): ${avgEffective == null ? 'N/A' : avgEffective.toFixed(2)}</div>
        <div>最も集中: ${maxHHI.label} (${(maxHHI.concentration as number).toFixed(3)})</div>
        <div>最も分散: ${minHHI.label} (${(minHHI.concentration as number).toFixed(3)})</div>
      `;
    }

    if (isWinnerMarginMode(state.plotMode)) {
      const config = MODE_LABELS[labelCtx.mode];
      const rows = [] as Array<ReturnType<typeof getFeatureRenderStats>>;

      for (const feature of geo?.features || []) {
        const s = getFeatureRenderStats(feature, modeCtx);
        if (typeof s.margin === 'number' && !Number.isNaN(s.margin)) rows.push(s);
      }

      if (!rows.length) {
        return `<div class="name">${config.statsTitle ? resolveLabel(config.statsTitle, labelCtx) : ''}</div><div>データなし</div>`;
      }

      const avg = rows.reduce((acc, r) => acc + (r.margin as number), 0) / rows.length;
      const maxRow = [...rows].sort((a, b) => (b.margin as number) - (a.margin as number))[0];
      const minRow = [...rows].sort((a, b) => (a.margin as number) - (b.margin as number))[0];

      return `
        <div class="name">${config.statsTitle ? resolveLabel(config.statsTitle, labelCtx) : ''}</div>
        <div>表示単位: ${getGranularityLabel(state.granularity)}</div>
        <div>平均: ${ppLabel(avg)}</div>
        <div>最も接戦: ${minRow.label} (${ppLabel(minRow.margin as number)})</div>
        <div>最も大差: ${maxRow.label} (${ppLabel(maxRow.margin as number)})</div>
      `;
    }

    if (isNationalDivergenceMode(state.plotMode)) {
      const config = MODE_LABELS[labelCtx.mode];
      const rows = [] as Array<ReturnType<typeof getFeatureRenderStats>>;

      for (const feature of geo?.features || []) {
        const s = getFeatureRenderStats(feature, modeCtx);
        if (typeof s.nationalDivergence === 'number' && !Number.isNaN(s.nationalDivergence)) rows.push(s);
      }

      if (!rows.length) {
        return `<div class="name">${config.statsTitle ? resolveLabel(config.statsTitle, labelCtx) : ''}</div><div>データなし</div>`;
      }

      const avg = rows.reduce((acc, r) => acc + (r.nationalDivergence as number), 0) / rows.length;
      const maxRow = [...rows].sort((a, b) => (b.nationalDivergence as number) - (a.nationalDivergence as number))[0];
      const minRow = [...rows].sort((a, b) => (a.nationalDivergence as number) - (b.nationalDivergence as number))[0];

      return `
        <div class="name">${config.statsTitle ? resolveLabel(config.statsTitle, labelCtx) : ''}</div>
        <div>表示単位: ${getGranularityLabel(state.granularity)}</div>
        <div>平均: ${avg.toFixed(3)}</div>
        <div>最も全国平均から乖離: ${maxRow.label} (${(maxRow.nationalDivergence as number).toFixed(3)})</div>
        <div>最も全国平均に近い: ${minRow.label} (${(minRow.nationalDivergence as number).toFixed(3)})</div>
      `;
    }

    const summary = state.parties.find((p) => p.code === state.selectedParty);
    if (!summary) return '<div>データなし</div>';

    const rows = [] as Array<ReturnType<typeof getFeatureRenderStats>>;
    for (const feature of geo?.features || []) {
      const s = getFeatureRenderStats(feature, modeCtx);
      if (typeof s.share === 'number' && !Number.isNaN(s.share)) rows.push(s);
    }

    if (!rows.length) {
      return `
        <div class="name">${summary.name}</div>
        <div>全国得票数: ${summary.total_votes.toLocaleString()} 票</div>
        <div>市区町村数: ${summary.municipalities.toLocaleString()}</div>
        <div>データなし</div>
      `;
    }

    const sortedAsc = [...rows].sort((a, b) => (a.share as number) - (b.share as number));
    const sortedDesc = [...rows].sort((a, b) => (b.share as number) - (a.share as number));
    const avgShare = rows.reduce((acc, r) => acc + (r.share as number), 0) / rows.length;

    return `
      <div class="name">${summary.name}</div>
      <div>全国得票数: ${summary.total_votes.toLocaleString()} 票</div>
      <div>市区町村数: ${summary.municipalities.toLocaleString()}</div>
      <div>平均得票率: ${pct(avgShare)}</div>
      <div>最小得票率: ${pct(sortedAsc[0].share)} (${sortedAsc[0].label})</div>
      <div>最大得票率: ${pct(sortedDesc[0].share)} (${sortedDesc[0].label})</div>
    `;
  }, [state, geo, modeCtx, labelCtx]);

  if (mirror) {
    return <div className="stats" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <div className="stats-panel" id="statsPanel">
      <div className="block-title">統計</div>
      <div id="stats" className="stats" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
