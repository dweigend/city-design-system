import { sectionInsets } from './section-insets';
import { convexHull } from '../parzelle';
import type { HouseEnvelope } from './envelope';

type XY = [number, number];
type Bay = { x: number; y: number; width: number; depth: number };
function rectangle(left: number, right: number, bottom: number, top: number): XY[] {
	return [
		[left, bottom],
		[right, bottom],
		[right, top],
		[left, top]
	];
}

function shapedRim(outline: HouseEnvelope['outline'], rim: XY[], access: XY[]) {
	const [[west, south], , [east, north]] = rim;
	if (outline === 'orthogonal') return rim;
	const cx = (west + east) / 2,
		cy = (south + north) / 2;
	const w = (east - west) / 2,
		d = (north - south) / 2;
	if (outline === 'faceted') {
		const sail: XY[] = [
			[east, cy],
			[cx, north],
			[west, north],
			[west, south],
			[cx, south]
		];
		return convexHull([...sail, ...access]).map(([x, y]): XY => [x, y]);
	}
	const h = Math.sqrt(3) / 2;
	const directions = [
		[1, 0],
		[h, 0.5],
		[0.5, h],
		[0, 1],
		[-0.5, h],
		[-h, 0.5],
		[-1, 0],
		[-h, -0.5],
		[-0.5, -h],
		[0, -1],
		[0.5, -h],
		[h, -0.5]
	];
	const lantern = directions.map(([u, v], i): XY => {
		const radius = outline === 'fluted' && i % 2 ? 0.72 : 1;
		return [cx + w * u * radius, cy + d * v * radius];
	});
	// Preserve the full shaft and its structural lining, including in a narrow neck.
	if (
		outline === 'fluted' &&
		access.every(([x, y]) => Math.abs(x - cx) / w + Math.abs(y - cy) / d < 0.7)
	)
		return lantern;
	return convexHull([...lantern, ...access]).map(([x, y]): XY => [x, y]);
}

/** Fits the occupied upper volume around the invariant stair opening in an inscribed bay. */
export function upperFootprint(
	envelope: HouseEnvelope,
	bay: Bay,
	opening: XY[],
	floor: number,
	stories: number
) {
	const profile = envelope.section;
	const [west, east, south, north] = sectionInsets(
		profile,
		floor / Math.max(1, stories - 1),
		floor
	);
	const wall = 0.16;
	const [x0, y0] = opening[0],
		[x1, y1] = opening[2];
	const clearance = 0.13;
	const left = Math.min(
		x0 - wall,
		Math.max(bay.x - bay.width / 2 + clearance, bay.x - bay.width * (0.5 - west))
	);
	const right = Math.max(
		x1 + wall,
		Math.min(bay.x + bay.width / 2 - clearance, bay.x + bay.width * (0.5 - east))
	);
	const bottom = Math.min(
		y0 - wall,
		Math.max(bay.y - bay.depth / 2 + clearance, bay.y - bay.depth * (0.5 - south))
	);
	const top = Math.max(
		y1 + wall,
		Math.min(bay.y + bay.depth / 2 - clearance, bay.y + bay.depth * (0.5 - north))
	);
	const holes = [opening];
	if (profile === 'lightwell') {
		const [lo, hi] = top - y1 > y0 - bottom ? [y1, top] : [bottom, y0];
		if (hi - lo > 1.6 && right - left > 2)
			holes.push(
				rectangle(
					left + (right - left) * 0.23,
					right - (right - left) * 0.23,
					lo + (hi - lo) * 0.2,
					hi - (hi - lo) * 0.2
				)
			);
	}
	const rim = rectangle(left, right, bottom, top);
	const access = rectangle(x0 - wall, x1 + wall, y0 - wall, y1 + wall);
	return { polygon: shapedRim(envelope.outline, rim, access.concat(holes.slice(1).flat())), holes };
}
