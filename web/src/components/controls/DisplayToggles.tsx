import { useElectionStore } from '../../store/electionStore';

interface DisplayTogglesProps {
  showPrefBorders: boolean;
}

export function DisplayToggles({ showPrefBorders }: DisplayTogglesProps) {
  const labelsVisible = useElectionStore((s) => s.labelsVisible);
  const prefBordersVisible = useElectionStore((s) => s.prefBordersVisible);
  const setLabelsVisible = useElectionStore((s) => s.setLabelsVisible);
  const setPrefBordersVisible = useElectionStore((s) => s.setPrefBordersVisible);

  return (
    <div className="toggle-group">
      <div className="control-group" id="groupLabels">
        <label className="checkbox-row" htmlFor="labelToggle">
          <input
            id="labelToggle"
            type="checkbox"
            checked={labelsVisible}
            onChange={(e) => setLabelsVisible(e.target.checked)}
          />
          地名ラベル表示
        </label>
      </div>

      {showPrefBorders ? (
        <div className="control-group" id="groupPrefBorders">
          <label className="checkbox-row" htmlFor="prefBorderToggle">
            <input
              id="prefBorderToggle"
              type="checkbox"
              checked={prefBordersVisible}
              onChange={(e) => setPrefBordersVisible(e.target.checked)}
            />
            都道府県境界を表示
          </label>
        </div>
      ) : null}
    </div>
  );
}
