import { state } from "./state.js";
import {
  plotModeSelect,
  partySelect,
  compareTargetSelect,
  rankSelect,
} from "./dom.js";
import { getSelectedMetricMode, getRulingMetricMode } from "./modes.js";
import { t, getPartyShortName } from "./i18n.js";

export function buildLabelContext() {
  const mode = plotModeSelect.value;
  const partyCode = partySelect.value;
  const partyName = state.partyNameByCode[partyCode] || "";
  const partyShort = getPartyShortName(partyCode) || partyName;
  const targetName = compareTargetSelect.options[compareTargetSelect.selectedIndex]?.textContent || t("compareTarget.default");
  const targetCode = compareTargetSelect.value;
  const targetShort = targetCode === "top" ? t("compareTarget.top") : (getPartyShortName(targetCode) || targetName);
  const metricMode = mode === "selected_diff"
    ? getSelectedMetricMode()
    : mode === "ruling_vs_opposition"
      ? getRulingMetricMode()
      : null;
  const rankN = rankSelect.value || "1";
  const modeText = plotModeSelect.options[plotModeSelect.selectedIndex]?.textContent || "";
  return { mode, partyName, partyShort, targetName, targetShort, metricMode, rankN, modeText };
}

export function resolveLabel(labelOrFn, ctx) {
  if (typeof labelOrFn === "function") return labelOrFn(ctx);
  return labelOrFn;
}

export const MODE_LABELS = {
  share: {
    description: () => t("modeLabel.share.description"),
    legendHeader: (ctx) => t("modeLabel.share.legendHeader", ctx),
    legendTitle: () => t("modeLabel.share.legendTitle"),
    modeHelp: null,
    statsTitle: null,
    popupMetricLabel: null,
  },
  party_rank: {
    description: () => t("modeLabel.party_rank.description"),
    legendHeader: (ctx) => t("modeLabel.party_rank.legendHeader", ctx),
    legendTitle: () => t("modeLabel.party_rank.legendTitle"),
    modeHelp: () => t("modeLabel.party_rank.modeHelp"),
    modeHelpIsHtml: false,
    statsTitle: (ctx) => t("modeLabel.party_rank.statsTitle", ctx),
    popupMetricLabel: null,
  },
  rank: {
    description: () => t("modeLabel.rank.description"),
    legendHeader: (ctx) => t("modeLabel.rank.legendHeader", ctx),
    legendTitle: () => t("modeLabel.rank.legendTitle"),
    modeHelp: () => t("modeLabel.rank.modeHelp"),
    modeHelpIsHtml: false,
    statsTitle: (ctx) => t("modeLabel.rank.statsTitle", ctx),
    popupMetricLabel: null,
  },
  opposition_rank: {
    description: (ctx) => t("modeLabel.opposition_rank.description", ctx),
    legendHeader: (ctx) => t("modeLabel.opposition_rank.legendHeader", ctx),
    legendTitle: () => t("modeLabel.opposition_rank.legendTitle"),
    modeHelp: () => t("modeLabel.opposition_rank.modeHelp"),
    modeHelpIsHtml: false,
    statsTitle: (ctx) => t("modeLabel.opposition_rank.statsTitle", ctx),
    popupMetricLabel: null,
  },
  selected_diff: {
    description: (ctx) => ctx.metricMode === "ratio"
      ? t("modeLabel.selected_diff.description.ratio")
      : t("modeLabel.selected_diff.description.diff"),
    legendHeader: (ctx) => t("modeLabel.selected_diff.legendHeader", ctx),
    legendTitle: (ctx) => ctx.metricMode === "ratio"
      ? t("modeLabel.selected_diff.legendTitle.ratio", ctx)
      : t("modeLabel.selected_diff.legendTitle.diff", ctx),
    modeHelp: () => t("modeLabel.selected_diff.modeHelp"),
    modeHelpIsHtml: false,
    semanticLeft: (ctx) => t("modeLabel.selected_diff.semanticLeft", ctx),
    semanticRight: (ctx) => t("modeLabel.selected_diff.semanticRight", ctx),
    statsTitle: (ctx) => ctx.metricMode === "ratio"
      ? t("modeLabel.selected_diff.statsTitle.ratio", ctx)
      : t("modeLabel.selected_diff.statsTitle.diff", ctx),
    popupMetricLabel: null,
  },
  ruling_vs_opposition: {
    description: () => t("modeLabel.ruling_vs_opposition.description"),
    legendHeader: () => t("modeLabel.ruling_vs_opposition.legendHeader"),
    legendTitle: (ctx) => ctx.metricMode === "ratio"
      ? t("modeLabel.ruling_vs_opposition.legendTitle.ratio")
      : t("modeLabel.ruling_vs_opposition.legendTitle.diff"),
    modeHelp: () => t("modeLabel.ruling_vs_opposition.modeHelp"),
    modeHelpIsHtml: false,
    semanticLeft: () => t("modeLabel.ruling_vs_opposition.semanticLeft"),
    semanticRight: () => t("modeLabel.ruling_vs_opposition.semanticRight"),
    statsTitle: (ctx) => ctx.metricMode === "ratio"
      ? t("modeLabel.ruling_vs_opposition.statsTitle.ratio")
      : t("modeLabel.ruling_vs_opposition.statsTitle.diff"),
    popupMetricLabel: (ctx) => ctx.metricMode === "ratio"
      ? t("modeLabel.ruling_vs_opposition.popupMetricLabel.ratio")
      : t("modeLabel.ruling_vs_opposition.popupMetricLabel.diff"),
  },
  winner_margin: {
    description: () => t("modeLabel.winner_margin.description"),
    legendHeader: () => t("modeLabel.winner_margin.legendHeader"),
    legendTitle: () => t("modeLabel.winner_margin.legendTitle"),
    modeHelp: () => t("modeLabel.winner_margin.modeHelp"),
    modeHelpIsHtml: false,
    statsTitle: () => t("modeLabel.winner_margin.statsTitle"),
    popupMetricLabel: () => t("modeLabel.winner_margin.popupMetricLabel"),
  },
  concentration: {
    description: () => t("modeLabel.concentration.description"),
    legendHeader: () => t("modeLabel.concentration.legendHeader"),
    legendTitle: () => t("modeLabel.concentration.legendTitle"),
    modeHelp: () => t("modeLabel.concentration.modeHelp"),
    modeHelpIsHtml: true,
    statsTitle: () => t("modeLabel.concentration.statsTitle"),
    popupMetricLabel: () => t("modeLabel.concentration.popupMetricLabel"),
  },
  js_divergence: {
    description: () => t("modeLabel.js_divergence.description"),
    legendHeader: () => t("modeLabel.js_divergence.legendHeader"),
    legendTitle: () => t("modeLabel.js_divergence.legendTitle"),
    modeHelp: () => t("modeLabel.js_divergence.modeHelp"),
    modeHelpIsHtml: true,
    statsTitle: () => t("modeLabel.js_divergence.statsTitle"),
    statsTitleIsHtml: true,
    popupMetricLabel: () => t("modeLabel.js_divergence.popupMetricLabel"),
  },
};
