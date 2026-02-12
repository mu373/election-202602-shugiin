import { state } from "./modules/state.js";
import { initDomRefs, plotModeSelect, partySelect, scaleModeSelect, granularitySelect, compareTargetSelect, selectedMetricSelect, rulingMetricSelect, rankSelect, labelToggle, prefBorderToggle, statsEl, sidebarToggle, sidebar, legendPanel, sidebarClose, legendModeLabel, legendModeDesc } from "./modules/dom.js";
import { SELECTED_DIFF_DEFAULT_BASE, SELECTED_DIFF_DEFAULT_TARGET } from "./modules/constants.js";
import { quantile } from "./modules/colors.js";
import { buildPartyColorMap, buildAggregates } from "./modules/data.js";
import { initInfoModalControls } from "./modules/modal.js";
import { populatePartySelect, populateCompareTargetSelect, populateRankSelect, updateControlVisibility, readStateFromUrl, writeStateToUrl } from "./modules/controls.js";
import { updateLegend } from "./modules/legend.js";
import { updateStats } from "./modules/stats.js";
import { initMap, leafletMap, ensureGeoPane, updateGeoPaneBlendMode, renderGeoLayer, updatePrefBorderOverlay, updateLabels, featureStyle } from "./modules/map.js";
import {
  isSelectedVsTopMode,
  isRulingVsOppositionMode,
  isConcentrationMode,
  getCompareTargetMode,
  getSelectedMetricMode,
  getRulingMetricMode,
  computeActivePartyRankMax,
  computeActiveScale,
  getSelectedVsTopValuesForCurrentGranularity,
  getRulingOppositionValuesForCurrentGranularity,
  getFeatureRenderStats,
} from "./modules/modes.js";
import { MODE_LABELS, buildLabelContext, resolveLabel } from "./modules/mode-labels.js";
const DATA_FILE_NAMES = [
  "municipalities.geojson",
  "prefectures.geojson",
  "blocks.geojson",
  "election_data.json",
  "parties.json",
];
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/mu373/election-202602-shugiin/main/web/public/data";
const LOCAL_DATA_BASE = "./data";

function getConfiguredDataSourceMode() {
  const mode = import.meta.env.VITE_DATA_SOURCE_MODE;
  if (mode === "local" || mode === "remote") return mode;
  return null;
}

function getDataUrlOrder(fileName) {
  const localUrl = `${LOCAL_DATA_BASE}/${fileName}`;
  const remoteUrl = `${GITHUB_RAW_BASE}/${fileName}`;
  const mode = getConfiguredDataSourceMode() || "remote";
  return mode === "local" ? [localUrl] : [remoteUrl, localUrl];
}

function initShareXButton() {
  const shareXButton = document.getElementById("shareXButton");
  if (!shareXButton) return;
  shareXButton.addEventListener("click", () => {
    const panelTitle = "第51回衆院選 比例区得票マップ";
    const modeLabel = (legendModeLabel?.textContent || "").trim();
    const text = modeLabel ? `${panelTitle} | ${modeLabel}` : panelTitle;
    const url = new URL(window.location.href);
    const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url.toString())}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  });
}

function updateModeLabel() {
  const ctx = buildLabelContext();
  const config = MODE_LABELS[ctx.mode];
  if (!config) {
    legendModeLabel.textContent = ctx.modeText;
    legendModeDesc.textContent = "";
    return;
  }
  legendModeLabel.textContent = resolveLabel(config.legendHeader, ctx);
  legendModeDesc.textContent = resolveLabel(config.description, ctx);
}

function recolor() {
  if (!state.geoLayer) return;
  computeActivePartyRankMax();
  if (plotModeSelect.value === "share") {
    computeActiveScale();
    state.activeMin = 0;
    state.activeCrossesZero = false;
  } else if (isSelectedVsTopMode()) {
    const selectedCode = partySelect.value;
    const compareTargetMode = getCompareTargetMode();
    const metricMode = getSelectedMetricMode();
    const values = getSelectedVsTopValuesForCurrentGranularity(selectedCode, compareTargetMode, metricMode).sort((a, b) => a - b);
    if (!values.length) {
      state.activeMin = -0.01;
      state.activeMax = 0.01;
      state.activeCrossesZero = true;
    } else {
      const q05 = quantile(values, 0.05);
      const q95 = quantile(values, 0.95);
      const maxAbs = Math.max(Math.abs(q05), Math.abs(q95), 0.01);
      state.activeMin = -maxAbs;
      state.activeMax = maxAbs;
      state.activeCrossesZero = true;
    }
  } else if (isRulingVsOppositionMode()) {
    const metricMode = getRulingMetricMode();
    const values = getRulingOppositionValuesForCurrentGranularity(metricMode).sort((a, b) => a - b);
    if (!values.length) {
      state.activeMin = -0.01;
      state.activeMax = 0.01;
      state.activeCrossesZero = true;
    } else {
      const q05 = quantile(values, 0.05);
      const q95 = quantile(values, 0.95);
      const maxAbs = Math.max(Math.abs(q05), Math.abs(q95), 0.01);
      state.activeMin = -maxAbs;
      state.activeMax = maxAbs;
      state.activeCrossesZero = true;
    }
  } else if (isConcentrationMode()) {
    state.activeMin = 0;
    state.activeCrossesZero = false;
    const geo = state.geojsonByGranularity[granularitySelect.value];
    const values = [];
    for (const feature of geo?.features || []) {
      const stats = getFeatureRenderStats(feature);
      if (typeof stats.share === "number" && !Number.isNaN(stats.share)) {
        values.push(stats.share);
      }
    }
    values.sort((a, b) => a - b);
    const q95 = quantile(values, 0.95);
    state.activeMax = q95 > 0 ? q95 : 1;
  } else if (plotModeSelect.value === "winner_margin") {
    state.activeMin = 0;
    state.activeCrossesZero = false;
    const geo = state.geojsonByGranularity[granularitySelect.value];
    const values = [];
    for (const feature of geo?.features || []) {
      const stats = getFeatureRenderStats(feature);
      if (typeof stats.margin === "number" && !Number.isNaN(stats.margin)) {
        values.push(stats.margin);
      }
    }
    values.sort((a, b) => a - b);
    const q95 = quantile(values, 0.95);
    state.activeMax = q95 > 0 ? q95 : 1;
  } else if (plotModeSelect.value === "js_divergence") {
    state.activeMin = 0;
    state.activeCrossesZero = false;
    const geo = state.geojsonByGranularity[granularitySelect.value];
    const values = [];
    for (const feature of geo?.features || []) {
      const stats = getFeatureRenderStats(feature);
      if (typeof stats.share === "number" && !Number.isNaN(stats.share)) {
        values.push(stats.share);
      }
    }
    values.sort((a, b) => a - b);
    const q95 = quantile(values, 0.95);
    state.activeMax = q95 > 0 ? q95 : 1;
  }
  updateModeLabel();
  updateLegend();
  state.geoLayer.setStyle(featureStyle);
  updateLabels();
  updateStats();
}

