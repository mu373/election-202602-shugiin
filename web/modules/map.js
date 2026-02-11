import { state } from "./state.js";
import { granularitySelect, plotModeSelect, partySelect } from "./dom.js";
import {
  NODATA_COLOR,
  SHARE_COLORS,
  SELECTED_VS_TOP_BETTER_COLORS,
  SELECTED_VS_TOP_WORSE_COLORS,
  SELECTED_VS_TOP_DIVERGING_COLORS,
  CONCENTRATION_CONTRAST_GAMMA,
} from "./constants.js";
import { clamp01, skewRight, interpolateFromPalette, getColorFromPalette } from "./colors.js";
import { partyColor, getRankedPartiesForFeature } from "./data.js";
import {
  isRankMode,
  isPartyRankMode,
  isSelectedVsTopMode,
  isRulingVsOppositionMode,
  isConcentrationMode,
  isNationalDivergenceMode,
  isSignedDiffMode,
  isRulingRatioMode,
  isSelectedRatioMode,
  getPartyRankColor,
  getFeatureRenderStats,
  buildPartyRankPopupRows,
} from "./modes.js";
import { pct, ppSignedLabel, ratioLabel } from "./format.js";

// Leaflet globals — L is loaded as a regular <script> before this module.
export let leafletMap = null;
let canvasRenderer = null;

export function initMap() {
  canvasRenderer = L.canvas({ padding: 0.5, pane: "geoPane" });
  leafletMap = L.map("map", {
    preferCanvas: true,
    renderer: canvasRenderer,
    zoomControl: false,
  }).setView([36.5, 138], 8);
  leafletMap.attributionControl.setPrefix(false);
  L.control.zoom({ position: "topright" }).addTo(leafletMap);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: "abcd",
    maxZoom: 18,
  }).addTo(leafletMap);
}

export function ensureGeoPane() {
  let pane = leafletMap.getPane("geoPane");
  if (!pane) {
    pane = leafletMap.createPane("geoPane");
    pane.style.zIndex = "410";
  }
  pane.style.mixBlendMode = "multiply";
}

export function updateGeoPaneBlendMode() {
  const pane = leafletMap.getPane("geoPane");
  if (!pane) return;
  pane.style.mixBlendMode = "multiply";
}

export function featureStyle(feature) {
  const stats = getFeatureRenderStats(feature);
  let fillColor;
  if (isRankMode()) {
    fillColor = stats.partyCode ? partyColor(stats.partyCode) : NODATA_COLOR;
  } else if (isPartyRankMode()) {
    fillColor = getPartyRankColor(stats.rank);
  } else if (isConcentrationMode() || isNationalDivergenceMode()) {
    fillColor = getColorFromPalette(stats.share, state.activeMax, SHARE_COLORS, CONCENTRATION_CONTRAST_GAMMA);
  } else if (isSignedDiffMode() || isRulingRatioMode() || isSelectedRatioMode()) {
    if (stats.share == null || Number.isNaN(stats.share)) {
      fillColor = NODATA_COLOR;
    } else if (state.activeCrossesZero) {
      const maxAbs = Math.max(Math.abs(state.activeMin), Math.abs(state.activeMax), 0.01);
      const t = clamp01((stats.share / maxAbs + 1) / 2);
      fillColor = interpolateFromPalette(SELECTED_VS_TOP_DIVERGING_COLORS, t);
    } else {
      const clippedGap = Math.max(state.activeMin, Math.min(state.activeMax, stats.share));
      const range = Math.max(state.activeMax - state.activeMin, 0.01);
      if (state.activeMin >= 0) {
        const tBetter = clamp01((clippedGap - state.activeMin) / range);
        fillColor = interpolateFromPalette(SELECTED_VS_TOP_BETTER_COLORS, skewRight(tBetter));
      } else {
        const tWorse = clamp01((state.activeMax - clippedGap) / range);
        fillColor = interpolateFromPalette(SELECTED_VS_TOP_WORSE_COLORS, skewRight(tWorse));
      }
    }
  } else {
    fillColor = getColorFromPalette(stats.share, state.activeMax, SHARE_COLORS, CONCENTRATION_CONTRAST_GAMMA);
  }
  return {
    fillColor,
    weight: 0.4,
    color: "#626b75",
    opacity: 1,
    fillOpacity: isRankMode() ? 0.55 : 0.8,
  };
}

