import type { Feature } from 'geojson';
import L, { type GeoJSON, type LeafletMouseEvent, type Map as LeafletMap, type PathOptions, type TooltipOptions } from 'leaflet';
import {
  CONCENTRATION_CONTRAST_GAMMA,
  NODATA_COLOR,
  SELECTED_VS_TOP_BETTER_COLORS,
  SELECTED_VS_TOP_DIVERGING_COLORS,
  SELECTED_VS_TOP_WORSE_COLORS,
  SHARE_COLORS,
} from './constants';
import { clamp01, getColorFromPalette, interpolateFromPalette, skewRight } from './colors';
import { partyColor } from './data';
import { ppLabel, ppSignedLabel, pct, ratioLabel } from './format';
import {
  buildPartyRankPopupRows,
  getFeatureRenderStats,
  getPartyRankColor,
  isConcentrationMode,
  isNationalDivergenceMode,
  isPartyRankMode,
  isRankMode,
  isRulingRatioMode,
  isRulingVsOppositionMode,
  isSelectedRatioMode,
  isSelectedVsTopMode,
  isSignedDiffMode,
  isWinnerMarginMode,
} from './modes';
import { buildLabelContext, MODE_LABELS, resolveLabel } from './modeLabels';
import type { ElectionGeoJson, ModeContext, PlotMode } from '../types';

export interface MapRenderContext extends ModeContext {
  colorMap: Record<string, string>;
  activeMax: number;
  activeMin: number;
  activeCrossesZero: boolean;
  activePartyRankMax: number;
  labelsVisible: boolean;
}

export function ensureGeoPane(map: LeafletMap): void {
  let pane = map.getPane('geoPane');
  if (!pane) {
    pane = map.createPane('geoPane');
    pane.style.zIndex = '410';
  }
  pane.style.mixBlendMode = 'multiply';
}

export function updateGeoPaneBlendMode(map: LeafletMap): void {
  const pane = map.getPane('geoPane');
  if (!pane) return;
  pane.style.mixBlendMode = 'multiply';
}

export function featureStyle(feature: Feature, ctx: MapRenderContext): PathOptions {
  const stats = getFeatureRenderStats(feature, ctx);
  let fillColor: string;

  if (isRankMode(ctx.plotMode)) {
    fillColor = stats.partyCode ? partyColor(stats.partyCode, ctx.colorMap) : NODATA_COLOR;
  } else if (isPartyRankMode(ctx.plotMode)) {
    fillColor = getPartyRankColor(stats.rank, ctx.activePartyRankMax);
  } else if (
    isConcentrationMode(ctx.plotMode)
    || isWinnerMarginMode(ctx.plotMode)
    || isNationalDivergenceMode(ctx.plotMode)
  ) {
    fillColor = getColorFromPalette(
      stats.share,
      ctx.activeMax,
      SHARE_COLORS,
      CONCENTRATION_CONTRAST_GAMMA,
    );
  } else if (
    isSignedDiffMode(ctx.plotMode, ctx.selectedMetric, ctx.rulingMetric)
    || isRulingRatioMode(ctx.plotMode, ctx.rulingMetric)
    || isSelectedRatioMode(ctx.plotMode, ctx.selectedMetric)
  ) {
    if (stats.share == null || Number.isNaN(stats.share)) {
      fillColor = NODATA_COLOR;
    } else if (ctx.activeCrossesZero) {
      const maxAbs = Math.max(Math.abs(ctx.activeMin), Math.abs(ctx.activeMax), 0.01);
      const t = clamp01((stats.share / maxAbs + 1) / 2);
      fillColor = interpolateFromPalette(SELECTED_VS_TOP_DIVERGING_COLORS, t);
    } else {
      const clippedGap = Math.max(ctx.activeMin, Math.min(ctx.activeMax, stats.share));
      const range = Math.max(ctx.activeMax - ctx.activeMin, 0.01);
      if (ctx.activeMin >= 0) {
        const tBetter = clamp01((clippedGap - ctx.activeMin) / range);
        fillColor = interpolateFromPalette(SELECTED_VS_TOP_BETTER_COLORS, skewRight(tBetter));
      } else {
        const tWorse = clamp01((ctx.activeMax - clippedGap) / range);
        fillColor = interpolateFromPalette(SELECTED_VS_TOP_WORSE_COLORS, skewRight(tWorse));
      }
    }
  } else {
    fillColor = getColorFromPalette(stats.share, ctx.activeMax, SHARE_COLORS, CONCENTRATION_CONTRAST_GAMMA);
  }

  return {
    fillColor,
    weight: 0.4,
    color: '#626b75',
    opacity: 1,
    fillOpacity: isRankMode(ctx.plotMode) ? 0.55 : 0.8,
  };
}

