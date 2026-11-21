import { convexHull } from '../parzelle';
import { houseStair } from '../../data/house-stair';
import type { Vec3 } from '../parametrik/types';
import type { Access, Platform, Rod, SpiralWell, StructureNode, XY } from './contract';
import { centre } from './plot';

// Sixteen goings per revolution keep a clear walking height between successive turns.
const SIDES = 16;
/** Absolute deviation that triggers an approach ramp, and added riser height on that ramp run, in metres. */
const RISER_DEVIATION = 0.019;
const RAMP_RISER_ALLOWANCE = 0.015;
/** Maximum approach rise per metre of horizontal travel. */
const APPROACH_GRADE = 0.08;
const RISERS_PER_FLIGHT = 16;
const ANGLE = (2 * Math.PI) / SIDES;
const WALK_RADIUS = houseStair.going / (2 * Math.sin(ANGLE / 2));

/** Fits the stair between two adjacent fan rays, leaving room beyond its lip for a landing. */
function clearBay(ring: XY[]): SpiralWell {
	const c = centre(ring);
	const length = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);
	const bays = ring.map((a, i) => {
		const b = ring[(i + 1) % ring.length];
		const ca = length(c, a),
			cb = length(c, b),
			ab = length(a, b);
		const perimeter = ca + cb + ab;
		const radius =
			Math.abs((a[0] - c[0]) * (b[1] - c[1]) - (a[1] - c[1]) * (b[0] - c[0])) / perimeter;
		const axis = c.map((v, k) => (ab * v + cb * a[k] + ca * b[k]) / perimeter) as XY;
		return { radius, axis };
	});
	const bay = bays.reduce((a, b) => (a.radius >= b.radius ? a : b));
	const outer = Math.min(
		WALK_RADIUS + houseStair.width / 2,
		Math.min(bay.radius * 0.8, Math.max(houseStair.compactLadderWidth + 0.06, bay.radius * 0.6))
	);
	const share = Math.min(1, (outer + 0.08) / bay.radius);
	const axis = c.map((v, k) => v + share * (bay.axis[k] - v)) as XY;
	return wellAt(axis, outer);
}

function wellAt(axis: XY, outer: number): SpiralWell {
	const inner = Math.max(0.06, outer - houseStair.width);
	return { axis, outer, inner, walk: Math.min(WALK_RADIUS, inner + 0.8 * (outer - inner)) };
}

// Hanging rooms have no central trunk. Their narrowest deck bounds a concentric stair.
function roomWell(platform: Platform) {
	const ring = platform.outline,
		c = centre(ring);
	const span = Math.min(
		...ring.map(([x, y], i) => {
			const [a, b] = ring[(i + 1) % ring.length];
			return Math.abs((a - x) * (c[1] - y) - (b - y) * (c[0] - x)) / Math.hypot(a - x, b - y);
		})
	);
	return wellAt(c, Math.min(WALK_RADIUS + houseStair.width / 2, span * 0.75));
}

/** Adds the founded newel carrying the spiral treads between ground and the final platform. */
export function spiralNewel(id: string, access: Access[], nodes: StructureNode[], rods: Rod[]) {
	const well = access[0]?.spiral?.well;
	if (!well) return;
	const base = id + '/newel/foot',
		head = id + '/newel/head';
	nodes.push(
		{ id: base, position: [...well.axis, access[0].foot[2]], founded: true },
		{ id: head, position: [...well.axis, access[access.length - 1].head[2]] }
	);
	rods.push({ id: id + '/newel', from: base, to: head, radius: well.inner, action: 'strut' });
}

function point(well: SpiralWell, index: number, radius: number): XY {
	const angle = (index % SIDES) * ANGLE;
	return [well.axis[0] + radius * Math.cos(angle), well.axis[1] + radius * Math.sin(angle)];
}
function ringAt(well: SpiralWell, radius: number) {
	return Array.from({ length: SIDES }, (_, i) => point(well, i, radius));
}