function formatPartyVotes(share, validVotes) {
  if (
    typeof share !== "number" ||
    Number.isNaN(share) ||
    typeof validVotes !== "number" ||
    Number.isNaN(validVotes)
  ) {
    return "N/A";
  }
  return Math.round(share * validVotes).toLocaleString();
}

function onEachFeature(feature, layer) {
  layer.on({
    mouseover: (e) => {
      e.target.setStyle({ weight: 1.3, color: "#1f2937" });
      e.target.bringToFront();
    },
    mouseout: (e) => {
      state.geoLayer.resetStyle(e.target);
    },
    click: (e) => {
      const stats = getFeatureRenderStats(feature);
      let popup;
      if (isRankMode()) {
        const isOppositionRankMode = plotModeSelect.value === "opposition_rank";
        const rankLabel = stats.actualRank != null ? `第${stats.actualRank}位` : "N/A";
        const conditionLabel = isOppositionRankMode ? `野党第${stats.rank}党` : null;
        const allRanksHtml = buildPartyRankPopupRows(feature, stats.partyCode);
        popup = `
          <strong>${stats.label}</strong><br>
          順位: ${rankLabel}<br>
          ${conditionLabel ? `表示条件: ${conditionLabel}<br>` : ""}
          政党: ${stats.partyName || "N/A"}<br>
          得票率: ${pct(stats.share)}<br>
          得票数: ${formatPartyVotes(stats.share, stats.validVotes)} 票<br>
          地域の有効投票総数: ${(stats.validVotes ?? "N/A").toLocaleString?.() || stats.validVotes || "N/A"}<br>
          <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
          ${allRanksHtml}
        `;
      } else if (isPartyRankMode()) {
        const selectedCode = partySelect.value;
        const allRanksHtml = buildPartyRankPopupRows(feature, selectedCode);
        popup = `
          <strong>${stats.label}</strong><br>
          政党: ${stats.partyName || "N/A"}<br>
          順位: ${stats.rank != null ? `第${stats.rank}位` : "N/A"}<br>
          得票率: ${pct(stats.share)}<br>
          得票数: ${formatPartyVotes(stats.share, stats.validVotes)} 票<br>
          地域の有効投票総数: ${(stats.validVotes ?? "N/A").toLocaleString?.() || stats.validVotes || "N/A"}<br>
          <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
          ${allRanksHtml}
        `;
      } else if (isSelectedVsTopMode()) {
        const targetLabel = stats.compareTargetLabel || "第1党";
        const diffText = stats.metricMode === "ratio"
          ? ratioLabel(stats.ratio)
          : ppSignedLabel(stats.gap);
        const summaryLabel = stats.metricMode === "ratio" ? "比" : "差";
        const allRanksHtml = buildPartyRankPopupRows(feature, partySelect.value, stats.targetPartyCode);
        popup = `
          <strong>${stats.label}</strong><br>
          <strong>${stats.partyName || "N/A"}</strong>と<strong>${targetLabel}</strong>の${summaryLabel}: ${diffText}<br>
          地域の有効投票総数: ${(stats.validVotes ?? "N/A").toLocaleString?.() || stats.validVotes || "N/A"}<br>
          <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
          ${allRanksHtml}
        `;
      } else if (isRulingVsOppositionMode()) {
        const diffText = stats.metricMode === "ratio"
          ? ratioLabel(stats.ratio)
          : ppSignedLabel(stats.gap);
        const diffLabel = stats.metricMode === "ratio"
          ? "与党（自民・維新）/野党（それ以外）"
          : "与党と野党の差";
        const allRanksHtml = buildPartyRankPopupRows(feature, null, null);
        popup = `
          <strong>${stats.label}</strong><br>
          <strong>${diffLabel}</strong>: ${diffText}<br>
          地域の有効投票総数: ${(stats.validVotes ?? "N/A").toLocaleString?.() || stats.validVotes || "N/A"}<br>
          <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
          ${allRanksHtml}
        `;
      } else if (isConcentrationMode()) {
        const allRanksHtml = buildPartyRankPopupRows(feature, null, null);
        popup = `
          <strong>${stats.label}</strong><br>
          ハーフィンダール・ハーシュマン指数 (HHI): ${stats.concentration == null ? "N/A" : stats.concentration.toFixed(3)}<br>
          実効政党数 (1/HHI): ${
            stats.effectivePartyCount == null ? "N/A" : stats.effectivePartyCount.toFixed(2)
          }<br>
          地域の有効投票総数: ${(stats.validVotes ?? "N/A").toLocaleString?.() || stats.validVotes || "N/A"}<br>
          <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
          ${allRanksHtml}
        `;
      } else if (isNationalDivergenceMode()) {
        const allRanksHtml = buildPartyRankPopupRows(feature, null, null);
        popup = `
          <strong>${stats.label}</strong><br>
          全国平均からの乖離度（Jensen-Shannon距離）: ${stats.nationalDivergence == null ? "N/A" : stats.nationalDivergence.toFixed(3)}<br>
          地域の有効投票総数: ${(stats.validVotes ?? "N/A").toLocaleString?.() || stats.validVotes || "N/A"}<br>
          <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
          ${allRanksHtml}
        `;
      } else {
        const selectedCode = partySelect.value;
        const allRanksHtml = buildPartyRankPopupRows(feature, selectedCode);
        popup = `
          <strong>${stats.label}</strong><br>
          政党: ${stats.partyName || "N/A"}<br>
          得票率: ${pct(stats.share)}<br>
          得票数: ${formatPartyVotes(stats.share, stats.validVotes)} 票<br>
          地域の有効投票総数: ${(stats.validVotes ?? "N/A").toLocaleString?.() || stats.validVotes || "N/A"}<br>
          <hr style="border:none;border-top:1px solid #d1d5db;margin:6px 0;">
          ${allRanksHtml}
        `;
      }
      e.target.bindPopup(popup).openPopup();
    },
  });
}