function formatPartyVotes(share: number | null | undefined, validVotes: number | null | undefined): string {
  if (
    typeof share !== 'number'
    || Number.isNaN(share)
    || typeof validVotes !== 'number'
    || Number.isNaN(validVotes)
  ) {
    return 'N/A';
  }
  return Math.round(share * validVotes).toLocaleString();
}

function labelStateFromMap(ctx: MapRenderContext) {
  return {
    plotMode: ctx.plotMode,
    selectedParty: ctx.selectedParty,
    compareTarget: ctx.compareTarget,
    selectedMetric: ctx.selectedMetric,
    rulingMetric: ctx.rulingMetric,
    rank: ctx.rank,
    partyNameByCode: ctx.partyNameByCode,
    parties: ctx.parties,
  };
}

export function buildPopupHtml(feature: Feature, ctx: MapRenderContext): string {
  const stats = getFeatureRenderStats(feature, ctx);
  const validVotesText =
    typeof stats.validVotes === 'number' ? stats.validVotes.toLocaleString() : 'N/A';

  if (isRankMode(ctx.plotMode)) {
    const isOppositionRankMode = ctx.plotMode === 'opposition_rank';
    const rankLabel = stats.actualRank != null ? `第${stats.actualRank}位` : 'N/A';
    const conditionLabel = isOppositionRankMode ? `野党第${ctx.rank}党` : null;
    const allRanksHtml = buildPartyRankPopupRows(
      feature,
      stats.partyCode ?? null,
      null,
      ctx.partyNameByCode,
      ctx.plotMode,
      ctx,
    );

    return `
      <strong>${stats.label}</strong><br>
      順位: ${rankLabel}<br>
      ${conditionLabel ? `表示条件: ${conditionLabel}<br>` : ''}
      政党: ${stats.partyName || 'N/A'}<br>
      得票率: ${pct(stats.share)}<br>
      得票数: ${formatPartyVotes(stats.share, stats.validVotes)} 票<br>
      地域の有効投票総数: ${validVotesText}<br>
      <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
      ${allRanksHtml}
    `;
  }

  if (isPartyRankMode(ctx.plotMode)) {
    const allRanksHtml = buildPartyRankPopupRows(
      feature,
      ctx.selectedParty,
      null,
      ctx.partyNameByCode,
      ctx.plotMode,
      ctx,
    );

    return `
      <strong>${stats.label}</strong><br>
      政党: ${stats.partyName || 'N/A'}<br>
      順位: ${stats.rank != null ? `第${stats.rank}位` : 'N/A'}<br>
      得票率: ${pct(stats.share)}<br>
      得票数: ${formatPartyVotes(stats.share, stats.validVotes)} 票<br>
      地域の有効投票総数: ${validVotesText}<br>
      <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
      ${allRanksHtml}
    `;
  }

  if (isSelectedVsTopMode(ctx.plotMode)) {
    const diffText = stats.metricMode === 'ratio' ? ratioLabel(stats.ratio) : ppSignedLabel(stats.gap);
    const summaryLabel = stats.metricMode === 'ratio' ? '比' : '差';
    const allRanksHtml = buildPartyRankPopupRows(
      feature,
      ctx.selectedParty,
      stats.targetPartyCode ?? null,
      ctx.partyNameByCode,
      ctx.plotMode,
      ctx,
    );

    return `
      <strong>${stats.label}</strong><br>
      <strong>${stats.partyName || 'N/A'}</strong>と<strong>${stats.compareTargetLabel || '第1党'}</strong>の${summaryLabel}: ${diffText}<br>
      地域の有効投票総数: ${validVotesText}<br>
      <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
      ${allRanksHtml}
    `;
  }

  if (isRulingVsOppositionMode(ctx.plotMode)) {
    const labelCtx = buildLabelContext(labelStateFromMap(ctx));
    const config = MODE_LABELS[labelCtx.mode];
    const diffText = stats.metricMode === 'ratio' ? ratioLabel(stats.ratio) : ppSignedLabel(stats.gap);
    const diffLabel = config.popupMetricLabel ? resolveLabel(config.popupMetricLabel, labelCtx) : '';
    const allRanksHtml = buildPartyRankPopupRows(feature, null, null, ctx.partyNameByCode, ctx.plotMode, ctx);

    return `
      <strong>${stats.label}</strong><br>
      <strong>${diffLabel}</strong>: ${diffText}<br>
      地域の有効投票総数: ${validVotesText}<br>
      <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
      ${allRanksHtml}
    `;
  }

  if (isConcentrationMode(ctx.plotMode)) {
    const labelCtx = buildLabelContext(labelStateFromMap(ctx));
    const config = MODE_LABELS[labelCtx.mode];
    const allRanksHtml = buildPartyRankPopupRows(feature, null, null, ctx.partyNameByCode, ctx.plotMode, ctx);

    return `
      <strong>${stats.label}</strong><br>
      ${config.popupMetricLabel ? resolveLabel(config.popupMetricLabel, labelCtx) : 'HHI'}: ${stats.concentration == null ? 'N/A' : stats.concentration.toFixed(3)}<br>
      実効政党数 (1/HHI): ${stats.effectivePartyCount == null ? 'N/A' : stats.effectivePartyCount.toFixed(2)}<br>
      地域の有効投票総数: ${validVotesText}<br>
      <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
      ${allRanksHtml}
    `;
  }

  if (isWinnerMarginMode(ctx.plotMode)) {
    const labelCtx = buildLabelContext(labelStateFromMap(ctx));
    const config = MODE_LABELS[labelCtx.mode];
    const allRanksHtml = buildPartyRankPopupRows(feature, null, null, ctx.partyNameByCode, ctx.plotMode, ctx);

    return `
      <strong>${stats.label}</strong><br>
      ${config.popupMetricLabel ? resolveLabel(config.popupMetricLabel, labelCtx) : '上位2党の得票率差'}: ${stats.margin == null ? 'N/A' : ppLabel(stats.margin)}<br>
      1位: ${stats.winnerPartyName || 'N/A'}（${pct(stats.winnerShare)}）<br>
      2位: ${stats.runnerUpPartyName || 'N/A'}（${pct(stats.runnerUpShare)}）<br>
      地域の有効投票総数: ${validVotesText}<br>
      <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
      ${allRanksHtml}
    `;
  }

  if (isNationalDivergenceMode(ctx.plotMode)) {
    const labelCtx = buildLabelContext(labelStateFromMap(ctx));
    const config = MODE_LABELS[labelCtx.mode];
    const allRanksHtml = buildPartyRankPopupRows(feature, null, null, ctx.partyNameByCode, ctx.plotMode, ctx);

    return `
      <strong>${stats.label}</strong><br>
      ${config.popupMetricLabel ? resolveLabel(config.popupMetricLabel, labelCtx) : '全国平均からの乖離度'}: ${stats.nationalDivergence == null ? 'N/A' : stats.nationalDivergence.toFixed(3)}<br>
      地域の有効投票総数: ${validVotesText}<br>
      <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
      ${allRanksHtml}
    `;
  }

  const allRanksHtml = buildPartyRankPopupRows(
    feature,
    ctx.selectedParty,
    null,
    ctx.partyNameByCode,
    ctx.plotMode,
    ctx,
  );

  return `
    <strong>${stats.label}</strong><br>
    政党: ${stats.partyName || 'N/A'}<br>
    得票率: ${pct(stats.share)}<br>
    得票数: ${formatPartyVotes(stats.share, stats.validVotes)} 票<br>
    地域の有効投票総数: ${validVotesText}<br>
    <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
    ${allRanksHtml}
  `;
}

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

export function modeNeedsPartySelector(mode: PlotMode): boolean {
  return !(isRankMode(mode) || isConcentrationMode(mode) || isWinnerMarginMode(mode) || isRulingVsOppositionMode(mode) || isNationalDivergenceMode(mode));
}
