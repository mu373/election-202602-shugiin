import { useElectionStore } from '../store/electionStore';
import type { PlotMode } from '../types';

const OPTIONS: Array<{ value: PlotMode; label: string }> = [
  { value: 'share', label: '政党得票率' },
  { value: 'party_rank', label: '選択政党の順位' },
  { value: 'rank', label: '得票率第N位の政党' },
  { value: 'opposition_rank', label: '野党第N党' },
  { value: 'selected_diff', label: '二つの政党の比較' },
  { value: 'ruling_vs_opposition', label: '与野党比較' },
  { value: 'winner_margin', label: '上位2党の得票率差（接戦度）' },
  { value: 'concentration', label: '票の集中度' },
  { value: 'js_divergence', label: '全国平均からの乖離度' },
];

export function ModeSelector() {
  const plotMode = useElectionStore((s) => s.plotMode);
  const setPlotMode = useElectionStore((s) => s.setPlotMode);

  return (
    <div className="control-group" id="groupPlotMode">
      <label htmlFor="plotModeSelect">表示モード</label>
      <select id="plotModeSelect" value={plotMode} onChange={(e) => setPlotMode(e.target.value as PlotMode)}>
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
