import type { PlotMode } from '../../types';
import type { LabelContext } from './labelUtils';
import type { ModeLabelConfig } from './types';

/** Human-readable Japanese names for each plot mode. */
export const MODE_TEXT_BY_VALUE: Record<PlotMode, string> = {
  share: '政党得票率',
  party_rank: '選択政党の順位',
  rank: '得票率第N位の政党',
  opposition_rank: '野党第N党',
  selected_diff: '二つの政党の比較',
  ruling_vs_opposition: '与野党比較',
  winner_margin: '上位2党の得票率差（接戦度）',
  concentration: '票の集中度',
  js_divergence: '全国平均からの乖離度',
};

/** All mode label configurations, keyed by PlotMode. */
export const MODE_LABELS: Record<PlotMode, ModeLabelConfig> = {
  share: {
    modeHeading: (ctx: LabelContext) => `${ctx.modeText}: ${ctx.partyName}`,
    modeSummary: '各政党の得票率を色の濃淡で示します',
    legendSectionTitle: () => '凡例（得票率）',
    statsHeading: null,
    popupMetricName: null,
    controlHelp: null,
  },

  party_rank: {
    modeHeading: (ctx: LabelContext) => `${ctx.partyName}の地域別順位`,
    modeSummary: '',
    legendSectionTitle: () => '凡例（順位）',
    statsHeading: (ctx: LabelContext) => `${ctx.partyName} の順位分布`,
    popupMetricName: null,
    controlHelp: () => '選択した政党の順位（第1位, 第2位, ...）を地域ごとに色分け表示します。',
    controlHelpIsHtml: false,
  },

  rank: {
    modeHeading: (ctx: LabelContext) => `得票率第${ctx.rankN}位の政党`,
    modeSummary: '',
    legendSectionTitle: () => '凡例（政党）',
    statsHeading: (ctx: LabelContext) => `得票率第${ctx.rankN}位の政党`,
    popupMetricName: null,
    controlHelp: () => '各地域で得票率第N位の政党を色分け表示します。',
    controlHelpIsHtml: false,
  },

  opposition_rank: {
    modeHeading: (ctx: LabelContext) => `野党第${ctx.rankN}党`,
    modeSummary: (ctx: LabelContext) => `自民党を除いた第${ctx.rankN}位の政党`,
    legendSectionTitle: () => '凡例（政党）',
    statsHeading: (ctx: LabelContext) => `野党第${ctx.rankN}党`,
    popupMetricName: null,
    controlHelp: () => '各地域で自民党を除いた得票率第N位の政党を色分け表示します。',
    controlHelpIsHtml: false,
  },

  selected_diff: {
    modeHeading: (ctx: LabelContext) => `比較: ${ctx.partyName} vs ${ctx.targetName}`,
    modeSummary: (ctx: LabelContext) => (ctx.metricMode === 'ratio'
      ? '二つの政党の得票率の比を表示'
      : '二つの政党の得票率の差を表示'),
    legendSectionTitle: (ctx: LabelContext) => (ctx.metricMode === 'ratio'
      ? `凡例（比: ${ctx.partyName} / ${ctx.targetName}）`
      : `凡例（差: ${ctx.partyName} − ${ctx.targetName}）`),
    statsHeading: (ctx: LabelContext) => `${ctx.partyName}と${ctx.targetName}${ctx.metricMode === 'ratio' ? 'の比' : 'の得票率差'}`,
    popupMetricName: null,
    controlHelp: () => '二つの政党（基準政党と比較対象）の比較を表示します。',
    controlHelpIsHtml: false,
    lowSideLabel: (ctx: LabelContext) => `${ctx.targetName}が優勢`,
    highSideLabel: (ctx: LabelContext) => `${ctx.partyName}が優勢`,
  },

  ruling_vs_opposition: {
    modeHeading: () => '与党 vs 野党',
    modeSummary: '与党（自民+維新）と野党（その他）の得票率比較を示します',
    legendSectionTitle: (ctx: LabelContext) => (ctx.metricMode === 'ratio' ? '凡例（比: 与党/野党）' : '凡例（差分: 与党 - 野党）'),
    statsHeading: (ctx: LabelContext) => (ctx.metricMode === 'ratio' ? '与党（自民・維新）/野党（それ以外）' : '与党と野党の差'),
    popupMetricName: (ctx: LabelContext) => (ctx.metricMode === 'ratio' ? '与党（自民・維新）/野党（それ以外）' : '与党と野党の差'),
    controlHelp: () => '与党（自民・維新）と野党（それ以外）の比較を表示します。',
    controlHelpIsHtml: false,
    lowSideLabel: () => '野党が優勢',
    highSideLabel: () => '与党が優勢',
  },

  winner_margin: {
    modeHeading: () => '上位2党の得票率差（接戦度）',
    modeSummary: '値が小さいほど接戦、値が大きいほど1位が優勢です。',
    legendSectionTitle: () => '凡例（上位2党の得票率差）',
    statsHeading: () => '上位2党の得票率差（接戦度）',
    popupMetricName: () => '上位2党の得票率差（1位−2位）',
    controlHelp: () => '上位2党の得票率差（1位−2位）を表示します。値が小さいほど接戦、値が大きいほど1位が優勢です。',
    controlHelpIsHtml: false,
  },

  concentration: {
    modeHeading: () => 'ハーフィンダール・ハーシュマン指数 (HHI)',
    modeSummary: '値が高いほど一党集中、低いほど多党分散を示します',
    legendSectionTitle: () => '凡例（ハーフィンダール・ハーシュマン指数）',
    statsHeading: () => 'ハーフィンダール・ハーシュマン指数 (HHI)',
    popupMetricName: () => 'ハーフィンダール・ハーシュマン指数 (HHI)',
    controlHelp: () => '<a href="https://ja.wikipedia.org/wiki/%E3%83%8F%E3%83%BC%E3%83%95%E3%82%A3%E3%83%B3%E3%83%80%E3%83%BC%E3%83%AB%E3%83%BB%E3%83%8F%E3%83%BC%E3%82%B7%E3%83%A5%E3%83%9E%E3%83%B3%E3%83%BB%E3%82%A4%E3%83%B3%E3%83%87%E3%83%83%E3%82%AF%E3%82%B9" target="_blank" rel="noopener noreferrer">ハーフィンダール・ハーシュマン指数 (HHI)</a> を表示します。値が高いほど特定政党への集中が強いことを示します。',
    controlHelpIsHtml: true,
  },

  js_divergence: {
    modeHeading: () => '政党投票構成の全国平均からの乖離度',
    modeSummary: '政党投票構成の全国平均からの乖離度を示します。値が0に近いほど全国平均に近く、値が高いほど違いが大きくなります。',
    legendSectionTitle: () => '凡例（全国平均からの乖離度）',
    statsHeading: () => '<span>全国平均からの乖離度</span><span>(Jensen-Shannon距離)</span>',
    popupMetricName: () => '全国平均からの乖離度（Jensen-Shannon距離）',
    controlHelp: () => '政党投票構成の全国平均からの乖離度を <a href="https://en.wikipedia.org/wiki/Jensen%E2%80%93Shannon_divergence" target="_blank" rel="noopener noreferrer">Jensen-Shannon距離</a> で表示します。値が0に近いほど全国平均に近く、値が高いほど平均からの乖離が大きいことを示します。',
    controlHelpIsHtml: true,
    statsHeadingIsHtml: true,
  },
};