export function renderGeoLayer() {
  const granularity = granularitySelect.value;
  const geo = state.geojsonByGranularity[granularity];
  if (!geo) return;
  if (state.geoLayer) {
    leafletMap.removeLayer(state.geoLayer);
  }
  state.geoLayer = L.geoJSON(geo, {
    renderer: canvasRenderer,
    style: featureStyle,
    onEachFeature,
  }).addTo(leafletMap);
  updatePrefBorderOverlay(granularity);
  state.currentGranularity = granularity;
  updateLabels();
}

export function updatePrefBorderOverlay(granularity) {
  if (state.prefBorderLayer) {
    leafletMap.removeLayer(state.prefBorderLayer);
    state.prefBorderLayer = null;
  }
  if (granularity !== "muni" || !state.prefBordersVisible) return;
  const prefGeo = state.geojsonByGranularity.pref;
  if (!prefGeo) return;
  state.prefBorderLayer = L.geoJSON(prefGeo, {
    renderer: canvasRenderer,
    interactive: false,
    style: {
      fill: false,
      stroke: true,
      color: "#1f2937",
      weight: 1.0,
      opacity: 0.9,
    },
  }).addTo(leafletMap);
}

function getFeatureLabelText(feature) {
  const granularity = granularitySelect.value;
  if (granularity === "muni") {
    const muniCode = String(feature.properties.muni_code || "").padStart(5, "0");
    const rec = state.electionData[muniCode] || {};
    return `${rec.name || feature.properties.muni_name || ""}`.trim();
  }
  if (granularity === "pref") {
    return feature.properties.pref_name || "";
  }
  return feature.properties.block_name || "";
}

function ringAreaCoords(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % ring.length];
    const lng1 = p1[0];
    const lat1 = p1[1];
    const lng2 = p2[0];
    const lat2 = p2[1];
    if (
      typeof lng1 !== "number" || typeof lat1 !== "number" ||
      typeof lng2 !== "number" || typeof lat2 !== "number"
    ) {
      return 0;
    }
    area += (lng1 * lat2) - (lng2 * lat1);
  }
  return Math.abs(area / 2);
}

