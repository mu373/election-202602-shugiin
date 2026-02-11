import { useElectionStore } from '../../store/electionStore';
import type { Granularity } from '../../types';

export function GranularitySelector() {
  const granularity = useElectionStore((s) => s.granularity);
  const setGranularity = useElectionStore((s) => s.setGranularity);

  return (
    <div className="control-group" id="groupGranularity">
      <label htmlFor="granularitySelect">表示単位</label>
      <select
        id="granularitySelect"
        value={granularity}
        onChange={(e) => setGranularity(e.target.value as Granularity)}
      >
        <option value="block">ブロック</option>
        <option value="pref">都道府県</option>
        <option value="muni">市区町村</option>
      </select>
    </div>
  );
}
