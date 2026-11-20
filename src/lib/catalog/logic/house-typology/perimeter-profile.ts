import { convexHull } from '../parzelle';
import { hashUnit } from '../../core/random';

type XY = [number, number];
type Bay = { x: number; y: number; width: number; depth: number };
const profiles = ['terrace-fan', 'lantern-neck', 'cross-stack', 'lightwell'] as const;
type Profile = (typeof profiles)[number];

/** Chooses the upper mass once per site; podium and party-wall datums remain ensemble decisions. */
export function perimeterProfile(id: string, seed: number) {
	return profiles[Math.floor(hashUnit(seed, id, 'perimeter/profile') * profiles.length)];
}

function limits(
	profile: Profile,
	fraction: number,
	floor: number
): [number, number, number, number] {
	switch (profile) {
		case 'terrace-fan':
			return [0.02, 0.02 + fraction * 0.55, 0.02, 0.02];
		case 'lantern-neck': {
			const inset = fraction >= 0.75 ? 0.04 : 0.27;
			return [inset, inset, inset, inset];
		}
		case 'cross-stack':
			return floor % 2 ? [0.29, 0.29, 0.04, 0.04] : [0.04, 0.04, 0.29, 0.29];
		case 'lightwell':
			return [0.025, 0.025, 0.025, 0.025];
	}
}
function rectangle(left: number, right: number, bottom: number, top: number): XY[] {
	return [
		[left, bottom],
		[right, bottom],
		[right, top],
		[left, top]
	];
}

function shapedRim(profile: Profile, rim: XY[], access: XY[]) {
	const [[west, south], , [east, north]] = rim;
	if (profile === 'cross-stack' || profile === 'lightwell') return rim;
	const cx = (west + east) / 2,
		cy = (south + north) / 2;
	const w = (east - west) / 2,
		d = (north - south) / 2;
	if (profile === 'terrace-fan') {
		const sail: XY[] = [
			[east, cy],
			[cx, north],
			[west, north],
			[west, south],
			[cx, south]
		];
		return convexHull([...sail, ...access]).map(([x, y]): XY => [x, y]);
	}
	const lantern = Array.from({ length: 12 }, (_, i): XY => {
		const a = (2 * Math.PI * i) / 12;
		return [cx + w * Math.cos(a), cy + d * Math.sin(a)];
	});
	return convexHull([...lantern, ...access]).map(([x, y]): XY => [x, y]);
}

/** Fits four upper-volume principles around the invariant stair opening in an inscribed bay. */
export function upperFootprint(
	profile: Profile,
	bay: Bay,
	opening: XY[],
	floor: number,
	stories: number
) {
	const [west, east, south, north] = limits(profile, floor / Math.max(1, stories - 1), floor);
	const wall = 0.16;
	const [x0, y0] = opening[0],
		[x1, y1] = opening[2];
	const left = Math.min(x0 - wall, bay.x - bay.width * (0.5 - west));
	const right = Math.max(x1 + wall, bay.x + bay.width * (0.5 - east));
	const bottom = Math.min(y0 - wall, bay.y - bay.depth * (0.5 - south));
	const top = Math.max(y1 + wall, bay.y + bay.depth * (0.5 - north));
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
	return { polygon: shapedRim(profile, rim, access), holes };
}
