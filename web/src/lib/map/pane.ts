import type { Map as LeafletMap } from 'leaflet';

/** Creates the 'geoPane' map pane if it doesn't exist and sets its blend mode to multiply. */
export function ensureGeoPane(map: LeafletMap): void {
  let pane = map.getPane('geoPane');
  if (!pane) {
    pane = map.createPane('geoPane');
    pane.style.zIndex = '410';
  }
  pane.style.mixBlendMode = 'multiply';
}

/** Updates the geoPane's CSS mix-blend-mode to multiply (idempotent). */
export function updateGeoPaneBlendMode(map: LeafletMap): void {
  const pane = map.getPane('geoPane');
  if (!pane) return;
  pane.style.mixBlendMode = 'multiply';
}
