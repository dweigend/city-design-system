import type { HouseSlot } from '../composed-house';
import { STORY } from '../../data/grid';
import { arrange, disc } from './figure';
import { collapse } from './collapse';
import { bodySpec, objectSlot, worldSize } from './objects';
import type { Typology } from './families';

import type { Body, Level, Point, Plan } from './types';

function offset(type: Typology, i: number, n: number) {
	switch (type) {
		case 'terrace-house':
			return (i / (n - 1 || 1) - 0.5) * 1.25;
		case 'cluster-mast':
			return 0.625 * Math.cos((i * Math.PI) / 2);
		case 'tree-house':
			return [-0.625, 0, 0.625][i % 3];
		case 'capsule-stack':
		case 'plinth-house':
		case 'slab-house':
			return ((i % 2) - 0.5) * 1.25;
		default:
			return 0;
	}
}
function programme(plan: Plan, i: number) {
	const { site, type, seed } = plan,
		paint = site.programme[i];
	const domain = site.living.has(i) ? ['living' as const] : [...new Set(paint)];
	const use = collapse(
		site.id + '/part/use/' + i,
		seed,
		type,
		domain.map((u) => [u, paint.filter((p) => p === u).length])
	);
	const run = Math.max(site.width, site.depth);
	const length = Number(
		collapse(site.id + '/part/bay/' + i, seed, type, [
			['5', type === 'round-tower' && run >= 8.1 ? 0 : 1],
			['7.5', run >= 8.1 ? 3 : 0],
			['10', run >= 10.6 ? 4 : 0]
		])
	);
	const spin = type === 'cluster-mast' ? i : 0;
	const rotation =
		((((site.depth > site.width && type !== 'round-tower' ? 1 : 0) + spin) % 4) * Math.PI) / 2;
	return { use, length, rotation };
}
function count(plan: Plan, i: number, body: Body) {
	const { site, type, seed } = plan;
	const [w, d] = worldSize(body),
		small = (w * d) / ((w + 0.6) * (d + 1.55)) < 0.55;
	if (type === 'round-tower') return body.kind === 'capsule' ? 2 : 1;
	if (type === 'lattice-head' && i === site.programme.length - 1) return 2;
	if (small || type === 'twin-stack' || type === 'rack') return 2;
	if (type === 'bell-house' || type === 'courtyard-house') return 1;
	const max = site.cells.length > 1 || body.kind === 'capsule';
	return Number(
		collapse(site.id + '/part/count/' + i, seed, type, [
			['1', 2],
			['2', max ? 1 : 0]
		])
	);
}
function bodies(plan: Plan, i: number, z: number) {
	const { site, type, sign, seed, rear } = plan;
	const { use, length, rotation } = programme(plan, i);
	const id = site.id + '/level/' + i;
	const spec = bodySpec(
		type,
		use,
		length,
		type === 'bell-house' && site.programme.length === 1 ? 1 : i
	);
	const first = objectSlot(
		id + '/0',
		spec,
		use,
		seed,
		rotation,
		use === 'living' ? length : undefined
	);
	const n = count(plan, i, first),
		out: Body[] = [];
	const dx = offset(type, i, site.programme.length);
	for (let j = 0; j < n; j++) {
		const garden = type === 'rack' && j === 1 && i % 2 === 0;
		const b = garden
			? objectSlot(id + '/' + j, ['grove-island', 'extended', 'grove'], 'food', seed, rotation)
			: { ...first, id: id + '/' + j };
		const d = worldSize(b)[1];
		const used =
			out.reduce((sum, other) => sum + worldSize(other)[1], 0) +
			(type === 'twin-stack' ? 0.3 * j : 0);
		b.position = [site.center[0] + dx, rear - sign * (1.25 + used + d / 2), z + 0.12];
		b.facing = [0, sign];
		out.push(b);
	}
	if (Math.abs(Math.sin(rotation)) > 0.5 && out.length > 1) {
		let edge = site.center[0] + dx - out.reduce((sum, b) => sum + worldSize(b)[0], 0) / 2;
		for (const b of out) {
			const [w, d] = worldSize(b);
			b.position = [edge + w / 2, rear - sign * (1.25 + d / 2), z + 0.12];
			edge += w;
		}
	}
	return out;
}
function tierKind(kind: HouseSlot['kind']): Level['kind'] {
	if (kind === 'reservoir') return 'rack';
	if (
		kind === 'capsule' ||
		kind === 'solar' ||
		kind === 'grove' ||
		kind === 'dome' ||
		kind === 'lookout'
	)
		return kind;
	return 'workshop';
}
/** Places occupied decks inward from one continuous landing line. */
function planLevel(plan: Plan, i: number): Level {
	const { site, datum, sign, rear } = plan,
		z = datum + i * STORY;
	const row = arrange(plan, bodies(plan, i, z));
	const extents = (axis: 0 | 1, side: number) =>
		row.map((b) => b.position[axis] + (side * worldSize(b)[axis]) / 2);
	const left = Math.min(...extents(0, -1)),
		right = Math.max(...extents(0, 1));
	const inner = sign > 0 ? Math.min(...extents(1, -1)) : Math.max(...extents(1, 1));
	const w = right - left + 0.6,
		d = Math.abs(rear - inner) + 0.3;
	const x = (right + left) / 2,
		y = rear - (sign * d) / 2;
	const outline: Point[] = [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1]
	].map(([a, b]) => [x + (a * w) / 2, y + (b * d) / 2, z]);
	const level: Level = {
		position: [x, y, z],
		width: w,
		depth: d,
		round: false,
		deckArea: w * d,
		outline,
		programme: site.programme[i],
		use: row[0].use,
		kind: tierKind(row[0].kind),
		bodies: row,
		landing: [x, rear - sign * 0.625, z]
	};
	if (plan.type === 'courtyard-house') {
		const width = Math.max(0, Math.abs(row[0].size[0] - row[0].size[1]) - 0.6);
		level.court = { center: [x, y - sign * 0.475, z], width };
		level.deckArea -= width * width;
	}
	return plan.type === 'round-tower' ? disc(plan, level) : level;
}

/** Groups painted bands for the sparse towers, retaining every required living stack and the common entry datum. */
export function occupiedLevels(plan: Plan) {
	const { site, type } = plan,
		n = site.programme.length;
	const limit = type === 'deck-tower' ? 4 : type === 'bell-house' ? 2 : n;
	const indices = new Set(
		Array.from({ length: Math.min(limit, n) }, (_, i) =>
			Math.round((i * (n - 1)) / (Math.min(limit, n) - 1 || 1))
		)
	);
	for (const i of site.living) indices.add(i);
	if (site.programme.every((row) => row.every((u) => u === 'living')))
		for (let i = 0; i < n; i++) indices.add(i);
	const ordered = [...indices].sort((a, b) => a - b);
	return ordered.map((i, k) => ({
		...planLevel(plan, i),
		programme: site.programme.slice(i, ordered[k + 1] ?? n).flat()
	}));
}
