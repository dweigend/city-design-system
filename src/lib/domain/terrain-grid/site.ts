import { defaults } from '../../../config/terrain-grid';
import type { Vec2 } from '../../core/geometry';
import { validateOutline } from './outline';

type Datum = Readonly<{
	origin: Vec2;
	bearing: number;
	/** Maximum outline distance from the datum, in meters. */
	maxOutlineDistanceM?: number;
}>;

export type Site =
	| (Datum &
			Readonly<{
				length: number;
				width: number;
				cornerCut?: number;
			}>)
	| (Datum & Readonly<{ outline: readonly Vec2[] }>);

export type HeightAt = (x: number, y: number) => number;

export function siteOutline(site: Site): readonly Vec2[] {
	const { origin, bearing, maxOutlineDistanceM = defaults.outlineReachM } = site;
	if (
		!Array.isArray(origin) ||
		origin.length !== 2 ||
		![origin[0], origin[1]].every(
			(value) => Number.isFinite(value) && Math.abs(value) <= defaults.datumCoordinateLimitM
		) ||
		!Number.isFinite(bearing)
	)
		throw new RangeError('Invalid terrain grid datum');
	if (!Number.isFinite(maxOutlineDistanceM) || maxOutlineDistanceM <= 0)
		throw new RangeError('Expected a finite, positive outline distance limit');

	if ('outline' in site) {
		validateOutline(site.outline);
		if (
			site.outline.some(([x, y]) => Math.hypot(x - origin[0], y - origin[1]) > maxOutlineDistanceM)
		)
			throw new RangeError(
				maxOutlineDistanceM === defaults.outlineReachM
					? 'Outline must stay within 4 km of its datum'
					: `Outline must stay within ${maxOutlineDistanceM} m of its datum`
			);
		return site.outline;
	}
	const {
		length,
		width,
		cornerCut = /* Exact arithmetic: zero corner cut keeps the rectangle. */ 0
	} = site;
	if (
		!Number.isFinite(cornerCut) ||
		cornerCut < 0 ||
		cornerCut > 0.5 ||
		![length, width].every(
			(extent) => Number.isFinite(extent) && extent > 0 && extent <= maxOutlineDistanceM
		)
	)
		throw new RangeError('Invalid terrain grid site');
	const { toWorld } = axes(bearing);
	const corners: Vec2[] =
		cornerCut === 0
			? /* Exact arithmetic: normalized rectangle corners. */ [
					[-1, -1],
					[1, -1],
					[1, 1],
					[-1, 1]
				]
			: clippedCorners(1 - 2 * cornerCut);
	return corners.map(([x, y]) => {
		const [u, v] = toWorld((x * length) / 2, (y * width) / 2);
		return [origin[0] + u, origin[1] + v];
	});
}

function clippedCorners(inset: number): Vec2[] {
	if (inset === 0)
		return /* Exact arithmetic: maximal cut leaves the four edge midpoints. */ [
			[0, -1],
			[1, 0],
			[0, 1],
			[-1, 0]
		];
	return /* Exact arithmetic: normalized clipped rectangle corners. */ [
		[-inset, -1],
		[inset, -1],
		[1, -inset],
		[1, inset],
		[inset, 1],
		[-inset, 1],
		[-1, inset],
		[-1, -inset]
	];
}

export function axes(bearing: number) {
	const cos = Math.cos(bearing);
	const sin = Math.sin(bearing);
	return {
		toWorld: (u: number, v: number): Vec2 => [u * cos - v * sin, u * sin + v * cos],
		toLocal: (x: number, y: number): Vec2 => [x * cos + y * sin, y * cos - x * sin]
	};
}

export function contourBearing(site: Site, sample: HeightAt) {
	const {
		origin: [x, y],
		bearing
	} = site;
	// A symmetric 20 m baseline reads the local terrain trend through minor relief.
	const dx =
		sample(x + defaults.contourProbeOffsetM, y) - sample(x - defaults.contourProbeOffsetM, y);
	const dy =
		sample(x, y + defaults.contourProbeOffsetM) - sample(x, y - defaults.contourProbeOffsetM);
	if (Math.hypot(dx, dy) < 2 * defaults.contourProbeOffsetM * defaults.contourMinimumSlopeRatio)
		return bearing;
	const tangent = Math.atan2(dx, -dy);
	// Choose the contour direction closest to the site's positive axis.
	return Math.cos(tangent - bearing) < 0 ? tangent + Math.PI : tangent;
}
