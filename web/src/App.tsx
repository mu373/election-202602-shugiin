import { useEffect, useState } from 'react';
import { ActionButtons } from './components/ActionButtons';
import { ControlPanel } from './components/ControlPanel';
import { InfoModal } from './components/InfoModal';
import { LegendPanel } from './components/LegendPanel';
import { MapView } from './components/MapView';
import { StatsPanel } from './components/StatsPanel';
import { useUrlState } from './hooks/useUrlState';
import { useElectionStore } from './store/electionStore';

function App() {
  const loadData = useElectionStore((s) => s.loadData);
  const loading = useElectionStore((s) => s.loading);
  const loaded = useElectionStore((s) => s.loaded);

  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    void loadData().catch((err: unknown) => {
      console.error(err);
      setError('データ読み込みに失敗しました。');
    });
  }, [loadData]);

  useUrlState();

  if (error) {
    return <div className="app"><div className="stats">{error}</div></div>;
  }

  if (loading && !loaded) {
    return <div className="app"><div className="stats">データを読み込み中です...</div></div>;
  }

  return (
    <div className="app">
      <ActionButtons onInfoOpen={() => setInfoOpen(true)} />

      <div className="left-column">
        <ControlPanel
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sidebarStats={<StatsPanel mirror />}
        />

        <LegendPanel onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <StatsPanel />
      </div>

      <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />
      <MapView />
    </div>
  );
}

export default App;
