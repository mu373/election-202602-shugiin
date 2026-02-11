import { useMemo } from 'react';
import {
  NODATA_COLOR,
  SELECTED_VS_TOP_BETTER_COLORS,
  SELECTED_VS_TOP_DIVERGING_COLORS,
  SELECTED_VS_TOP_WORSE_COLORS,
  SHARE_COLORS,
} from '../lib/constants';
import { partyColor } from '../lib/data';
import { ppLabel, pctLabel, ratioLabel } from '../lib/format';
import { MODE_LABELS, buildLabelContext, resolveLabel } from '../lib/modeLabels';
import {
  getFeatureRenderStats,
  getPartyRankColor,
  isConcentrationMode,
  isNationalDivergenceMode,
  isPartyRankMode,
  isRankMode,
  isRulingRatioMode,
  isSelectedRatioMode,
  isSignedDiffMode,
} from '../lib/modes';
import { getRankedPartiesForFeature } from '../lib/data';
import { useElectionStore } from '../store/electionStore';
import type { ModeContext } from '../types';

interface LegendPanelProps {
  onToggleSidebar: () => void;
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

export function LegendPanel({ onToggleSidebar }: LegendPanelProps) {
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

  const config = MODE_LABELS[labelCtx.mode];
  const legendTitle = config.legendTitle ? resolveLabel(config.legendTitle, labelCtx) : '凡例（得票率）';
  const modeLabel = config.legendHeader ? resolveLabel(config.legendHeader, labelCtx) : labelCtx.modeText;
  const modeDesc = config.description ? resolveLabel(config.description, labelCtx) : '';

  const content = useMemo(() => {
    if (isPartyRankMode(state.plotMode)) {
      const counts: Record<number, number> = {};
      for (const feature of geo?.features || []) {
        const stats = getFeatureRenderStats(feature, modeCtx);
        if (stats.rank != null) counts[stats.rank] = (counts[stats.rank] || 0) + 1;
      }

      const maxRankInData = Math.max(0, ...Object.keys(counts).map((r) => Number.parseInt(r, 10)));
      const legendMaxRank = Math.min(maxRankInData || 0, 10);

      if (!legendMaxRank) {
        return (
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: NODATA_COLOR }} />データなし
          </div>
        );
      }

      return (
        <>
          {Array.from({ length: legendMaxRank }, (_, idx) => idx + 1).map((rank) => (
            <div className="legend-row" key={rank}>
              <span className="legend-swatch" style={{ background: getPartyRankColor(rank, state.activePartyRankMax) }} />
              第{rank}位 ({(counts[rank] || 0).toLocaleString()})
            </div>
          ))}
          {maxRankInData > legendMaxRank ? (
            <div className="legend-row">
              <span className="legend-swatch" style={{ background: getPartyRankColor(legendMaxRank + 1, state.activePartyRankMax) }} />
              第{legendMaxRank + 1}位以下 ({Object.entries(counts)
                .filter(([rank]) => Number.parseInt(rank, 10) > legendMaxRank)
                .reduce((acc, [, count]) => acc + count, 0)
                .toLocaleString()})
            </div>
          ) : null}
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: NODATA_COLOR }} />データなし
          </div>
        </>
      );
    }

    if (isRankMode(state.plotMode)) {
      const counts: Record<string, number> = {};
      for (const feature of geo?.features || []) {
        const ranked = getRankedPartiesForFeature(feature, state.plotMode === 'opposition_rank' ? 'jimin' : null, modeCtx);
        const p = ranked[state.rank - 1];
        if (p) counts[p.code] = (counts[p.code] || 0) + 1;
      }

      const rankedParties = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
      return (
        <>
          {rankedParties.map(([code, nAreas]) => (
            <div className="legend-row" key={code}>
              <span className="legend-swatch" style={{ background: partyColor(code, state.partyColorByCode) }} />
              {state.partyNameByCode[code] || code} ({nAreas})
            </div>
          ))}
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: NODATA_COLOR }} />データなし
          </div>
        </>
      );
    }

    const legendPalette = (() => {
      if (isConcentrationMode(state.plotMode) || state.plotMode === 'winner_margin' || isNationalDivergenceMode(state.plotMode)) return SHARE_COLORS;
      if (!(isSignedDiffMode(state.plotMode, state.selectedMetric, state.rulingMetric)
        || isRulingRatioMode(state.plotMode, state.rulingMetric)
        || isSelectedRatioMode(state.plotMode, state.selectedMetric))) {
        return SHARE_COLORS;
      }
      if (state.activeCrossesZero) return SELECTED_VS_TOP_DIVERGING_COLORS;
      if (state.activeMin >= 0) return SELECTED_VS_TOP_BETTER_COLORS;
      return SELECTED_VS_TOP_WORSE_COLORS;
    })();

    const gradientStops = legendPalette
      .map((c, i) => `${c} ${(i / (legendPalette.length - 1)) * 100}%`)
      .join(', ');

    const selectedMid = state.activeCrossesZero ? 0 : (state.activeMin + ((state.activeMax - state.activeMin) / 2));
    const ratioMid = Math.exp(selectedMid);
    const ratioLeft = Math.exp(state.activeMin);
    const ratioRight = Math.exp(state.activeMax);

    const isRatio = isRulingRatioMode(state.plotMode, state.rulingMetric)
      || isSelectedRatioMode(state.plotMode, state.selectedMetric);

    const isSigned = isSignedDiffMode(state.plotMode, state.selectedMetric, state.rulingMetric);

    const midLabel = isConcentrationMode(state.plotMode)
      ? (state.activeMax / 2).toFixed(3)
      : (state.plotMode === 'winner_margin'
        ? ppLabel(state.activeMax / 2)
        : (isNationalDivergenceMode(state.plotMode)
          ? (state.activeMax / 2).toFixed(3)
          : (isRatio ? ratioLabel(ratioMid) : (isSigned ? ppLabel(selectedMid) : pctLabel(state.activeMax / 2)))));

    const leftLabel = isConcentrationMode(state.plotMode)
      ? '0.000'
      : (state.plotMode === 'winner_margin'
        ? ppLabel(0)
        : (isNationalDivergenceMode(state.plotMode)
          ? '0.000'
          : (isRatio ? ratioLabel(ratioLeft) : (isSigned ? ppLabel(state.activeMin) : '0 %'))));

    const rightLabel = isConcentrationMode(state.plotMode)
      ? state.activeMax.toFixed(3)
      : (state.plotMode === 'winner_margin'
        ? ppLabel(state.activeMax)
        : (isNationalDivergenceMode(state.plotMode)
          ? state.activeMax.toFixed(3)
          : (isRatio ? ratioLabel(ratioRight) : (isSigned ? ppLabel(state.activeMax) : pctLabel(state.activeMax)))));

    const semanticLeft = ('semanticLeft' in config && config.semanticLeft)
      ? resolveLabel(config.semanticLeft, labelCtx)
      : '';
    const semanticRight = ('semanticRight' in config && config.semanticRight)
      ? resolveLabel(config.semanticRight, labelCtx)
      : '';

    return (
      <>
        <div className="legend-gradient" style={{ background: `linear-gradient(to right, ${gradientStops})` }} />
        <div className="legend-axis">
          <span>{leftLabel}</span>
          <span>{midLabel}</span>
          <span>{rightLabel}</span>
        </div>
        {isSigned || isRatio ? (
          <div className="legend-axis">
            <span>{semanticLeft}</span>
            <span>{isRatio ? '拮抗 (1.00)' : '拮抗'}</span>
            <span>{semanticRight}</span>
          </div>
        ) : null}
        <div className="legend-row">
          <span className="legend-swatch" style={{ background: NODATA_COLOR }} />データなし
        </div>
      </>
    );
  }, [state, geo, modeCtx, config, labelCtx]);

  return (
    <div className="legend-panel" id="legendPanel">
      <div className="legend-panel-title"><span className="title-chunk">第51回衆院選</span> <span className="title-chunk">比例区得票マップ</span></div>
      <div className="legend-mode-label" id="legendModeLabel">{modeLabel}</div>
      <div className="legend-mode-desc" id="legendModeDesc">{modeDesc}</div>
      <div className="block-title" id="legendTitle">{legendTitle}</div>
      <div id="legend">{content}</div>

      <button className="sidebar-toggle" id="sidebarToggle" type="button" aria-expanded="false" aria-label="設定パネルを開閉" onClick={onToggleSidebar}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  );
}
