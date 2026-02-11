import { useElectionStore } from '../../store/electionStore';

export function RankSelector() {
  const rank = useElectionStore((s) => s.rank);
  const parties = useElectionStore((s) => s.parties);
  const setRank = useElectionStore((s) => s.setRank);

  return (
    <div className="control-group" id="groupRank">
      <label htmlFor="rankSelect">順位（N）</label>
      <select
        id="rankSelect"
        value={String(rank)}
        onChange={(e) => setRank(Number.parseInt(e.target.value, 10) || 1)}
      >
        {Array.from({ length: Math.max(parties.length, 1) }, (_, i) => i + 1).map((r) => (
          <option key={r} value={String(r)}>{`第${r}位`}</option>
        ))}
      </select>
    </div>
  );
}
