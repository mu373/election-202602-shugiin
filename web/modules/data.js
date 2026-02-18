import { state } from "./state.js";
import { granularitySelect } from "./dom.js";
import { PARTY_COLOR_MAP, DEFAULT_PARTY_PALETTE } from "./constants.js";
import { t, getMuniFull, getPrefName, getBlockName } from "./i18n.js";

export function buildPartyColorMap() {
  state.partyColorByCode = {};
  const sortedCodes = state.parties.map((p) => p.code).sort();
  let paletteIdx = 0;
  for (const code of sortedCodes) {
    if (PARTY_COLOR_MAP[code]) {
      state.partyColorByCode[code] = PARTY_COLOR_MAP[code];
      continue;
    }
    state.partyColorByCode[code] = DEFAULT_PARTY_PALETTE[paletteIdx % DEFAULT_PARTY_PALETTE.length];
    paletteIdx += 1;
  }
}

export function partyColor(code) {
  return state.partyColorByCode[code] || "#9ca3af";
}

export function buildAggregates() {
  state.prefAgg = {};
  state.blockAgg = {};
  for (const rec of Object.values(state.electionData)) {
    const prefName = rec.pref;
    const validVotes = Number(rec.valid_votes);
    if (!prefName || !Number.isFinite(validVotes) || validVotes <= 0) continue;
    if (!state.prefAgg[prefName]) {
      state.prefAgg[prefName] = { valid_votes: 0, party_votes: {} };
    }
    state.prefAgg[prefName].valid_votes += validVotes;
    for (const [partyCode, share] of Object.entries(rec.parties || {})) {
      if (typeof share !== "number" || Number.isNaN(share)) continue;
      const addVotes = share * validVotes;
      state.prefAgg[prefName].party_votes[partyCode] =
        (state.prefAgg[prefName].party_votes[partyCode] || 0) + addVotes;
    }
  }

  for (const [prefName, agg] of Object.entries(state.prefAgg)) {
    const blockName = state.prefToBlock[prefName];
    if (!blockName) continue;
    if (!state.blockAgg[blockName]) {
      state.blockAgg[blockName] = { valid_votes: 0, party_votes: {} };
    }
    state.blockAgg[blockName].valid_votes += agg.valid_votes;
    for (const [partyCode, votes] of Object.entries(agg.party_votes)) {
      state.blockAgg[blockName].party_votes[partyCode] =
        (state.blockAgg[blockName].party_votes[partyCode] || 0) + votes;
    }
  }
}

export function getShare(muniCode, partyCode) {
  const rec = state.electionData[muniCode];
  if (!rec || !rec.parties) return null;
  const v = rec.parties[partyCode];
  return typeof v === "number" ? v : null;
}

export function getAggregateShare(agg, partyCode) {
  if (!agg || !agg.valid_votes || !agg.party_votes) return null;
  const partyVotes = agg.party_votes[partyCode];
  if (typeof partyVotes !== "number" || Number.isNaN(partyVotes)) return null;
  return partyVotes / agg.valid_votes;
}

export function getFeatureStats(feature, partyCode) {
  const granularity = granularitySelect.value;
  if (granularity === "muni") {
    const muniCode = String(feature.properties.muni_code || "").padStart(5, "0");
    const rec = state.electionData[muniCode] || {};
    return {
      label: getMuniFull(muniCode),
      share: getShare(muniCode, partyCode),
      validVotes: rec.valid_votes ?? null,
    };
  }
  if (granularity === "pref") {
    const prefName = feature.properties.pref_name;
    const agg = state.prefAgg[prefName];
    return {
      label: getPrefName(feature.properties.pref_code) || t("data.prefecture"),
      share: getAggregateShare(agg, partyCode),
      validVotes: agg ? agg.valid_votes : null,
    };
  }
  const blockName = feature.properties.block_name;
  const agg = state.blockAgg[blockName];
  return {
    label: getBlockName(feature.properties.block_id) || t("data.block"),
    share: getAggregateShare(agg, partyCode),
    validVotes: agg ? agg.valid_votes : null,
  };
}

export function getRankedPartiesForFeature(feature, excludedPartyCodes = null) {
  const isExcluded = excludedPartyCodes instanceof Set
    ? (code) => excludedPartyCodes.has(code)
    : (code) => code === excludedPartyCodes;
  const granularity = granularitySelect.value;
  if (granularity === "muni") {
    const muniCode = String(feature.properties.muni_code || "").padStart(5, "0");
    const rec = state.electionData[muniCode] || {};
    return Object.entries(rec.parties || {})
      .filter(([, share]) => typeof share === "number" && !Number.isNaN(share))
      .map(([code, share]) => ({ code, share, votes: (rec.valid_votes || 0) * share }))
      .filter((p) => !isExcluded(p.code))
      .sort((a, b) => b.share - a.share);
  }

  const agg = granularity === "pref"
    ? state.prefAgg[feature.properties.pref_name]
    : state.blockAgg[feature.properties.block_name];
  if (!agg || !agg.valid_votes) return [];
  return Object.entries(agg.party_votes || {})
    .filter(([, votes]) => typeof votes === "number" && !Number.isNaN(votes) && votes > 0)
    .map(([code, votes]) => ({ code, votes, share: votes / agg.valid_votes }))
    .filter((p) => !isExcluded(p.code))
    .sort((a, b) => b.share - a.share);
}

export function getBlockNameForFeature(feature) {
  const granularity = granularitySelect.value;
  if (granularity === "block") {
    return feature.properties.block_name;
  }
  if (granularity === "pref") {
    return state.prefToBlock[feature.properties.pref_name] || null;
  }
  const muniCode = String(feature.properties.muni_code || "").padStart(5, "0");
  const rec = state.electionData[muniCode];
  return rec ? (state.prefToBlock[rec.pref] || null) : null;
}

export function getFieldedPartyCodes(blockName) {
  const agg = state.blockAgg[blockName];
  if (!agg || !agg.party_votes) return null;
  const codes = new Set();
  for (const [code, votes] of Object.entries(agg.party_votes)) {
    if (typeof votes === "number" && votes > 0) codes.add(code);
  }
  return codes.size > 0 ? codes : null;
}

export function getSharesForCurrentGranularity(partyCode) {
  const granularity = granularitySelect.value;
  if (granularity === "muni") {
    return Object.values(state.electionData)
      .map((rec) => rec?.parties?.[partyCode])
      .filter((x) => typeof x === "number" && !Number.isNaN(x));
  }
  if (granularity === "pref") {
    return Object.values(state.prefAgg)
      .map((agg) => getAggregateShare(agg, partyCode))
      .filter((x) => typeof x === "number" && !Number.isNaN(x));
  }
  return Object.values(state.blockAgg)
    .map((agg) => getAggregateShare(agg, partyCode))
    .filter((x) => typeof x === "number" && !Number.isNaN(x));
}
