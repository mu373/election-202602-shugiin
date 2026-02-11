import { useElectionStore } from '../../store/electionStore';
import type { ScaleMode } from '../../types';

export function ScaleModeSelector() {
  const scaleMode = useElectionStore((s) => s.scaleMode);
  const setScaleMode = useElectionStore((s) => s.setScaleMode);

  return (
    <div className="control-group" id="groupScaleMode">
      <label htmlFor="scaleMode">色スケール</label>
      <select id="scaleMode" value={scaleMode} onChange={(e) => setScaleMode(e.target.value as ScaleMode)}>
        <option value="fixed">固定スケール</option>
        <option value="party">政党別スケール</option>
      </select>
    </div>
  );
}
