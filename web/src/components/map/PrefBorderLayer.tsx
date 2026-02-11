import type { GeoJSON, Renderer } from 'leaflet';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { updatePrefBorderLayer } from '../../lib/map/interactions';
import { useElectionStore } from '../../store/electionStore';

interface PrefBorderLayerProps {
  renderer: Renderer;
}

export function PrefBorderLayer({ renderer }: PrefBorderLayerProps) {
  const map = useMap();
  const layerRef = useRef<GeoJSON | null>(null);

  const granularity = useElectionStore((s) => s.granularity);
  const prefBordersVisible = useElectionStore((s) => s.prefBordersVisible);
  const prefGeo = useElectionStore((s) => s.geojsonByGranularity.pref);

  useEffect(() => {
    layerRef.current = updatePrefBorderLayer(
      map,
      layerRef.current,
      granularity,
      prefBordersVisible,
      prefGeo,
      renderer,
    );

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, granularity, prefBordersVisible, prefGeo, renderer]);

  return null;
}
