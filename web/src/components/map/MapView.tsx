import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import { GeoJsonLayer } from './GeoJsonLayer';
import { LabelsManager } from './LabelsManager';
import { PrefBorderLayer } from './PrefBorderLayer';

function AttributionPrefixDisabler() {
  const map = useMap();

  useEffect(() => {
    map.attributionControl.setPrefix(false);
    map.attributionControl.setPosition('bottomleft');
  }, [map]);

  return null;
}

export function MapView() {
  const renderer = useMemo(() => L.canvas({ padding: 0.5, pane: 'geoPane' }), []);

  return (
    <MapContainer center={[36.5, 138]} zoom={8} preferCanvas zoomControl={false} id="map">
      <ZoomControl position="topright" />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        subdomains="abcd"
        maxZoom={18}
      />
      <AttributionPrefixDisabler />
      <GeoJsonLayer renderer={renderer} />
      <PrefBorderLayer renderer={renderer} />
      <LabelsManager />
    </MapContainer>
  );
}
