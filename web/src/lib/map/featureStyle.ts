import type { Feature } from 'geojson';
import type { PathOptions } from 'leaflet';
import { getFeatureRenderStats } from '../modes/rendering';
import { getModeHandler } from '../modes/registry';
import type { ModeContext } from '../../types';

/** Extended mode context that includes rendering-specific fields (color map, scale bounds). */
export interface MapRenderContext extends ModeContext {
  colorMap: Record<string, string>;
  activeMax: number;
  activeMin: number;
  activeCrossesZero: boolean;
  activePartyRankMax: number;
  labelsVisible: boolean;
}

/** Computes the Leaflet PathOptions (fill color, border, opacity) for a GeoJSON feature. */
export function featureStyle(feature: Feature, ctx: MapRenderContext): PathOptions {
  const stats = getFeatureRenderStats(feature, ctx);
  const handler = getModeHandler(ctx.plotMode);
  const fillColor = handler.getColor(stats, ctx);

  return {
    fillColor,
    weight: 0.4,
    color: '#626b75',
    opacity: 1,
    fillOpacity: handler.fillOpacity ?? 0.8,
  };
}
