import { useMemo } from 'react';
import { useElectionStore } from '../store/electionStore';

export function CompareTargetSelector() {
  const parties = useElectionStore((s) => s.parties);
  const compareTarget = useElectionStore((s) => s.compareTarget);
  const setCompareTarget = useElectionStore((s) => s.setCompareTarget);

  const values = useMemo(() => new Set(['top', ...parties.map((p) => p.code)]), [parties]);
  const current = values.has(compareTarget) ? compareTarget : 'top';

  return (
    <div className="control-group" id="groupCompareTarget">
      <label htmlFor="compareTargetSelect">比較対象</label>
      <select id="compareTargetSelect" value={current} onChange={(e) => setCompareTarget(e.target.value)}>
        <option value="top">第1党</option>
        <optgroup label="各政党">
          {parties.map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
