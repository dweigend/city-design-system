import { buildRoofFrame } from '../megastructure';
import { moduleGroup, type ModuleRod } from './module-group';
import { hash } from '../hash-random';
import type { Primitive, Vec3 } from '../parametrik/types';
import { kanal, kantenId } from '../traeger';
import type { Site } from './form';
import type { Mass } from './massing';
import { along, bayOf, mountingGrid, type Bay } from './megastructure-bay';
import { shellForms } from './style-totem';
import { guest } from './megastructure-guests';
import { access, gallery, supply } from './megastructure-services';
import { storiesOf } from './stacks';
import { STORY } from '../../data/grid';
import { BODY_TOKEN, HOUSE_FRAME } from '../../data/house-body';
import { insetRing, ringArea } from './outline';

const MEGASTRUCTURE_DEFAULTS = { emptyShare: 0.25, galleryWidth: 0.075 };
const DRAW = { orientation: 21, occupancy: 22 };

function skeleton(
	b: Bay,
	posts: Set<string>,
	girders: Set<string>,
	brace: number,
	continued: ReadonlySet<string>
) {
	const members: Primitive[] = [];
	const strut = (points: Vec3[], detail = false): Primitive => ({
		...b.piece(`strut-${members.length}`, HOUSE_FRAME.token, { kind: 'polyline', points }),
		role: 'traeger',
		member: detail ? 'secondary' : 'primary',
		sectionDiameter: detail ? HOUSE_FRAME.secondary : HOUSE_FRAME.primary,
		detail
	});
	b.cell.vertexIds.forEach((id, i) => {
		const top = along(b, i, 0, 0, 1);
		if (!posts.has(id)) {
			posts.add(id);
			const foot = along(b, i, 0, 0, 0);
			if (b.level === 0) foot[2] = Math.min(foot[2], b.cell.corners[i][2]);
			const end: Vec3 = [top[0], top[1], top[2] + (continued.has(id) ? 0 : 1.2)];
			members.push({ ...strut([foot, end]), bearings: [foot] });
		}
		const edge = kantenId(id, b.cell.vertexIds[(i + 1) % 4]);
		if (!girders.has(edge)) {
			girders.add(edge);
			members.push(strut([top, along(b, i, 1, 0, 1)]));
		}
	});
	members.push(strut([along(b, brace, 0, 0, 0), along(b, brace, 1, 0, 1)], true));
	return members;
}

function drawer(b: Bay, token: Primitive['token']): Primitive {
	const corners = [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, 1]
	].map(([u, v]): [number, number] => {
		const [x, y] = b.point(u, v, 0);
		return [x, y];
	});
	if (ringArea(corners) < 0) corners.reverse();
	return {
		...b.piece('body', token, {
			kind: 'prism',
			polygon: insetRing(corners, 0.6),
			z: b.point(0, 0, 0)[2] + 0.4,
			height: 3,
			topToken: '--paper'
		}),
		material: 'concrete',
		envelope: true,
		shade: 0
	};
}

/** A bolted carrier follows each painted story. Its infill can be removed bay by bay. */
export function megastructureMass(
	site: Site,
	mass: Mass,
	p = MEGASTRUCTURE_DEFAULTS,
	accessFlight: 'own' | 'shared' = 'own'
): Primitive[] {
	const posts = new Set<string>(),
		girders = new Set<string>();
	const cornersOf = mountingGrid(mass);
	const members = new Set(mass.stories.map((s) => s.cell.id));
	const seed = kanal(site.seed, 'raumfachwerk', mass.id, 'scaffold');
	const bays = mass.stories.map((story, i) => {
		const b = bayOf(mass, story, cornersOf(story.cell));
		const key = kanal(seed, 'raumfachwerk', b.cell.id, 'guest');
		const side = Math.floor(4 * hash(seed, key, DRAW.orientation));
		return {
			b,
			side,
			occupied: i === 0 || hash(seed, key, DRAW.occupancy) > p.emptyShare,
			top: storiesOf(site.stacks, b.cell.id).length === b.level + 1
		};
	});
	if (bays.length >= 4 && bays.every((bay) => bay.occupied)) bays[bays.length - 1].occupied = false;
	const roof = bays.find((bay) => bay.top && bay.occupied);
	const continued = new Set(bays.filter(({ top }) => !top).flatMap(({ b }) => b.cell.vertexIds));
	return bays.flatMap((bay, i) => {
		const { b, side, occupied } = bay;
		const exterior = b.cell.neighbors.flatMap((id, i) =>
			id === null || !members.has(id) ? [i] : []
		);
		const parts = skeleton(b, posts, girders, side, continued);
		if (occupied) parts.push(drawer(b, BODY_TOKEN[mass.use]));
		if (bay === roof) parts.push(...guest(b, mass.use, side, true, STORY));

		const route = exterior.at(side % exterior.length);
		if (i === 0 && route !== undefined) {
			parts.push(...gallery(b, route, p.galleryWidth));
			if (accessFlight === 'own') parts.push(...access(b, route));
			parts.push(supply(b, route, BODY_TOKEN[mass.use]));
		}
		return parts;
	});
}

/** Draws a surveyed steel member with its solved physical section and Leitstil stroke. */
export function carrierForm(id: string, rod: ModuleRod, main: boolean): Primitive {
	return {
		id,
		role: 'traeger',
		legacyRole: 'neu',
		token: HOUSE_FRAME.token,
		material: 'metal',
		kind: 'pipe',
		points: [rod.a, rod.b],
		radius: rod.radius,
		member: main ? 'primary' : 'secondary',
		edges: false
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
