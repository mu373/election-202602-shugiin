import type { Feature } from 'geojson';
import L, { type GeoJSON, type LeafletMouseEvent, type Map as LeafletMap } from 'leaflet';
import { getModeHandler } from '../modes/registry';
import type { ElectionGeoJson, PlotMode } from '../../types';
import { buildPopupHtml } from './popup';
import type { MapRenderContext } from './featureStyle';

/** Attaches hover-highlight and click-popup handlers to a GeoJSON feature layer. */
export function bindFeatureInteractions(
  layer: L.Layer,
  feature: Feature,
  getCtx: () => MapRenderContext,
  getGeoLayer: () => GeoJSON | null,
): void {
  if (!('on' in layer)) return;
  const pathLayer = layer as L.Path;

  pathLayer.on({
    mouseover: (e: LeafletMouseEvent) => {
      const target = e.target as L.Path;
      target.setStyle({ weight: 1.3, color: '#1f2937' });
      if ('bringToFront' in target) target.bringToFront();
    },
    mouseout: (e: LeafletMouseEvent) => {
      const geoLayer = getGeoLayer();
      if (!geoLayer) return;
      geoLayer.resetStyle(e.target as L.Path);
    },
    click: (e: LeafletMouseEvent) => {
      const popup = buildPopupHtml(feature, getCtx());
      (e.target as L.Layer).bindPopup(popup).openPopup();
    },
  });
}

/** Replaces (or removes) the prefecture-border overlay layer on the map. */
export function updatePrefBorderLayer(
  map: LeafletMap,
  currentLayer: GeoJSON | null,
  granularity: string,
  visible: boolean,
  prefGeo: ElectionGeoJson | null,
  renderer: L.Renderer,
): GeoJSON | null {
  if (currentLayer) {
    map.removeLayer(currentLayer);
  }

  if (granularity !== 'muni' || !visible || !prefGeo) return null;

  return L.geoJSON(prefGeo, ({
    renderer,
    interactive: false,
    style: {
      fill: false,
      stroke: true,
      color: '#1f2937',
      weight: 1.0,
      opacity: 0.9,
    },
  } as unknown as L.GeoJSONOptions)).addTo(map);
}

/** Returns true if the given mode requires a party selector in the control panel. */
export function modeNeedsPartySelector(mode: PlotMode): boolean {
  return getModeHandler(mode).controls.showPartySelector;
}