function handleControlChange() {
  const currentMode = plotModeSelect.value;
  const modeChanged = state.lastPlotMode !== null && state.lastPlotMode !== currentMode;
  if (modeChanged && currentMode === "share") {
    if (state.parties.some((p) => p.code === "mirai")) {
      partySelect.value = "mirai";
    }
    scaleModeSelect.value = "party";
  }
  if (modeChanged && currentMode === "selected_diff") {
    if (state.parties.some((p) => p.code === SELECTED_DIFF_DEFAULT_BASE)) {
      partySelect.value = SELECTED_DIFF_DEFAULT_BASE;
    }
    if (state.parties.some((p) => p.code === SELECTED_DIFF_DEFAULT_TARGET)) {
      compareTargetSelect.value = SELECTED_DIFF_DEFAULT_TARGET;
    }
  }
  if (modeChanged && currentMode === "party_rank") {
    if (state.parties.some((p) => p.code === "mirai")) {
      partySelect.value = "mirai";
    }
  }

  state.labelsVisible = labelToggle.checked;
  state.prefBordersVisible = prefBorderToggle.checked;
  updateGeoPaneBlendMode();
  if (state.geoLayer && granularitySelect.value !== state.currentGranularity) {
    renderGeoLayer();
  }
  updatePrefBorderOverlay(granularitySelect.value);
  updateControlVisibility();
  writeStateToUrl();
  recolor();
  state.lastPlotMode = currentMode;
}

async function init() {
  initDomRefs();
  initShareXButton();
  initMap();

  async function loadDataWithFallback(fileName) {
    const urls = getDataUrlOrder(fileName);
    let lastError = null;
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        return await res.json();
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(`Failed to load ${fileName}: ${lastError?.message || "unknown error"}`);
  }

  const [
    muniGeojson,
    prefGeojson,
    blockGeojson,
    election,
    partyList,
  ] = await Promise.all(DATA_FILE_NAMES.map((fileName) => loadDataWithFallback(fileName)));

  state.geojsonByGranularity = {
    muni: muniGeojson,
    pref: prefGeojson,
    block: blockGeojson,
  };
  state.electionData = election;
  state.parties = partyList;
  state.partyNameByCode = Object.fromEntries(partyList.map((p) => [p.code, p.name]));
  buildPartyColorMap();
  for (const f of prefGeojson.features || []) {
    if (f?.properties?.pref_name && f?.properties?.block_name) {
      state.prefToBlock[f.properties.pref_name] = f.properties.block_name;
    }
  }
  buildAggregates();
  ensureGeoPane();
  initInfoModalControls();
  populatePartySelect();
  populateCompareTargetSelect();
  populateRankSelect();
  readStateFromUrl();
  updateGeoPaneBlendMode();
  state.lastPlotMode = plotModeSelect.value;
  updateControlVisibility();
  renderGeoLayer();

  partySelect.addEventListener("change", handleControlChange);
  scaleModeSelect.addEventListener("change", handleControlChange);
  granularitySelect.addEventListener("change", handleControlChange);
  plotModeSelect.addEventListener("change", handleControlChange);
  compareTargetSelect.addEventListener("change", handleControlChange);
  selectedMetricSelect.addEventListener("change", handleControlChange);
  rulingMetricSelect.addEventListener("change", handleControlChange);
  rankSelect.addEventListener("change", handleControlChange);
  labelToggle.addEventListener("change", handleControlChange);
  prefBorderToggle.addEventListener("change", handleControlChange);
  function toggleSidebar() {
    const open = sidebar.classList.toggle("open");
    sidebarToggle.setAttribute("aria-expanded", String(open));
  }
  sidebarToggle.addEventListener("click", toggleSidebar);
  sidebarClose.addEventListener("click", () => {
    sidebar.classList.remove("open");
    sidebarToggle.setAttribute("aria-expanded", "false");
  });
  leafletMap.on("zoomend", updateLabels);
  leafletMap.on("moveend", updateLabels);
  writeStateToUrl();
  recolor();
}

init().catch((err) => {
  console.error(err);
  const el = document.getElementById("stats");
  if (el) el.innerHTML = "データ読み込みに失敗しました。";
});
