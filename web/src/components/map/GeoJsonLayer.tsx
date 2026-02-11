import type { Feature } from 'geojson';
import L, { type GeoJSON, type Renderer } from 'leaflet';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { ensureGeoPane, updateGeoPaneBlendMode } from '../../lib/map/pane';
import { featureStyle, type MapRenderContext } from '../../lib/map/featureStyle';
import { bindFeatureInteractions } from '../../lib/map/interactions';
import { useElectionStore } from '../../store/electionStore';

interface GeoJsonLayerProps {
  renderer: Renderer;
}

/** Builds a MapRenderContext snapshot from the current store state. */
function renderContextFromStore(state: ReturnType<typeof useElectionStore.getState>): MapRenderContext {
  return {
    plotMode: state.plotMode,
    granularity: state.granularity,
    selectedParty: state.selectedParty,
    compareTarget: state.compareTarget,
    selectedMetric: state.selectedMetric,
    rulingMetric: state.rulingMetric,
    rank: state.rank,
    electionData: state.electionData,
    prefAgg: state.prefAgg,
    blockAgg: state.blockAgg,
    parties: state.parties,
    partyNameByCode: state.partyNameByCode,
    activePartyRankMax: state.activePartyRankMax,
    colorMap: state.partyColorByCode,
    activeMax: state.activeMax,
    activeMin: state.activeMin,
    activeCrossesZero: state.activeCrossesZero,
    labelsVisible: state.labelsVisible,
  };
}

/** Manages the main GeoJSON choropleth layer on the Leaflet map. */
export function GeoJsonLayer({ renderer }: GeoJsonLayerProps) {
  const map = useMap();
  const layerRef = useRef<GeoJSON | null>(null);

  const granularity = useElectionStore((s) => s.granularity);
  const geojsonByGranularity = useElectionStore((s) => s.geojsonByGranularity);
  const setGeoLayer = useElectionStore((s) => s.setGeoLayer);
  const activeMax = useElectionStore((s) => s.activeMax);
  const activeMin = useElectionStore((s) => s.activeMin);
  const activeCrossesZero = useElectionStore((s) => s.activeCrossesZero);
  const activePartyRankMax = useElectionStore((s) => s.activePartyRankMax);
  const plotMode = useElectionStore((s) => s.plotMode);
  const selectedParty = useElectionStore((s) => s.selectedParty);
  const compareTarget = useElectionStore((s) => s.compareTarget);
  const selectedMetric = useElectionStore((s) => s.selectedMetric);
  const rulingMetric = useElectionStore((s) => s.rulingMetric);
  const rank = useElectionStore((s) => s.rank);
  const partyColorByCode = useElectionStore((s) => s.partyColorByCode);

  useEffect(() => {
    ensureGeoPane(map);
    updateGeoPaneBlendMode(map);
  }, [map]);

  useEffect(() => {
    const geo = geojsonByGranularity[granularity];
    if (!geo) return;

    if (layerRef.current) map.removeLayer(layerRef.current);

    const getCtx = () => renderContextFromStore(useElectionStore.getState());

    const layer = L.geoJSON(geo, ({
      renderer,
      style: (feature: Feature) => featureStyle(feature, getCtx()),
      onEachFeature: (feature: Feature, leafletLayer: L.Layer) => {
        bindFeatureInteractions(
          leafletLayer,
          feature as Feature,
          getCtx,
          () => useElectionStore.getState().geoLayer,
        );
      },
    } as unknown as L.GeoJSONOptions)).addTo(map);

    layerRef.current = layer;
    setGeoLayer(layer);

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      setGeoLayer(null);
    };
  }, [map, renderer, granularity, geojsonByGranularity, setGeoLayer]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const ctx = renderContextFromStore(useElectionStore.getState());
    layer.setStyle((feature) => featureStyle(feature as Feature, ctx));
    updateGeoPaneBlendMode(map);
  }, [
    map,
    activeMax,
    activeMin,
    activeCrossesZero,
    activePartyRankMax,
    plotMode,
    selectedParty,
    compareTarget,
    selectedMetric,
    rulingMetric,
    rank,
    partyColorByCode,
  ]);

  return null;
}
