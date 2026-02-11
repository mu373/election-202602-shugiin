import type { ReactNode } from 'react';
import { MODE_LABELS, buildLabelContext, resolveLabel } from '../lib/modeLabels';
import {
  isAnyRankMode,
  isConcentrationMode,
  isNationalDivergenceMode,
  isRankMode,
  isRulingVsOppositionMode,
  isSelectedVsTopMode,
  isWinnerMarginMode,
} from '../lib/modes';
import { useElectionStore } from '../store/electionStore';
import { CompareTargetSelector } from './CompareTargetSelector';
import { DisplayToggles } from './DisplayToggles';
import { GranularitySelector } from './GranularitySelector';
import { MetricSelector } from './MetricSelector';
import { ModeSelector } from './ModeSelector';
import { PartySelector } from './PartySelector';
import { RankSelector } from './RankSelector';
import { ScaleModeSelector } from './ScaleModeSelector';

interface ControlPanelProps {
  open: boolean;
  onClose: () => void;
  sidebarStats?: ReactNode;
}

export function ControlPanel({ open, onClose, sidebarStats }: ControlPanelProps) {
  const plotMode = useElectionStore((s) => s.plotMode);
  const granularity = useElectionStore((s) => s.granularity);
  const selectedMetric = useElectionStore((s) => s.selectedMetric);
  const rulingMetric = useElectionStore((s) => s.rulingMetric);
  const parties = useElectionStore((s) => s.parties);
  const selectedParty = useElectionStore((s) => s.selectedParty);
  const compareTarget = useElectionStore((s) => s.compareTarget);
  const rank = useElectionStore((s) => s.rank);
  const partyNameByCode = useElectionStore((s) => s.partyNameByCode);

  const isRank = isRankMode(plotMode);
  const isSelectedVsTop = isSelectedVsTopMode(plotMode);
  const isRulingVsOpposition = isRulingVsOppositionMode(plotMode);
  const isConcentration = isConcentrationMode(plotMode);
  const isWinnerMargin = isWinnerMarginMode(plotMode);
  const isNationalDivergence = isNationalDivergenceMode(plotMode);

  const showModeHelp = isAnyRankMode(plotMode)
    || isSelectedVsTop
    || isRulingVsOpposition
    || isConcentration
    || isWinnerMargin
    || isNationalDivergence;

  const labelCtx = buildLabelContext({
    plotMode,
    selectedParty,
    compareTarget,
    selectedMetric,
    rulingMetric,
    rank,
    partyNameByCode,
    parties,
  });
  const config = MODE_LABELS[labelCtx.mode];

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <button className="sidebar-close" id="sidebarClose" type="button" aria-label="設定を閉じる" onClick={onClose}>
        ✕ 閉じる
      </button>

      <h1 id="titleMain"><span className="title-chunk">第51回衆議院議員選挙</span> <span className="title-chunk">比例区得票マップ</span></h1>

      <ModeSelector />

      {showModeHelp && config.modeHelp ? (
        <div id="modeHelp" className="help" dangerouslySetInnerHTML={config.modeHelpIsHtml
          ? { __html: resolveLabel(config.modeHelp, labelCtx) }
          : undefined}
        >
          {!config.modeHelpIsHtml ? resolveLabel(config.modeHelp, labelCtx) : undefined}
        </div>
      ) : (
        <div id="modeHelp" className="help hidden" />
      )}

      <GranularitySelector />

      {!(isRank || isConcentration || isWinnerMargin || isRulingVsOpposition || isNationalDivergence) ? (
        <PartySelector label={isSelectedVsTop ? '基準政党' : '政党'} />
      ) : null}

      {isSelectedVsTop ? <CompareTargetSelector /> : null}

      {isSelectedVsTop ? (
        <>
          <MetricSelector kind="selected" />
          <div id="selectedMetricHelp" className="help">
            {selectedMetric === 'ratio'
              ? '基準政党と比較対象の得票数の比率（基準/比較）を表示します。1.00が拮抗、1より大きいほど基準政党優勢、1より小さいほど基準政党劣勢です。'
              : '基準政党と比較対象の得票率の差（基準 - 比較）を表示します。0.0 ptは拮抗、正の値は基準政党優勢、負の値は基準政党劣勢を示します。'}
          </div>
        </>
      ) : (
        <div id="selectedMetricHelp" className="help hidden" />
      )}

      {isRulingVsOpposition ? (
        <>
          <MetricSelector kind="ruling" />
          <div id="rulingMetricHelp" className="help">
            {rulingMetric === 'ratio'
              ? '与党と野党の得票数の比率（与党/野党）を表示します。1.00が拮抗、1より大きいほど与党優勢、1より小さいほど野党優勢です。'
              : '与党と野党の得票率の差（与党 - 野党）を表示します。0.0 ptは拮抗、正の値は与党優勢、負の値は野党優勢を示します。'}
          </div>
        </>
      ) : (
        <div id="rulingMetricHelp" className="help hidden" />
      )}

      {plotMode === 'share' ? (
        <>
          <ScaleModeSelector />
          <div id="scaleHelp" className="help">固定: 政党間で同じ基準。<br />政党別: 選択中政党内で濃淡を見やすく調整。</div>
        </>
      ) : (
        <div id="scaleHelp" className="help hidden" />
      )}

      {isRank ? <RankSelector /> : null}

      <div className="block-title display-settings-title">表示設定</div>
      <DisplayToggles showPrefBorders={granularity === 'muni'} />

      <div className="sidebar-stats" id="sidebarStats">
        <div className="block-title">統計</div>
        <div id="statsMirror" className="stats">{sidebarStats}</div>
      </div>
    </aside>
  );
}