/** Sets holes and enlarges open decks in place. Returns ascending runs from the sampled ground. */
export function spiralAccess(
	ring: XY[],
	platforms: Platform[],
	ground: number,
	kind: 'spiral' | 'stair',
	groundAt?: (x: number, y: number) => number
): Access[] {
	if (!platforms.length) return [];
	const well = kind === 'spiral' ? clearBay(ring) : roomWell(platforms[platforms.length - 1]);
	const hole = ringAt(well, well.outer);
	const lip = ringAt(well, well.outer / 0.8);
	let start = 0;
	if (groundAt) {
		// Start on the downhill side, where the first flight emerges above the carrier.
		for (let i = 1; i < SIDES; i++)
			if (groundAt(...point(well, i, well.walk)) < groundAt(...point(well, start, well.walk)))
				start = i;
	}
	const entry = groundAt?.(...point(well, start, well.walk)) ?? ground;
	return platforms.map((platform, i) => {
		platform.holes = [hole];
		if (kind === 'spiral')
			platform.outline = convexHull([...platform.outline, ...lip]).map(([x, y]) => [x, y]);
		const z = i ? platforms[i - 1].datum : entry;
		const rise = platform.datum - z;
		let steps = Math.max(1, Math.round(rise / houseStair.rise));
		let approach = 0;
		// A short plinth sometimes admits no whole number of standard risers. Take the
		// residual rise on an inclined entry before the first full tread.
		if (Math.abs(rise / steps - houseStair.rise) >= RISER_DEVIATION) {
			steps = Math.floor(rise / houseStair.rise);
			approach = Math.max(0, rise - steps * (houseStair.rise + RAMP_RISER_ALLOWANCE));
		}
		const going = 2 * well.walk * Math.sin(ANGLE / 2);
		const rampSectors = Math.ceil(approach / (going * APPROACH_GRADE));
		const spiral = { well, start, steps, approach, rampSectors };
		const foot: Vec3 = [...point(well, start, well.walk), z];
		start += rampSectors + steps + Math.max(0, Math.floor((steps - 1) / RISERS_PER_FLIGHT)) + 1;
		return {
			id: platform.id + '/access',
			kind,
			to: platform.id,
			...(i ? { from: platforms[i - 1].id } : {}),
			foot,
			head: [...point(well, start, well.walk), platform.datum],
			landing: [...point(well, start, well.outer), platform.datum],
			spiral
		};
	});
}

/** Expands one surveyed run into ascending tread sectors, including level rests on long climbs. */
export function spiralSteps(run: Access) {
	if (!run.spiral) return [];
	const { well, start, steps, approach, rampSectors } = run.spiral;
	let station = start;
	const sector = (lower: number, upper: number, kind: 'ramp' | 'stairs' | 'landing') => {
		const i = station++;

		const from: Vec3 = [...point(well, i, well.walk), lower];
		const to: Vec3 = [...point(well, i + 1, well.walk), upper];
		const polygon = [
			point(well, i, well.inner),
			point(well, i, well.outer),
			point(well, i + 1, well.outer),
			point(well, i + 1, well.inner)
		];
		return {
			id: run.id + '/stair/' + i,
			first: i % SIDES,
			last: (i + 1) % SIDES,
			from,
			to,
			polygon,
			kind
		};
	};
	const ramps = Array.from({ length: rampSectors }, (_, i) =>
		sector(
			run.foot[2] + (approach * i) / rampSectors,
			run.foot[2] + (approach * (i + 1)) / rampSectors,
			'ramp'
		)
	);
	const rise = (run.head[2] - run.foot[2] - approach) / Math.max(1, steps);
	const height = (n: number) => (n === steps ? run.head[2] : run.foot[2] + approach + n * rise);
	const tread = (a: number, b: number) =>
		sector(height(a), height(b), a === b ? 'landing' : 'stairs');
	const treads = Array.from({ length: steps }, (_, i) =>
		i && i % RISERS_PER_FLIGHT === 0 ? [tread(i, i), tread(i, i + 1)] : [tread(i, i + 1)]
	).flat();
	return [...ramps, ...treads, tread(steps, steps)];
}