function getLabelAnchor(layer) {
  try {
    const props = layer?.feature?.properties || {};
    if (
      typeof props.label_lat === "number" &&
      typeof props.label_lng === "number"
    ) {
      return L.latLng(props.label_lat, props.label_lng);
    }

    const geom = layer?.feature?.geometry;
    if (!geom || !geom.type || !Array.isArray(geom.coordinates)) {
      return layer.getBounds().getCenter();
    }

    let polygons = [];
    if (geom.type === "Polygon") {
      polygons = [geom.coordinates];
    } else if (geom.type === "MultiPolygon") {
      polygons = geom.coordinates;
    } else {
      return layer.getBounds().getCenter();
    }

    const mapCenter = leafletMap.getCenter();
    const viewBounds = leafletMap.getBounds().pad(0.25);
    let best = null;
    for (const poly of polygons) {
      const outerRing = Array.isArray(poly) ? poly[0] : null;
      if (!outerRing || outerRing.length < 3) continue;
      const latlngRing = outerRing
        .map((p) => Array.isArray(p) && p.length >= 2 ? L.latLng(p[1], p[0]) : null)
        .filter((p) => p !== null);
      if (latlngRing.length < 3) continue;
      const polyLayer = L.polygon(latlngRing);
      const center = polyLayer.getCenter();
      const area = ringAreaCoords(outerRing);
      const inView = viewBounds.contains(center);
      const dist = center.distanceTo(mapCenter);
      const score = (inView ? 1_000_000_000 : 0) - dist + (area * 1_000);
      if (!best || score > best.score) {
        best = { score, center };
      }
    }

    if (best && best.center) {
      return best.center;
    }
    return layer.getBounds().getCenter();
  } catch (_err) {
    return layer.getBounds().getCenter();
  }
}

export function updateLabels() {
  if (!state.geoLayer) return;
  const granularity = granularitySelect.value;
  const zoom = leafletMap.getZoom();

  const policy = (() => {
    if (granularity === "block") return { minZoom: 4, maxLabels: 30 };
    if (granularity === "pref") return { minZoom: 5, maxLabels: 47 };
    if (zoom >= 11) return { minZoom: 11, maxLabels: 300 };
    if (zoom >= 10) return { minZoom: 10, maxLabels: 180 };
    if (zoom >= 9) return { minZoom: 9, maxLabels: 90 };
    return { minZoom: 99, maxLabels: 0 };
  })();

  const clearAll = () => {
    state.geoLayer.eachLayer((layer) => {
      if (layer.getTooltip()) layer.unbindTooltip();
    });
  };

  if (!state.labelsVisible || zoom < policy.minZoom) {
    clearAll();
    return;
  }

  const viewBounds = leafletMap.getBounds().pad(0.15);
  const candidates = [];
  const anchorByLayer = new Map();
  state.geoLayer.eachLayer((layer) => {
    if (!layer.feature || !layer.getBounds) return;
    const anchor = getLabelAnchor(layer);
    anchorByLayer.set(layer, anchor);
    const b = layer.getBounds();
    if (!anchor || !viewBounds.contains(anchor)) {
      if (layer.getTooltip()) layer.unbindTooltip();
      return;
    }
    const props = layer.feature?.properties || {};
    const areaWeight = Number.isFinite(props.main_area_km2)
      ? Number(props.main_area_km2)
      : (Number.isFinite(props.area_km2)
          ? Number(props.area_km2)
          : Math.abs((b.getEast() - b.getWest()) * (b.getNorth() - b.getSouth())));
    candidates.push({ layer, areaWeight });
  });

  candidates.sort((a, b) => b.areaWeight - a.areaWeight);
  const selected = new Set(candidates.slice(0, policy.maxLabels).map((x) => x.layer));

  state.geoLayer.eachLayer((layer) => {
    if (!selected.has(layer)) {
      if (layer.getTooltip()) layer.unbindTooltip();
      return;
    }
    const label = getFeatureLabelText(layer.feature);
    if (!label) return;
    const anchor = anchorByLayer.get(layer) || getLabelAnchor(layer);
    const existing = layer.getTooltip();
    if (!existing || existing.getContent() !== label) {
      if (existing) layer.unbindTooltip();
      layer.bindTooltip(label, {
        permanent: true,
        direction: "center",
        className: "map-label",
        opacity: 0.95,
      });
      layer.openTooltip(anchor);
    } else if (anchor) {
      layer.openTooltip(anchor);
    }
  });
}
