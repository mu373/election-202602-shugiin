import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { updateLabels } from '../lib/mapHelpers';
import { useElectionStore } from '../store/electionStore';

export function LabelsManager() {
  const map = useMap();
  const labelsVisible = useElectionStore((s) => s.labelsVisible);
  const granularity = useElectionStore((s) => s.granularity);
  const electionData = useElectionStore((s) => s.electionData);
  const geoLayer = useElectionStore((s) => s.geoLayer);

  useEffect(() => {
    const handler = () => {
      updateLabels(map, useElectionStore.getState().geoLayer, granularity, labelsVisible, electionData);
    };

    map.on('zoomend', handler);
    map.on('moveend', handler);
    handler();

    return () => {
      map.off('zoomend', handler);
      map.off('moveend', handler);
    };
  }, [map, granularity, labelsVisible, electionData, geoLayer]);

  return null;
}
