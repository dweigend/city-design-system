import { fitPlinthStock } from './plinth-stock';
import { fitBlock, baseFor } from './block-fit';
import { blockOutline } from './block-outline';
import { STORY } from '../../data/grid';
import { corners } from './bands';
import { mounted, objectSlot, solid } from './objects';
import type { Body, Level, Plan, Point, Solid } from './types';

const rim = 0.16;
/** One closed body spans each group of painted floors, leaving a rear access ledge. */
export function blockLevel(plan: Plan, i: number, use: Body['use']): Level {
	const { site, sign, rear } = plan;
	const [x, y] = site.center;
	const base = baseFor(plan);
	const z = site.ground + (i ? i * STORY : base.height);
	const end =
		i || site.programme.length <= 2 ? site.programme.length : Math.ceil(site.programme.length / 2);
	const w = (base.w - 0.1) * (i ? 0.985 : 1);
	const d = base.d - 0.1;
	const body = objectSlot(
		site.id + '/level/' + i + '/body/0',
		'cantilever',
		['primitive-slab', 'rounded', 'workshop'],
		use,
		plan.seed,
		0
	);
	body.size = [w, d, site.ground + Math.max(6, end * STORY) - rim - z];
	body.position = [x + (i ? ((plan.seed % 2 ? 1 : -1) * (base.w - 0.1 - w)) / 2 : 0), y, z];
	body.band = { shell: Boolean(i), wellX: x };
	fitBlock(body, plan);
	body.facing = [0, sign];
	const position: Point = [x, y, z];
	return {
		bodies: [body],
		position,
		width: site.width,
		depth: site.depth,
		outline: corners(position, site.width, site.depth),
		deckArea: site.width * site.depth,
		round: false,
		kind: 'workshop',
		use,
		programme: site.programme[i],
		landing: [x, rear - sign * 0.72, z]
	};
}

function walkingPlate(
	plan: Plan,
	name: string,
	structuralRole: Solid['structuralRole'],
	z: number,
	h: number,
	dims: [number, number],
	exterior: boolean,
	shift = 0
): Solid {
	const [x, y] = plan.site.center;
	const { ground, id } = plan.site;
	const [w, d] = dims;
	const plate = solid(
		id + '/' + name,
		structuralRole,
		'deck',
		[x, y + shift, z],
		[w, d, h],
		ground,
		z === ground ? 'base' : 'deck'
	);
	const polygon = blockOutline(
		[x, y + shift, z],
		w,
		d,
		plan.sign,
		exterior ? undefined : { x, halfWidth: 0.58, depth: 0.76 }
	);
	return { ...plate, kind: 'prism', polygon, z, height: h };
}
/** Largest uniform factor that keeps a centred rectangle inside a convex parcel ring. */
function parcelFactor(
	ring: readonly (readonly number[])[],
	x: number,
	y: number,
	w: number,
	d: number
) {
	return ring.reduce((factor, [u, v], i) => {
		const [a, b] = ring[(i + 1) % ring.length],
			dx = a - u,
			dy = b - v;
		const clear = dx * (y - v) - dy * (x - u),
			reach = (Math.abs(dx) * d + Math.abs(dy) * w) / 2;
		return Math.min(factor, reach > 1e-9 ? clear / reach : 1);
	}, 1);
}
/** A footprint of several cells is bounded by its surveyed bay rectangle. */
function bayPlinth(plan: Plan, dims: [number, number], shift: number) {
	const { width, depth } = plan.site;
	const inside: [number, number] = [Math.min(dims[0], width), Math.min(dims[1], depth)];
	const play = (depth - inside[1]) / 2;
	return { inside, seated: Math.max(-play, Math.min(play, shift)) };
}
/** A single parcel is bounded by its real outline: shrink about the seat until every corner fits. */
function parcelPlinth(plan: Plan, dims: [number, number], shift: number) {
	const { cells, center } = plan.site;
	const ring = cells[0].corners;
	const factor = parcelFactor(ring, center[0], center[1] + shift, ...dims);
	if (factor >= 1) return { inside: dims, seated: shift };
	// A seat outside the parcel cannot be saved by shrinking: use the parcel centre instead.
	const seated = factor > 0.2 ? shift : 0;
	const fit = seated ? factor : parcelFactor(ring, center[0], center[1], ...dims);
	const inside: [number, number] = [dims[0] * fit - 0.02, dims[1] * fit - 0.02];
	return { inside, seated };
}
/** The plinth is bearing ground and never leaves the plot. Bodies and decks above may cantilever
 * over its edge. */
