import { buildRoofFrame } from '../megastructure';
import { moduleGroup, type ModuleRod } from './module-group';
import { hash } from '../hash-random';
import type { Primitive, Vec3 } from '../parametrik/types';
import { kanal, kantenId } from '../traeger';
import type { Site } from './form';
import type { Mass } from './massing';
import { along, bayOf, mountingGrid, type Bay } from './megastructure-bay';
import { shellForms, dockedModule } from './style-totem';
import { guest } from './megastructure-guests';
import { access, gallery } from './megastructure-services';
import { storiesOf } from './stacks';

const MEGASTRUCTURE_DEFAULTS = { emptyShare: 0.16, galleryWidth: 0.075 };
const DRAW = { orientation: 21, occupancy: 22 };

// Keep half the shared primary members, alternating posts and girders on successive pairs.
function memberOf(i: number, primaryCount: number): Primitive['member'] {
	if (i >= primaryCount) return i === primaryCount ? 'secondary' : 'alternate';
	return i % 4 === 0 || i % 4 === 3 || (primaryCount % 2 === 1 && i === primaryCount - 1)
		? undefined
		: 'alternate';
}

/** One post per shared vertex and one girder per shared side at this level. */
function skeleton(b: Bay, posts: Set<string>, girders: Set<string>, brace: number) {
	const members: [Vec3, Vec3][] = [];
	const feet = new Set<Vec3>();
	b.cell.vertexIds.forEach((id, i) => {
		const top = along(b, i, 0, 0, 1);
		if (!posts.has(id)) {
			posts.add(id);
			const foot = along(b, i, 0, 0, 0);
			if (b.level === 0) foot[2] = Math.min(foot[2], b.cell.corners[i][2]);
			members.push([foot, top]);
			feet.add(foot);
		}
		const edge = kantenId(id, b.cell.vertexIds[(i + 1) % 4]);
		if (!girders.has(edge)) {
			girders.add(edge);
			members.push([top, along(b, i, 1, 0, 1)]);
		}
	});
	const primaryCount = members.length;
	members.push(
		[along(b, brace, 0, 0, 0), along(b, brace, 1, 0, 1)],
		[b.point(0, 0, 1), b.point(1, 1, 1)]
	);
	return members.map(([from, to], i): Primitive => ({
		...b.piece(`strut-${i}`, '--paper', { kind: 'polyline', points: [from, to] }),
		role: 'traeger',
		member: memberOf(i, primaryCount),
		...(feet.has(from) ? { bearings: [from] } : {})
	}));
}

/** A bolted carrier follows each painted story. Its infill can be removed bay by bay. */
export function megastructureMass(site: Site, mass: Mass, p = MEGASTRUCTURE_DEFAULTS): Primitive[] {
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
		if (story === anchor || hash(seed, key, DRAW.occupancy) > p.emptyShare)
			parts.push(...dockedModule(b, side), ...guest(b, mass.use, side, story === roof));
		const route = exterior.at(side % exterior.length);
		if (story === anchor && route !== undefined)
			parts.push(...gallery(b, route, p.galleryWidth), ...access(b, route));
		return parts;
	});
}

/** Draws a surveyed steel member with its solved physical section and Leitstil stroke. */
export function carrierForm(id: string, rod: ModuleRod, main: boolean): Primitive {
	return {
		id,
		role: 'traeger',
		legacyRole: 'neu',
		token: '--paper',
		material: 'metal',
		kind: 'pipe',
		points: [rod.a, rod.b],
		radius: rod.radius,
		member: main ? 'primary' : 'secondary',
		edges: false,
		shade: 1
	};
}

/** Survey used by both infrastructure styles on the standalone house brush plates. */
export function surveyedMass(mass: Mass, withModules: boolean, seed: number): Primitive[] {
	const roofs = mass.stories.map(({ cell }) => ({
		id: cell.id,
		height: mass.floor,
		polygon: cell.corners.map(([x, y]): [number, number] => [x, y])
	}));
	const result = buildRoofFrame(roofs, { clearance: 4 }, 'leitstil');
	if (result.status !== 'assembled') return [];
	const rods = result.frame.rods.map((r) => ({
		cellId: r.a.roofId,
		a: r.a.p,
		b: r.b.p,
		radius: r.radius,
		main: r.main
	}));
	const parts = rods.map((r, i) => carrierForm(mass.id + '/rod/' + i, r, r.main));
	if (withModules) {
		const group = moduleGroup(
			rods,
			rods.filter((r) => r.main && r.a[2] === r.b[2]),
			mass.use,
			[],
			1.5,
			{ seed, cell: (r) => r.cellId }
		);
		group?.forEach(({ recipe, seat }, i) =>
			parts.push(...shellForms(mass.id + '/module/' + i, recipe, seat))
		);
	}
	return parts;
}
