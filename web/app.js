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

const MODE_DESCRIPTIONS = {
  share: "各政党の得票率を色の濃淡で表示",
  party_rank: "選択した政党の順位を地域ごとに色分け",
  rank: "各地域で第N位の政党を色分け",
  opposition_rank: "自民党を除いた第N位の政党を色分け",
  selected_diff: "二つの政党の得票率の差・比を比較",
  ruling_vs_opposition: "与党（自民+維新）と野党（その他）の得票率を比較",
  concentration: "値が高いほど一党集中、低いほど多党分散",
};

function updateModeLabel() {
  const mode = plotModeSelect.value;
  const modeText = plotModeSelect.options[plotModeSelect.selectedIndex]?.textContent || "";
  const partyName = state.partyNameByCode[partySelect.value] || "";
  let label = modeText;
  let desc = MODE_DESCRIPTIONS[mode] || "";
  if (mode === "share") {
    label += ": " + partyName;
  } else if (mode === "party_rank") {
    label = partyName + "の地域別順位";
    desc = "";
  } else if (mode === "selected_diff") {
    const targetName = compareTargetSelect.options[compareTargetSelect.selectedIndex]?.textContent || "";
    const metric = selectedMetricSelect.value;
    label = "比較: " + partyName + " vs " + targetName;
    desc = metric === "ratio"
      ? "二つの政党の得票率の比を表示"
      : "二つの政党の得票率の差を表示";
  } else if (mode === "rank") {
    const rankN = rankSelect.value || "1";
    label = "得票率第" + rankN + "位の政党";
    desc = "";
  } else if (mode === "opposition_rank") {
    const rankN = rankSelect.value || "1";
    label = "野党第" + rankN + "党";
    desc = "自民党を除いた第" + rankN + "位の政党";
  }
  legendModeLabel.textContent = label;
  legendModeDesc.textContent = desc;
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
  initMap();

  const [muniGeojson, prefGeojson, blockGeojson, election, partyList] = await Promise.all([
    fetch("./data/municipalities.geojson").then((r) => r.json()),
    fetch("./data/prefectures.geojson").then((r) => r.json()),
    fetch("./data/blocks.geojson").then((r) => r.json()),
    fetch("./data/election_data.json").then((r) => r.json()),
    fetch("./data/parties.json").then((r) => r.json()),
  ]);

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
