import { state } from "./state.js";
import {
  partySelect,
  scaleModeSelect,
  granularitySelect,
  plotModeSelect,
  compareTargetSelect,
  selectedMetricSelect,
  rulingMetricSelect,
  rankSelect,
  labelToggle,
  prefBorderToggle,
  groupParty,
  groupCompareTarget,
  groupSelectedMetric,
  groupRulingMetric,
  groupScaleMode,
  groupRank,
  groupPrefBorders,
  modeHelpEl,
  selectedMetricHelpEl,
  rulingMetricHelpEl,
  scaleHelpEl,
} from "./dom.js";
import {
  isRankMode,
  isPartyRankMode,
  isSelectedVsTopMode,
  isRulingVsOppositionMode,
  isConcentrationMode,
  isWinnerMarginMode,
  isNationalDivergenceMode,
  isAnyRankMode,
  getSelectedMetricMode,
  getRulingMetricMode,
} from "./modes.js";
import { MODE_LABELS, buildLabelContext, resolveLabel } from "./mode-labels.js";
import {
  SELECTED_DIFF_DEFAULT_BASE,
  SELECTED_DIFF_DEFAULT_TARGET,
} from "./constants.js";

export function populatePartySelect() {
  partySelect.innerHTML = "";
  for (const p of state.parties) {
    const option = document.createElement("option");
    option.value = p.code;
    option.textContent = p.name;
    partySelect.appendChild(option);
  }
}

export function populateCompareTargetSelect() {
  const prev = compareTargetSelect.value;
  compareTargetSelect.innerHTML = "";
  const topOption = document.createElement("option");
  topOption.value = "top";
  topOption.textContent = "第1党";
  compareTargetSelect.appendChild(topOption);

  const group = document.createElement("optgroup");
  group.label = "各政党";
  for (const p of state.parties) {
    const option = document.createElement("option");
    option.value = p.code;
    option.textContent = p.name;
    group.appendChild(option);
  }
  compareTargetSelect.appendChild(group);

  const validValues = new Set(["top", ...state.parties.map((p) => p.code)]);
  compareTargetSelect.value = validValues.has(prev) ? prev : "top";
}

export function populateRankSelect() {
  rankSelect.innerHTML = "";
  const maxRank = Math.max(state.parties.length, 1);
  for (let r = 1; r <= maxRank; r += 1) {
    const option = document.createElement("option");
    option.value = String(r);
    option.textContent = `第${r}位`;
    rankSelect.appendChild(option);
  }
}

export function updateControlVisibility() {
  const isRank = isRankMode();
  const isPartyRank = isPartyRankMode();
  const isSelectedVsTop = isSelectedVsTopMode();
  const isRulingVsOpposition = isRulingVsOppositionMode();
  const isConcentration = isConcentrationMode();
  const isWinnerMargin = isWinnerMarginMode();
  const isNationalDivergence = isNationalDivergenceMode();
  const isMuni = granularitySelect.value === "muni";
  const showModeHelp = isAnyRankMode() || isSelectedVsTop || isRulingVsOpposition || isConcentration || isWinnerMargin || isNationalDivergence;
  groupParty.classList.toggle("hidden", isRank || isConcentration || isWinnerMargin || isRulingVsOpposition || isNationalDivergence);
  const partyLabelEl = document.querySelector('label[for="partySelect"]');
  if (partyLabelEl) {
    partyLabelEl.textContent = isSelectedVsTop ? "基準政党" : "政党";
  }
  groupCompareTarget.classList.toggle("hidden", !isSelectedVsTop);
  groupSelectedMetric.classList.toggle("hidden", !isSelectedVsTop);
  selectedMetricHelpEl?.classList.toggle("hidden", !isSelectedVsTop);
  if (isSelectedVsTop && selectedMetricHelpEl) {
    selectedMetricHelpEl.innerHTML = getSelectedMetricMode() === "ratio"
      ? "基準政党と比較対象の得票数の比率（基準/比較）を表示します。1.00が拮抗、1より大きいほど基準政党優勢、1より小さいほど基準政党劣勢です。"
      : "基準政党と比較対象の得票率の差（基準 - 比較）を表示します。0.0 ptは拮抗、正の値は基準政党優勢、負の値は基準政党劣勢を示します。";
  }
  groupRulingMetric.classList.toggle("hidden", !isRulingVsOpposition);
  rulingMetricHelpEl?.classList.toggle("hidden", !isRulingVsOpposition);
  if (isRulingVsOpposition && rulingMetricHelpEl) {
    rulingMetricHelpEl.innerHTML = getRulingMetricMode() === "ratio"
      ? "与党と野党の得票数の比率（与党/野党）を表示します。1.00が拮抗、1より大きいほど与党優勢、1より小さいほど野党優勢です。"
      : "与党と野党の得票率の差（与党 - 野党）を表示します。0.0 ptは拮抗、正の値は与党優勢、負の値は野党優勢を示します。";
  }
  groupScaleMode.classList.toggle("hidden", plotModeSelect.value !== "share");
  scaleHelpEl.classList.toggle("hidden", plotModeSelect.value !== "share");
  groupRank.classList.toggle("hidden", !isRank);
  groupPrefBorders.classList.toggle("hidden", !isMuni);
  modeHelpEl.classList.toggle("hidden", !showModeHelp);
  if (showModeHelp) {
    const ctx = buildLabelContext();
    const config = MODE_LABELS[ctx.mode];
    if (config?.modeHelp) {
      const text = resolveLabel(config.modeHelp, ctx);
      if (config.modeHelpIsHtml) {
        modeHelpEl.innerHTML = text;
      } else {
        modeHelpEl.textContent = text;
      }
    }
  }
}

