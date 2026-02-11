import type { Feature } from 'geojson';
import L, { type GeoJSON, type Map as LeafletMap, type TooltipOptions } from 'leaflet';

/** Returns a display label for a feature (municipality name, pref name, or block name). */
function getFeatureLabelText(feature: Feature, granularity: string, electionData: Record<string, { name?: string }>): string {
  const props = feature.properties as Record<string, unknown> | null;
  if (!props) return '';

  if (granularity === 'muni') {
    const muniCode = String(props.muni_code || '').padStart(5, '0');
    const rec = electionData[muniCode] || {};
    return `${rec.name || String(props.muni_name || '')}`.trim();
  }
  if (granularity === 'pref') return String(props.pref_name || '');
  return String(props.block_name || '');
}

/** Computes the area of a polygon ring using the shoelace formula (in coordinate units). */
function ringAreaCoords(ring: unknown): number {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const p1 = ring[i] as number[];
    const p2 = ring[(i + 1) % ring.length] as number[];
    const [lng1, lat1] = p1;
    const [lng2, lat2] = p2;
    if (
      typeof lng1 !== 'number' || typeof lat1 !== 'number' || typeof lng2 !== 'number' || typeof lat2 !== 'number'
    ) {
      return 0;
    }
    area += lng1 * lat2 - lng2 * lat1;
  }
  return Math.abs(area / 2);
}

/**
 * Finds the best anchor point for a label within a feature's geometry.
 * Prefers label_lat/label_lng properties, then picks the largest visible polygon centroid.
 */
function getLabelAnchor(map: LeafletMap, layer: L.Layer): L.LatLng {
  try {
    const anyLayer = layer as L.Layer & { feature?: Feature; getBounds?: () => L.LatLngBounds };
    const props = (anyLayer.feature?.properties || {}) as Record<string, unknown>;
    if (typeof props.label_lat === 'number' && typeof props.label_lng === 'number') {
      return L.latLng(props.label_lat, props.label_lng);
    }

    const geom = anyLayer.feature?.geometry;
    if (!geom || !('type' in geom) || !Array.isArray((geom as { coordinates?: unknown }).coordinates)) {
      return anyLayer.getBounds ? anyLayer.getBounds().getCenter() : map.getCenter();
    }

    let polygons: unknown[] = [];
    if (geom.type === 'Polygon') polygons = [(geom as { coordinates: unknown[] }).coordinates];
    else if (geom.type === 'MultiPolygon') polygons = (geom as { coordinates: unknown[] }).coordinates;
    else return anyLayer.getBounds ? anyLayer.getBounds().getCenter() : map.getCenter();

    const mapCenter = map.getCenter();
    const viewBounds = map.getBounds().pad(0.25);
    let best: { score: number; center: L.LatLng } | null = null;

    for (const poly of polygons) {
      const outerRing = Array.isArray(poly) ? poly[0] : null;
      if (!Array.isArray(outerRing) || outerRing.length < 3) continue;

      const latlngRing = outerRing
        .map((p) => (Array.isArray(p) && p.length >= 2 ? L.latLng(p[1] as number, p[0] as number) : null))
        .filter((p): p is L.LatLng => p !== null);

      if (latlngRing.length < 3) continue;
      const polyLayer = L.polygon(latlngRing);
      const center = polyLayer.getCenter();
      const area = ringAreaCoords(outerRing);
      const inView = viewBounds.contains(center);
      const dist = center.distanceTo(mapCenter);
      const score = (inView ? 1_000_000_000 : 0) - dist + (area * 1_000);

      if (!best || score > best.score) best = { score, center };
    }

    if (best?.center) return best.center;
    return anyLayer.getBounds ? anyLayer.getBounds().getCenter() : map.getCenter();
  } catch {
    const anyLayer = layer as L.Layer & { getBounds?: () => L.LatLngBounds };
    return anyLayer.getBounds ? anyLayer.getBounds().getCenter() : map.getCenter();
  }
}

