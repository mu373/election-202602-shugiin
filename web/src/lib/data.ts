import {
  DEFAULT_PARTY_PALETTE,
  PARTY_COLOR_MAP,
} from './constants';
import type {
  Aggregate,
  DataContext,
  ElectionFeature,
  ElectionRecord,
  Granularity,
  Party,
  RankedParty,
} from '../types';

/** Builds a code→color mapping for all parties, using explicit colors where available and a fallback palette otherwise. */
export function buildPartyColorMap(parties: Party[]): Record<string, string> {
  const colorMap: Record<string, string> = {};
  const sortedCodes = parties.map((p) => p.code).sort();
  let paletteIdx = 0;

  for (const code of sortedCodes) {
    if (PARTY_COLOR_MAP[code]) {
      colorMap[code] = PARTY_COLOR_MAP[code];
      continue;
    }
    colorMap[code] = DEFAULT_PARTY_PALETTE[paletteIdx % DEFAULT_PARTY_PALETTE.length];
    paletteIdx += 1;
  }

  return colorMap;
}

/** Returns the display color for a party code, falling back to gray. */
export function partyColor(code: string | null | undefined, colorMap: Record<string, string>): string {
  if (!code) return '#9ca3af';
  return colorMap[code] || '#9ca3af';
}

/** Aggregates municipality-level election data into prefecture and block totals. */
export function buildAggregates(
  electionData: Record<string, ElectionRecord>,
  prefToBlock: Record<string, string>,
): { prefAgg: Record<string, Aggregate>; blockAgg: Record<string, Aggregate> } {
  const prefAgg: Record<string, Aggregate> = {};
  const blockAgg: Record<string, Aggregate> = {};

  for (const rec of Object.values(electionData)) {
    const prefName = rec.pref;
    const validVotes = Number(rec.valid_votes);
    if (!prefName || !Number.isFinite(validVotes) || validVotes <= 0) continue;

    if (!prefAgg[prefName]) {
      prefAgg[prefName] = { valid_votes: 0, party_votes: {} };
    }

    prefAgg[prefName].valid_votes += validVotes;

    for (const [partyCode, share] of Object.entries(rec.parties || {})) {
      if (typeof share !== 'number' || Number.isNaN(share)) continue;
      const addVotes = share * validVotes;
      prefAgg[prefName].party_votes[partyCode] =
        (prefAgg[prefName].party_votes[partyCode] || 0) + addVotes;
    }
  }

  for (const [prefName, agg] of Object.entries(prefAgg)) {
    const blockName = prefToBlock[prefName];
    if (!blockName) continue;
    if (!blockAgg[blockName]) {
      blockAgg[blockName] = { valid_votes: 0, party_votes: {} };
    }

    blockAgg[blockName].valid_votes += agg.valid_votes;
    for (const [partyCode, votes] of Object.entries(agg.party_votes)) {
      blockAgg[blockName].party_votes[partyCode] =
        (blockAgg[blockName].party_votes[partyCode] || 0) + votes;
    }
  }

  return { prefAgg, blockAgg };
}

/** Returns the vote share of a party in a specific municipality, or null if unavailable. */
export function getShare(
  electionData: Record<string, ElectionRecord>,
  muniCode: string,
  partyCode: string,
): number | null {
  const rec = electionData[muniCode];
  if (!rec || !rec.parties) return null;
  const value = rec.parties[partyCode];
  return typeof value === 'number' ? value : null;
}

/** Returns a party's vote share from an aggregate (prefecture or block), or null if unavailable. */
export function getAggregateShare(agg: Aggregate | undefined, partyCode: string): number | null {
  if (!agg || !agg.valid_votes || !agg.party_votes) return null;
  const partyVotes = agg.party_votes[partyCode];
  if (typeof partyVotes !== 'number' || Number.isNaN(partyVotes)) return null;
  return partyVotes / agg.valid_votes;
}

