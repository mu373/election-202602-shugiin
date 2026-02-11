import { useElectionStore } from '../../store/electionStore';

interface PartySelectorProps {
  label?: string;
}

export function PartySelector({ label = '政党' }: PartySelectorProps) {
  const parties = useElectionStore((s) => s.parties);
  const selectedParty = useElectionStore((s) => s.selectedParty);
  const setSelectedParty = useElectionStore((s) => s.setSelectedParty);

  return (
    <div className="control-group" id="groupParty">
      <label htmlFor="partySelect">{label}</label>
      <select id="partySelect" value={selectedParty} onChange={(e) => setSelectedParty(e.target.value)}>
        {parties.map((p) => (
          <option key={p.code} value={p.code}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