function bearingPlate(
	name: string,
	z: number,
	plan: Plan,
	height: number,
	dims: [number, number],
	exterior: boolean,
	shift: number
) {
	const single = plan.site.cells.length === 1 && plan.site.cells[0].corners.length === 4;
	const { inside, seated } = single
		? parcelPlinth(plan, dims, shift)
		: bayPlinth(plan, dims, shift);
	return walkingPlate(plan, name, 'bearing', z, height, inside, exterior, seated);
}
/** The plinth, intermediate rim and roof cap carry the stack by direct contact. */
export function blockAssembly(plan: Plan, levels: Level[]) {
	const { site } = plan,
		[x, y] = site.center;
	const base = baseFor(plan);
	const exterior = levels.some((l) => l.bodies[0].band?.modules);
	const dims: [number, number] = [0, 1].map((k) =>
		Math.max(
			(exterior ? [base.w, base.d] : [site.width, site.depth])[k],
			...levels.map((l) => l.bodies[0].size[k] + 0.1)
		)
	) as [number, number];
	dims[0] = Math.min(dims[0], site.width + 1.2);
	const low = Math.min(
		y - dims[1] / 2,
		...levels.map((l) => l.bodies[0].position[1] - l.bodies[0].size[1] / 2)
	);
	const high = Math.max(
		y + dims[1] / 2,
		...levels.map((l) => l.bodies[0].position[1] + l.bodies[0].size[1] / 2)
	);
	const shift = (high + low) / 2 - y;
	dims[1] = high - low;
	const plate = bearingPlate('plinth', site.ground, plan, base.height, dims, exterior, shift);
	const parts: Solid[] = [exterior ? fitPlinthStock(plate) : plate];
	for (const [i, l] of levels.entries()) {
		const b = l.bodies[0];
		if (i)
			parts.push(
				bearingPlate('level/' + i + '/deck', l.position[2] - rim, plan, rim, dims, exterior, shift)
			);
		parts.push(solid(b.id, 'cantilever', 'body', b.position, b.size, site.ground, b.use));
	}
	const upper = levels[levels.length - 1].bodies[0];
	const roofBase = upper.position[2] + upper.size[2];
	const longCap =
		site.programme.length <= 4 &&
		!upper.band?.modules &&
		roofBase + rim + 1 - site.ground <=
			Math.max(6, Math.max(upper.size[0], upper.size[1]) / 0.6) + 1e-7;
	const z = Math.max(roofBase + rim, site.ground + 6 - (longCap ? 1 : 0.5));
	const attic = z - rim - roofBase;
	if (upper.band?.modules && attic >= 0.12) {
		const [w, d] = upper.size;
		const envelope = solid(
			upper.id + '/' + upper.objectId + '/attic',
			'cantilever',
			'attic',
			[upper.position[0], upper.position[1], roofBase],
			[w, d, attic],
			site.ground,
			upper.band.shell ? 'shell' : upper.use
		);
		parts.push({
			...envelope,
			kind: 'prism',
			polygon: blockOutline(upper.position, w, d, plan.sign, undefined, true),
			z: roofBase,
			height: attic
		});
		parts.push(walkingPlate(plan, 'roof-walk', 'cantilever', z - rim, rim, dims, exterior, shift));
	} else
		parts.push(
			walkingPlate(plan, 'roof-walk', 'cantilever', roofBase, z - roofBase, dims, exterior, shift)
		);
	const crown = objectSlot(
		site.id + '/crown',
		'cantilever',
		['primitive-dome', longCap ? 'long' : 'short', 'dome'],
		levels[levels.length - 1].use,
		plan.seed,
		0
	);
	crown.anchor = 'roof';
	crown.position = [x, y, z];
	parts.push(mounted(crown, site.ground, 'crown'));
	return { parts, crown, fittings: [] };
}