/** Returns the label, share, and valid-vote count for a feature at the current granularity. */
export function getFeatureStats(
  feature: ElectionFeature,
  partyCode: string,
  ctx: DataContext,
): { label: string; share: number | null; validVotes: number | null } {
  if (ctx.granularity === 'muni') {
    const muniCode = String(feature.properties?.muni_code || '').padStart(5, '0');
    const rec = ctx.electionData[muniCode] || {};
    const baseName = `${rec.name || feature.properties?.muni_name || ''}`.trim();
    const prefName = `${rec.pref || feature.properties?.pref_name || ''}`.trim();
    const fullName = (() => {
      if (!baseName) return '';
      if (!prefName) return baseName;
      if (baseName.startsWith(prefName)) return baseName;
      return `${prefName}${baseName}`;
    })();

    return {
      label: fullName,
      share: getShare(ctx.electionData, muniCode, partyCode),
      validVotes: typeof rec.valid_votes === 'number' ? rec.valid_votes : null,
    };
  }

  if (ctx.granularity === 'pref') {
    const prefName = String(feature.properties?.pref_name || '');
    const agg = ctx.prefAgg[prefName];
    return {
      label: prefName || '都道府県',
      share: getAggregateShare(agg, partyCode),
      validVotes: agg ? agg.valid_votes : null,
    };
  }

  const blockName = String(feature.properties?.block_name || '');
  const agg = ctx.blockAgg[blockName];
  return {
    label: blockName || 'ブロック',
    share: getAggregateShare(agg, partyCode),
    validVotes: agg ? agg.valid_votes : null,
  };
}

/**
 * Returns all parties for a feature ranked by vote share descending,
 * optionally excluding a specific party (e.g. for opposition rankings).
 */
export function getRankedPartiesForFeature(
  feature: ElectionFeature,
  excludedPartyCode: string | null,
  ctx: DataContext,
): RankedParty[] {
  if (ctx.granularity === 'muni') {
    const muniCode = String(feature.properties?.muni_code || '').padStart(5, '0');
    const rec = ctx.electionData[muniCode] || {};
    return Object.entries(rec.parties || {})
      .filter(([, share]) => typeof share === 'number' && !Number.isNaN(share))
      .map(([code, share]) => ({ code, share, votes: (rec.valid_votes || 0) * share }))
      .filter((p) => p.code !== excludedPartyCode)
      .sort((a, b) => b.share - a.share);
  }

  const agg =
    ctx.granularity === 'pref'
      ? ctx.prefAgg[String(feature.properties?.pref_name || '')]
      : ctx.blockAgg[String(feature.properties?.block_name || '')];

  if (!agg || !agg.valid_votes) return [];

  return Object.entries(agg.party_votes || {})
    .filter(([, votes]) => typeof votes === 'number' && !Number.isNaN(votes) && votes > 0)
    .map(([code, votes]) => ({ code, votes, share: votes / agg.valid_votes }))
    .filter((p) => p.code !== excludedPartyCode)
    .sort((a, b) => b.share - a.share);
}

/** Returns all vote shares for a party at the given granularity level. */
export function getSharesForCurrentGranularity(
  partyCode: string,
  granularity: Granularity,
  electionData: Record<string, ElectionRecord>,
  prefAgg: Record<string, Aggregate>,
  blockAgg: Record<string, Aggregate>,
): number[] {
  if (granularity === 'muni') {
    return Object.values(electionData)
      .map((rec) => rec?.parties?.[partyCode])
      .filter((x): x is number => typeof x === 'number' && !Number.isNaN(x));
  }

  if (granularity === 'pref') {
    return Object.values(prefAgg)
      .map((agg) => getAggregateShare(agg, partyCode))
      .filter((x): x is number => typeof x === 'number' && !Number.isNaN(x));
  }

  return Object.values(blockAgg)
    .map((agg) => getAggregateShare(agg, partyCode))
    .filter((x): x is number => typeof x === 'number' && !Number.isNaN(x));
}
