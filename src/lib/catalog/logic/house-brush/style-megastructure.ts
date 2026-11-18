import { hash } from '../hash-random';
import type { Primitive, Vec3 } from '../parametrik/types';
import { kanal, kantenId } from '../traeger';
import type { Site } from './form';
import type { Mass } from './massing';
import { along, bayOf, mountingGrid, type Bay } from './megastructure-bay';
import { aerostat, guest } from './megastructure-guests';
import { access, gallery } from './megastructure-services';
import { storiesOf } from './stacks';

const DRAW = { orientation: 21, occupancy: 22 };

/** Square-section steel for uprights and level girders carries a plain cut edge. */
function strut(bay: Bay, from: Vec3, to: Vec3, id: string) {
	const half = bay.gauge * 0.1;
	const dx = to[0] - from[0],
		dy = to[1] - from[1],
		length = Math.hypot(dx, dy);
	if (!length)
		return bay.piece(id, '--signal', {
			kind: 'box',
			position: [from[0] - half, from[1] - half, from[2]],
			size: [2 * half, 2 * half, to[2] - from[2]]
		});
	if (from[2] !== to[2])
		return bay.piece(id, '--signal', { kind: 'pipe', points: [from, to], radius: half * 0.75 });
	const nx = (-dy / length) * half,
		ny = (dx / length) * half;
	return bay.piece(id, '--signal', {
		kind: 'prism',
		polygon: [
			[from[0] - nx, from[1] - ny],
			[to[0] - nx, to[1] - ny],
			[to[0] + nx, to[1] + ny],
			[from[0] + nx, from[1] + ny]
		],
		z: from[2] - half,
		height: 2 * half
	});
}

/** One post per shared vertex and one girder per shared side at this level. */
function skeleton(b: Bay, posts: Set<string>, girders: Set<string>, brace: number) {
	const parts: Primitive[] = [],
		members: [Vec3, Vec3][] = [];
	b.cell.vertexIds.forEach((id, i) => {
		const top = along(b, i, 0, 0, 1);
		if (!posts.has(id)) {
			posts.add(id);
			const foot = along(b, i, 0, 0, 0);
			if (b.level === 0) foot[2] = Math.min(foot[2], b.cell.corners[i][2]);
			members.push([foot, top]);
			parts.push(
				b.piece(`coupler-${i}`, '--signal', {
					kind: 'sphere',
					position: top,
					radius: b.gauge * 0.19
				})
			);
		}
		const edge = kantenId(id, b.cell.vertexIds[(i + 1) % 4]);
		if (!girders.has(edge)) {
			girders.add(edge);
			members.push([top, along(b, i, 1, 0, 1)]);
		}
	});
	members.push(
		[along(b, brace, 0, 0, 0), along(b, brace, 1, 0, 1)],
		[b.point(0, 0, 1), b.point(1, 1, 1)]
	);
	return [...parts, ...members.map(([from, to], i) => strut(b, from, to, `strut-${i}`))];
}

/** A bolted carrier follows each painted story. Its infill can be removed bay by bay. */
export function megastructureMass(site: Site, mass: Mass): Primitive[] {
	const posts = new Set<string>(),
		girders = new Set<string>();
	const cornersOf = mountingGrid(mass);
	const members = new Set(mass.stories.map((s) => s.cell.id));
	const anchor = mass.stories[0];
	const seed = kanal(site.seed, 'raumfachwerk', mass.id, 'scaffold');
	const roof = mass.stories.find((s) => storiesOf(site.stacks, s.cell.id).length === s.level + 1);
	return mass.stories.flatMap((story) => {
		const b = bayOf(mass, story, cornersOf(story.cell));
		const key = kanal(seed, 'raumfachwerk', b.cell.id, 'guest');
		const side = Math.floor(4 * hash(seed, key, DRAW.orientation));
		const exterior = b.cell.neighbors.flatMap((id, i) =>
			id === null || !members.has(id) ? [i] : []
		);
		const parts = skeleton(b, posts, girders, side);
		if (story === anchor || hash(seed, key, DRAW.occupancy) > 0.35)
			parts.push(...guest(b, mass.use, side, story === roof));
		for (const i of exterior) parts.push(...gallery(b, i));
		if (story === anchor && exterior.length)
			parts.push(...access(b, exterior[side % exterior.length]));
		if (story === roof && mass.use === 'living' && story.level >= 1) parts.push(...aerostat(b));
		return parts;
	});
}