/**
 * Shows or hides permanent text labels on the map, selecting the largest visible
 * features up to a zoom-dependent maximum count.
 */
export function updateLabels(
  map: LeafletMap,
  geoLayer: GeoJSON | null,
  granularity: string,
  labelsVisible: boolean,
  electionData: Record<string, { name?: string }>,
): void {
  if (!geoLayer) return;

  const zoom = map.getZoom();
  const policy = (() => {
    if (granularity === 'block') return { minZoom: 4, maxLabels: 30 };
    if (granularity === 'pref') return { minZoom: 5, maxLabels: 47 };
    if (zoom >= 11) return { minZoom: 11, maxLabels: 300 };
    if (zoom >= 10) return { minZoom: 10, maxLabels: 180 };
    if (zoom >= 9) return { minZoom: 9, maxLabels: 90 };
    return { minZoom: 99, maxLabels: 0 };
  })();

  const clearAll = () => {
    geoLayer.eachLayer((layer) => {
      const l = layer as L.Layer & { getTooltip?: () => L.Tooltip | undefined; unbindTooltip?: () => void };
      if (l.getTooltip?.()) l.unbindTooltip?.();
    });
  };

  if (!labelsVisible || zoom < policy.minZoom) {
    clearAll();
    return;
  }

  const viewBounds = map.getBounds().pad(0.15);
  const candidates: Array<{ layer: L.Layer; areaWeight: number }> = [];
  const anchorByLayer = new globalThis.Map<L.Layer, L.LatLng>();

  geoLayer.eachLayer((layer) => {
    const anyLayer = layer as L.Layer & { feature?: Feature; getBounds?: () => L.LatLngBounds; getTooltip?: () => L.Tooltip | undefined; unbindTooltip?: () => void };
    if (!anyLayer.feature || !anyLayer.getBounds) return;

    const anchor = getLabelAnchor(map, layer);
    anchorByLayer.set(layer, anchor);
    if (!anchor || !viewBounds.contains(anchor)) {
      if (anyLayer.getTooltip?.()) anyLayer.unbindTooltip?.();
      return;
    }

    const b = anyLayer.getBounds();
    const props = anyLayer.feature.properties as Record<string, unknown>;
    const areaWeight = Number.isFinite(props.main_area_km2)
      ? Number(props.main_area_km2)
      : (Number.isFinite(props.area_km2)
        ? Number(props.area_km2)
        : Math.abs((b.getEast() - b.getWest()) * (b.getNorth() - b.getSouth())));

    candidates.push({ layer, areaWeight });
  });

  candidates.sort((a, b) => b.areaWeight - a.areaWeight);
  const selected = new Set(candidates.slice(0, policy.maxLabels).map((x) => x.layer));

  geoLayer.eachLayer((layer) => {
    const anyLayer = layer as L.Layer & {
      feature?: Feature;
      getTooltip?: () => L.Tooltip | undefined;
      unbindTooltip?: () => void;
      bindTooltip?: (content: string, opts: TooltipOptions) => void;
      openTooltip?: (latlng?: L.LatLng) => void;
    };

    if (!selected.has(layer)) {
      if (anyLayer.getTooltip?.()) anyLayer.unbindTooltip?.();
      return;
    }

    if (!anyLayer.feature) return;

    const label = getFeatureLabelText(anyLayer.feature, granularity, electionData);
    if (!label) return;

    const anchor = anchorByLayer.get(layer) || getLabelAnchor(map, layer);
    const existing = anyLayer.getTooltip?.();

    if (!existing || existing.getContent() !== label) {
      if (existing) anyLayer.unbindTooltip?.();
      anyLayer.bindTooltip?.(label, {
        permanent: true,
        direction: 'center',
        className: 'map-label',
        opacity: 0.95,
      });
      anyLayer.openTooltip?.(anchor);
    } else if (anchor) {
      anyLayer.openTooltip?.(anchor);
    }
  });
}
