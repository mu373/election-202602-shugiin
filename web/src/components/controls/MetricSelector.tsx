import { useElectionStore } from '../../store/electionStore';
import type { MetricMode } from '../../types';

interface MetricSelectorProps {
  kind: 'selected' | 'ruling';
}

export function MetricSelector({ kind }: MetricSelectorProps) {
  const selectedMetric = useElectionStore((s) => s.selectedMetric);
  const rulingMetric = useElectionStore((s) => s.rulingMetric);
  const setSelectedMetric = useElectionStore((s) => s.setSelectedMetric);
  const setRulingMetric = useElectionStore((s) => s.setRulingMetric);

  if (kind === 'selected') {
    return (
      <div className="control-group" id="groupSelectedMetric">
        <label htmlFor="selectedMetricSelect">指標</label>
        <select
          id="selectedMetricSelect"
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value as MetricMode)}
        >
          <option value="diff">差 (基準 - 比較)</option>
          <option value="ratio">比 (基準/比較)</option>
        </select>
      </div>
    );
  }

  return (
    <div className="control-group" id="groupRulingMetric">
      <label htmlFor="rulingMetricSelect">指標</label>
      <select
        id="rulingMetricSelect"
        value={rulingMetric}
        onChange={(e) => setRulingMetric(e.target.value as MetricMode)}
      >
        <option value="diff">差 (与党 - 野党)</option>
        <option value="ratio">比 (与党/野党)</option>
      </select>
    </div>
  );
}
