import { MODE_TEXT_BY_VALUE } from '../../lib/modes/labels';
import { useElectionStore } from '../../store/electionStore';
import { PLOT_MODES, type PlotMode } from '../../types';

const OPTIONS = PLOT_MODES.map((value) => ({ value, label: MODE_TEXT_BY_VALUE[value] }));

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
