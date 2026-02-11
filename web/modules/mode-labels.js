import { state } from "./state.js";
import {
  plotModeSelect,
  partySelect,
  compareTargetSelect,
  selectedMetricSelect,
  rulingMetricSelect,
  rankSelect,
} from "./dom.js";
import { getSelectedMetricMode, getRulingMetricMode } from "./modes.js";

export function buildLabelContext() {
  const mode = plotModeSelect.value;
  const partyName = state.partyNameByCode[partySelect.value] || "";
  const targetName = compareTargetSelect.options[compareTargetSelect.selectedIndex]?.textContent || "比較対象";
  const metricMode = mode === "selected_diff"
    ? getSelectedMetricMode()
    : mode === "ruling_vs_opposition"
      ? getRulingMetricMode()
      : null;
  const rankN = rankSelect.value || "1";
  const modeText = plotModeSelect.options[plotModeSelect.selectedIndex]?.textContent || "";
  return { mode, partyName, targetName, metricMode, rankN, modeText };
}

export function resolveLabel(labelOrFn, ctx) {
  if (typeof labelOrFn === "function") return labelOrFn(ctx);
  return labelOrFn;
}

export const MODE_LABELS = {
  share: {
    description: "各政党の得票率を色の濃淡で示します",
    legendHeader: (ctx) => `${ctx.modeText}: ${ctx.partyName}`,
    legendTitle: () => "凡例（得票率）",
    modeHelp: null,
    statsTitle: null,
    popupMetricLabel: null,
  },
  party_rank: {
    description: "",
    legendHeader: (ctx) => `${ctx.partyName}の地域別順位`,
    legendTitle: () => "凡例（順位）",
    modeHelp: () => "選択した政党の順位（第1位, 第2位, ...）を地域ごとに色分け表示します。",
    modeHelpIsHtml: false,
    statsTitle: (ctx) => `${ctx.partyName} の順位分布`,
    popupMetricLabel: null,
  },
  rank: {
    description: "",
    legendHeader: (ctx) => `得票率第${ctx.rankN}位の政党`,
    legendTitle: () => "凡例（政党）",
    modeHelp: () => "各地域で得票率第N位の政党を色分け表示します。",
    modeHelpIsHtml: false,
    statsTitle: (ctx) => `得票率第${ctx.rankN}位の政党`,
    popupMetricLabel: null,
  },
  opposition_rank: {
    description: (ctx) => `自民党を除いた第${ctx.rankN}位の政党`,
    legendHeader: (ctx) => `野党第${ctx.rankN}党`,
    legendTitle: () => "凡例（政党）",
    modeHelp: () => "各地域で自民党を除いた得票率第N位の政党を色分け表示します。",
    modeHelpIsHtml: false,
    statsTitle: (ctx) => `野党第${ctx.rankN}党`,
    popupMetricLabel: null,
  },
  selected_diff: {
    description: (ctx) => ctx.metricMode === "ratio"
      ? "二つの政党の得票率の比を表示"
      : "二つの政党の得票率の差を表示",
    legendHeader: (ctx) => `比較: ${ctx.partyName} vs ${ctx.targetName}`,
    legendTitle: (ctx) => ctx.metricMode === "ratio"
      ? `凡例（比: ${ctx.partyName} / ${ctx.targetName}）`
      : `凡例（差: ${ctx.partyName} − ${ctx.targetName}）`,
    modeHelp: () => "二つの政党（基準政党と比較対象）の比較を表示します。",
    modeHelpIsHtml: false,
    semanticLeft: (ctx) => `${ctx.targetName}が優勢`,
    semanticRight: (ctx) => `${ctx.partyName}が優勢`,
    statsTitle: (ctx) => `${ctx.partyName}と${ctx.targetName}${ctx.metricMode === "ratio" ? "の比" : "の得票率差"}`,
    popupMetricLabel: null,
  },
  ruling_vs_opposition: {
    description: "与党（自民+維新）と野党（その他）の得票率比較を示します",
    legendHeader: () => "与党 vs 野党",
    legendTitle: (ctx) => ctx.metricMode === "ratio"
      ? "凡例（比: 与党/野党）"
      : "凡例（差分: 与党 - 野党）",
    modeHelp: () => "与党（自民・維新）と野党（それ以外）の比較を表示します。",
    modeHelpIsHtml: false,
    semanticLeft: () => "野党が優勢",
    semanticRight: () => "与党が優勢",
    statsTitle: (ctx) => ctx.metricMode === "ratio"
      ? "与党（自民・維新）/野党（それ以外）"
      : "与党と野党の差",
    popupMetricLabel: (ctx) => ctx.metricMode === "ratio"
      ? "与党（自民・維新）/野党（それ以外）"
      : "与党と野党の差",
  },
  winner_margin: {
    description: "値が小さいほど接戦、値が大きいほど1位が優勢です。",
    legendHeader: () => "上位2党の得票率差（接戦度）",
    legendTitle: () => "凡例（上位2党の得票率差）",
    modeHelp: () => "上位2党の得票率差（1位−2位）を表示します。値が小さいほど接戦、値が大きいほど1位が優勢です。",
    modeHelpIsHtml: false,
    statsTitle: () => "上位2党の得票率差（接戦度）",
    popupMetricLabel: () => "上位2党の得票率差（1位−2位）",
  },
  concentration: {
    description: "値が高いほど一党集中、低いほど多党分散を示します",
    legendHeader: () => "ハーフィンダール・ハーシュマン指数 (HHI)",
    legendTitle: () => "凡例（ハーフィンダール・ハーシュマン指数）",
    modeHelp: () => `<a href="https://ja.wikipedia.org/wiki/%E3%83%8F%E3%83%BC%E3%83%95%E3%82%A3%E3%83%B3%E3%83%80%E3%83%BC%E3%83%AB%E3%83%BB%E3%83%8F%E3%83%BC%E3%82%B7%E3%83%A5%E3%83%9E%E3%83%B3%E3%83%BB%E3%82%A4%E3%83%B3%E3%83%87%E3%83%83%E3%82%AF%E3%82%B9" target="_blank" rel="noopener noreferrer">ハーフィンダール・ハーシュマン指数 (HHI)</a> を表示します。値が高いほど特定政党への集中が強いことを示します。`,
    modeHelpIsHtml: true,
    statsTitle: () => "ハーフィンダール・ハーシュマン指数 (HHI)",
    popupMetricLabel: () => "ハーフィンダール・ハーシュマン指数 (HHI)",
  },
  js_divergence: {
    description: "政党投票構成の全国平均からの乖離度を示します。値が0に近いほど全国平均に近く、値が高いほど違いが大きくなります。",
    legendHeader: () => "政党投票構成の全国平均からの乖離度",
    legendTitle: () => "凡例（全国平均からの乖離度）",
    modeHelp: () => `政党投票構成の全国平均からの乖離度を <a href="https://en.wikipedia.org/wiki/Jensen%E2%80%93Shannon_divergence" target="_blank" rel="noopener noreferrer">Jensen-Shannon距離</a> で表示します。値が0に近いほど全国平均に近く、値が高いほど平均からの乖離が大きいことを示します。`,
    modeHelpIsHtml: true,
    statsTitle: () => `<span>全国平均からの乖離度</span><span>(Jensen-Shannon距離)</span>`,
    statsTitleIsHtml: true,
    popupMetricLabel: () => "全国平均からの乖離度（Jensen-Shannon距離）",
  },
};
