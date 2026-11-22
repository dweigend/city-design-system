import type { Vec2 } from '../../core/geometry';

export type Site = Readonly<{
	origin: Vec2;
	bearing: number;
	length: number;
	width: number;
	cornerCut?: number;
}>;

export type HeightAt = (x: number, y: number) => number;

export function validateSite({ origin, bearing, length, width, cornerCut = 0 }: Site) {
	// Keep lattice addresses and meter-scale differences numerically distinct.
	if (
		!Array.isArray(origin) ||
		origin.length !== 2 ||
		![origin[0], origin[1]].every((value) => Number.isFinite(value) && Math.abs(value) <= 1e9) ||
		!Number.isFinite(bearing) ||
		!Number.isFinite(cornerCut) ||
		cornerCut < 0 ||
		cornerCut > 0.5 ||
		![length, width].every((extent) => Number.isFinite(extent) && extent > 0 && extent <= 2000)
	) {
		throw new RangeError('Invalid terrain grid site');
	}
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
	const dx = sample(x + 10, y) - sample(x - 10, y);
	const dy = sample(x, y + 10) - sample(x, y - 10);
	if (Math.hypot(dx, dy) < 20 * 0.015) return bearing;
	const tangent = Math.atan2(dx, -dy);
	// Choose the contour direction closest to the site's positive axis.
	return Math.cos(tangent - bearing) < 0 ? tangent + Math.PI : tangent;
}

export function insideSite(site: Site) {
	const { toLocal } = axes(site.bearing);
	const [x, y] = site.origin;
	return (point: Vec2) => {
		const [u, v] = toLocal(point[0] - x, point[1] - y);
		const along = (2 * Math.abs(u)) / site.length;
		const across = (2 * Math.abs(v)) / site.width;
		return along <= 1 && across <= 1 && along + across <= 2 * (1 - (site.cornerCut ?? 0));
	};
}
