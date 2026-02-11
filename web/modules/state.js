import { FIXED_BREAKS } from "./constants.js";

export const state = {
  geoLayer: null,
  prefBorderLayer: null,
  electionData: {},
  parties: [],
  partyNameByCode: {},
  partyColorByCode: {},
  geojsonByGranularity: { muni: null, pref: null, block: null },
  prefToBlock: {},
  prefAgg: {},
  blockAgg: {},
  currentGranularity: "muni",
  labelsVisible: false,
  prefBordersVisible: true,
  lastPlotMode: null,
  activeBreaks: [...FIXED_BREAKS],
  activeMax: 1.0,
  activeMin: 0.0,
  activeCrossesZero: false,
  activePartyRankMax: 1,
};