export function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const defaultRank = state.parties.length >= 2 ? "2" : "1";
  if (!params.toString()) {
    granularitySelect.value = "muni";
    plotModeSelect.value = "share";
    partySelect.value = state.parties.some((p) => p.code === "mirai") ? "mirai" : (partySelect.value || "");
    rankSelect.value = defaultRank;
    scaleModeSelect.value = "party";
    state.labelsVisible = true;
    labelToggle.checked = true;
    state.prefBordersVisible = true;
    prefBorderToggle.checked = true;
    return;
  }
  const qParty = params.get("party");
  const qBase = params.get("base");
  const qScale = params.get("scale");
  const qGranularity = params.get("granularity");
  const qMode = params.get("mode");
  const qTarget = params.get("target");
  const qMetric = params.get("metric");
  const qRank = params.get("rank");
  const qLabels = params.get("labels");
  const qPrefBorders = params.get("prefBorders");
  if (qMode === "share" || qMode === "party_rank") {
    if (qParty && state.parties.some((p) => p.code === qParty)) {
      partySelect.value = qParty;
    } else if (qMode === "party_rank" && state.parties.some((p) => p.code === "mirai")) {
      partySelect.value = "mirai";
    }
  } else if (qMode === "selected_diff") {
    if (qBase && state.parties.some((p) => p.code === qBase)) {
      partySelect.value = qBase;
    } else if (state.parties.some((p) => p.code === SELECTED_DIFF_DEFAULT_BASE)) {
      partySelect.value = SELECTED_DIFF_DEFAULT_BASE;
    }
  }
  if (qScale && (qScale === "fixed" || qScale === "party")) {
    scaleModeSelect.value = qScale;
  }
  if (qGranularity && (qGranularity === "block" || qGranularity === "pref" || qGranularity === "muni")) {
    granularitySelect.value = qGranularity;
  }
  if (
    qMode &&
    (
      qMode === "share" ||
      qMode === "rank" ||
      qMode === "opposition_rank" ||
      qMode === "party_rank" ||
      qMode === "selected_diff" ||
      qMode === "ruling_vs_opposition" ||
      qMode === "winner_margin" ||
      qMode === "concentration" ||
      qMode === "js_divergence"
    )
  ) {
    plotModeSelect.value = qMode;
  }
  if (qRank) {
    const rankNum = Number.parseInt(qRank, 10);
    if (Number.isInteger(rankNum) && rankNum >= 1 && rankNum <= state.parties.length) {
      rankSelect.value = String(rankNum);
    }
  } else if (plotModeSelect.value === "rank" || plotModeSelect.value === "opposition_rank") {
    rankSelect.value = defaultRank;
  }
  if (
    qTarget &&
    (
      qTarget === "top" ||
      state.parties.some((p) => p.code === qTarget)
    )
  ) {
    compareTargetSelect.value = qTarget;
  } else if (plotModeSelect.value === "selected_diff" && state.parties.some((p) => p.code === SELECTED_DIFF_DEFAULT_TARGET)) {
    compareTargetSelect.value = SELECTED_DIFF_DEFAULT_TARGET;
  }
  if (plotModeSelect.value === "selected_diff" || plotModeSelect.value === "ruling_vs_opposition") {
    if (qMetric && (qMetric === "diff" || qMetric === "ratio")) {
      if (plotModeSelect.value === "selected_diff") {
        selectedMetricSelect.value = qMetric;
      } else {
        rulingMetricSelect.value = qMetric;
      }
    }
  }
  if (qLabels === "0" || qLabels === "false") {
    state.labelsVisible = false;
    labelToggle.checked = false;
  } else {
    state.labelsVisible = true;
    labelToggle.checked = true;
  }
  if (qPrefBorders === "0" || qPrefBorders === "false") {
    state.prefBordersVisible = false;
    prefBorderToggle.checked = false;
  } else {
    state.prefBordersVisible = true;
    prefBorderToggle.checked = true;
  }
}

export function writeStateToUrl() {
  const url = new URL(window.location.href);
  const mode = plotModeSelect.value;

  url.searchParams.delete("granularity");
  if (granularitySelect.value !== "muni") {
    url.searchParams.set("granularity", granularitySelect.value);
  }
  url.searchParams.set("mode", mode);
  url.searchParams.delete("labels");
  url.searchParams.delete("prefBorders");
  if (!state.labelsVisible) url.searchParams.set("labels", "0");
  if (!state.prefBordersVisible) url.searchParams.set("prefBorders", "0");

  url.searchParams.delete("party");
  url.searchParams.delete("base");
  url.searchParams.delete("scale");
  url.searchParams.delete("target");
  url.searchParams.delete("metric");
  url.searchParams.delete("rank");

  if (mode === "share") {
    url.searchParams.set("party", partySelect.value);
    url.searchParams.set("scale", scaleModeSelect.value);
  } else if (mode === "party_rank") {
    url.searchParams.set("party", partySelect.value);
  } else if (mode === "rank" || mode === "opposition_rank") {
    url.searchParams.set("rank", rankSelect.value);
  } else if (mode === "selected_diff") {
    url.searchParams.set("base", partySelect.value);
    url.searchParams.set("target", compareTargetSelect.value);
    url.searchParams.set("metric", selectedMetricSelect.value);
  } else if (mode === "ruling_vs_opposition") {
    url.searchParams.set("metric", rulingMetricSelect.value);
  }

  window.history.replaceState({}, "", url);
}
