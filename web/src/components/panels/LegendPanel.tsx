import { useMemo } from 'react';
import {
  NODATA_COLOR,
  SELECTED_VS_TOP_BETTER_COLORS,
  SELECTED_VS_TOP_DIVERGING_COLORS,
  SELECTED_VS_TOP_WORSE_COLORS,
  SHARE_COLORS,
} from '../../lib/constants';
import { partyColor } from '../../lib/data';
import { ppLabel, pctLabel, ratioLabel } from '../../lib/format';
import { getModeHandler } from '../../lib/modes/registry';
import { buildLabelContext, resolveLabel } from '../../lib/modes/labelUtils';
import { getFeatureRenderStats, getPartyRankColor } from '../../lib/modes/rendering';
import { getRankedPartiesForFeature } from '../../lib/data';
import { useElectionStore } from '../../store/electionStore';
import type { ModeContext } from '../../types';

interface LegendPanelProps {
  onToggleSidebar: () => void;
}

/** Renders the map legend panel with mode-specific color scales and labels. */
export function LegendPanel({ onToggleSidebar }: LegendPanelProps) {
  const state = useElectionStore((s) => s);
  const geo = state.geojsonByGranularity[state.granularity];
  const modeCtx: ModeContext = useMemo(() => ({
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
  }), [state]);

  const handler = getModeHandler(state.plotMode);
  const { labels } = handler;

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

  const legendTitle = labels.legendSectionTitle ? resolveLabel(labels.legendSectionTitle, labelCtx) : '凡例（得票率）';
  const modeLabel = labels.modeHeading ? resolveLabel(labels.modeHeading, labelCtx) : labelCtx.modeText;
  const modeDesc = labels.modeSummary ? resolveLabel(labels.modeSummary, labelCtx) : '';

  const isRankMode = state.plotMode === 'rank' || state.plotMode === 'opposition_rank';
  const isPartyRankMode = state.plotMode === 'party_rank';
  const isDiffMode = state.plotMode === 'selected_diff' || state.plotMode === 'ruling_vs_opposition';
  const isRatio = (state.plotMode === 'ruling_vs_opposition' && state.rulingMetric === 'ratio')
    || (state.plotMode === 'selected_diff' && state.selectedMetric === 'ratio');
  const isSigned = isDiffMode && !isRatio;

  const content = useMemo(() => {
    if (isPartyRankMode) {
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

    if (isRankMode) {
      const excludedCode = state.plotMode === 'opposition_rank' ? 'jimin' : null;
      const counts: Record<string, number> = {};
      for (const feature of geo?.features || []) {
        const ranked = getRankedPartiesForFeature(feature, excludedCode, modeCtx);
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

    // Gradient-based modes
    const legendPalette = (() => {
      if (!(isDiffMode || isRatio)) return SHARE_COLORS;
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

    const isSequentialMode = state.plotMode === 'concentration'
      || state.plotMode === 'winner_margin'
      || state.plotMode === 'js_divergence';

    const midLabel = isSequentialMode
      ? (state.plotMode === 'winner_margin' ? ppLabel(state.activeMax / 2) : (state.activeMax / 2).toFixed(3))
      : (isRatio ? ratioLabel(ratioMid) : (isSigned ? ppLabel(selectedMid) : pctLabel(state.activeMax / 2)));

    const leftLabel = isSequentialMode
      ? (state.plotMode === 'winner_margin' ? ppLabel(0) : '0.000')
      : (isRatio ? ratioLabel(ratioLeft) : (isSigned ? ppLabel(state.activeMin) : '0 %'));

    const rightLabel = isSequentialMode
      ? (state.plotMode === 'winner_margin' ? ppLabel(state.activeMax) : state.activeMax.toFixed(3))
      : (isRatio ? ratioLabel(ratioRight) : (isSigned ? ppLabel(state.activeMax) : pctLabel(state.activeMax)));

    const lowSideLabel = ('lowSideLabel' in labels && labels.lowSideLabel)
      ? resolveLabel(labels.lowSideLabel, labelCtx)
      : '';
    const highSideLabel = ('highSideLabel' in labels && labels.highSideLabel)
      ? resolveLabel(labels.highSideLabel, labelCtx)
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
            <span>{lowSideLabel}</span>
            <span>{isRatio ? '拮抗 (1.00)' : '拮抗'}</span>
            <span>{highSideLabel}</span>
          </div>
        ) : null}
        <div className="legend-row">
          <span className="legend-swatch" style={{ background: NODATA_COLOR }} />データなし
        </div>
      </>
    );
  }, [state, geo, modeCtx, labels, labelCtx, isRankMode, isPartyRankMode, isDiffMode, isRatio, isSigned]);

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
