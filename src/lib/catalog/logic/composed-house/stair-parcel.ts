import type { StockPart } from './house-object';
import type { Point2 } from '../ansicht/geometrie';
import type { Section } from './types';
import { cantileverMargin, footprint, plotCovers } from './parcel-footprint';

/** Checks a bearing plate against the union of painted cells without an overhang. */
export function parcelSupports(s: Section, polygon: Point2[]) {
	return plotCovers(s.cells, { ring: polygon, holes: [] }, 0);
}

/** Accepts a mounted rail tube when its plan fits the widened parcel union. */
export function parcelFitsRail(s: Pick<Section, 'cells'>, p: Extract<StockPart, { kind: 'pipe' }>) {
	return plotCovers(s.cells, footprint(p), cantileverMargin);
}
