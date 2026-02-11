import { useMemo } from 'react';
import { buildStatsHtml } from '../../lib/statsHtml';
import { useElectionStore } from '../../store/electionStore';

interface StatsPanelProps {
  mirror?: boolean;
}

export function StatsPanel({ mirror = false }: StatsPanelProps) {
  const state = useElectionStore((s) => s);
  const html = useMemo(() => buildStatsHtml(state), [state]);

  if (mirror) {
    return <div className="stats" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <div className="stats-panel" id="statsPanel">
      <div className="block-title">統計</div>
      <div id="stats" className="stats" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
