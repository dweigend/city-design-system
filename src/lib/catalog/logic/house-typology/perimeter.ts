import { required } from '../required';
import { roomOnDeck } from './deck-outline';
import { prismFaces } from './prism';
import { partyFaces } from './party-faces';
import { serviceGallery } from './service-gallery';
import { convexHull } from '../parzelle';
import { wingRim, type UpperWing } from './upper-wings';
import {
	entranceCell,
	entranceRooms,
	entranceWidth,
	landingDepth,
	approachDepth
} from './entrance';
import { courseDatums, groundCourse } from './course-datums';
import { houseEnvelope } from './envelope';
import { parcelSection, parcelExterior, roomLining } from './parcel-section';
import { galleryPlot } from './gallery';
import { corners } from './bands';
import { boundaryRuns, ringArea, type QuadCell } from '../quad-grid';
import { crownSpec, objectSlot, solid, mounted } from './objects';
import { footprintBay } from './footprint';
import { terraceLife } from './terrace-life';
import { silhouette } from './signature';
import type { EnsembleContext } from './ensemble-context';
import type { HouseRole } from './families';
import type { Body, HouseComposition, Level, Plan, Solid } from './types';

type XY = [number, number];
type Shape = NonNullable<NonNullable<Body['band']>['footprint']>;
const rim = 0.16;
function rectangle(x: number, y: number, w: number, d: number): XY[] {
	return corners([x, y, 0], w, d).map(([u, v]) => [u, v]);
}
function parcel(cells: readonly QuadCell[]) {
	const ids = new Set(cells.map((c) => c.id));
	const plots = boundaryRuns(cells, (id) => ids.has(id))
		.map((run) => ({
			ring: run.map(({ from: [x, y] }): XY => [x, y]),
			run
		}))
		.sort((a, b) => ringArea(b.ring) - ringArea(a.ring));
	const [outer, ...courts] = plots;
	const centres = new Map(cells.map((cell) => [cell.id, cell.center]));
	const courtWalls = courts.flatMap(({ run }) =>
		run.map(({ from, to, cellId }) => ({
			a: [from[0], from[1]] as XY,
			b: [to[0], to[1]] as XY,
			centre: required(centres.get(cellId), 'courtyard cell')
		}))
	);
	return { polygon: outer.ring, holes: courts.map((p) => p.ring), courtWalls };
}
function extent(shape: Shape) {
	const span = (axis: number) => {
		const values = shape.polygon.map((p) => p[axis]);
		const low = Math.min(...values),
			high = Math.max(...values);
		return { center: (low + high) / 2, length: high - low };
	};
	return [span(0), span(1)];
}
function plate(
	id: string,
	shape: Shape,
	z: number,
	height: number,
	ground: number,
	slot: string
): Solid {
	const [x, y] = extent(shape);
	return {
		...solid(
			id,
			'bearing',
			'deck',
			[x.center, y.center, z],
			[x.length, y.length, height],
			ground,
			slot
		),
		...shape,
		kind: 'prism',
		z,
		height
	};
}
function makeBody(
	plan: Plan,
	id: string,
	shape: Shape,
	z: number,
	height: number,
	floor: number,
	spanning = false
): Body {
	const [x, y] = extent(shape);
	const use = plan.site.programme[floor][0];
	const body = objectSlot(
		id,
		'bearing',
		['primitive-slab', 'rounded', 'workshop'],
		use,
		plan.seed,
		0
	);
	return {
		...body,
		position: [x.center, y.center, z],
		size: [x.length, y.length, height],
		band: {
			shell: floor % 2 === 1,
			footprint: shape,
			lining: spanning ? shape.polygon : roomLining(shape)
		}
	};
}
function bodySolid(body: Body, shape: Shape, ground: number): Solid {
	return {
		...solid(body.id, 'bearing', 'body', body.position, body.size, ground, body.use),
		kind: 'prism',
		...shape,
		z: body.position[2],
		height: body.size[2]
	};
}
function accessBay(plan: Plan, frontage: ReadonlySet<string>) {
	const anchor = entranceCell(plan.site.cells, frontage, plan.sign),
		bay = frontage.size ? footprintBay([anchor]) : footprintBay(plan.site.cells);
	const axis: XY = [bay.x, bay.y + plan.sign * Math.min(bay.depth * 0.2, 1.4)];
	const opening = rectangle(...axis, entranceWidth, 0.82);
	return { anchor, bay, axis, opening };
}
function courseShapes(plan: Plan, frontage: ReadonlySet<string>, wing?: UpperWing) {
	const access = accessBay(plan, frontage),
		{ axis, opening } = access;
	const { cells, id } = plan.site;
	const envelope = houseEnvelope(id, plan.seed, plan.site.envelope);
	const plot = parcel(cells);
	const full = { polygon: plot.polygon, holes: [...plot.holes, opening] };
	const span = galleryPlot(cells, frontage, access.anchor);
	const bridge = { ...span, holes: [...span.holes, opening] };
	// The stair clearance fixes the inside of the pier. Its outer faces inherit the bearing parcel.
	const reduced = access.anchor.corners.map(([x, y]): XY => [
		axis[0] + (x - axis[0]) * 0.46,
		axis[1] + (y - axis[1]) * 0.46
	]);
	const pier = {
		polygon: convexHull([...reduced, ...opening]).map(([x, y]): XY => [x, y]),
		holes: [opening]
	};
	if (wing && cells.length === 1) pier.polygon = wingRim(cells[0], wing.abutments, pier.polygon);
	const wingShape =
		wing && cells.length === 1
			? { polygon: wingRim(cells[0], wing.walls, pier.polygon), holes: [opening] }
			: bridge;
	const groundRooms = (depth: number) =>
		cells.flatMap((c) =>
			!frontage.size || c === access.anchor
				? entranceRooms(c, axis, plan.sign, depth)
				: [{ polygon: c.corners.map(([x, y]): XY => [x, y]), holes: [] }]
		);
	return {
		access,
		axis,
		opening,
		plot,
		full,
		bridge,
		pier,
		wingShape,
		rooms: groundRooms(approachDepth),
		foundation: groundRooms(landingDepth),
		envelope,
		joined: frontage.size > 0
	};
}
type CourseShapes = ReturnType<typeof courseShapes>;
function floorOutline(
	plan: Plan,
	shapes: CourseShapes,
	i: number,
	gallery: boolean,
	turn: number,
	wing?: UpperWing
) {
	if (i + 1 === wing?.level) return shapes.pier;
	if (i === wing?.level) return shapes.wingShape;
	if (gallery) return shapes.bridge;
	if (shapes.joined && i < 2) return shapes.full;
	return parcelSection(
		shapes.plot,
		shapes.opening,
		shapes.envelope,
		i / Math.max(1, plan.site.programme.length - 1),
		i,
		turn
	);
}
function occupiedRooms(
	plan: Plan,
	shapes: CourseShapes,
	shape: Shape,
	floor: number,
	ceiling: number
) {
	if (floor === 0 && (shapes.joined || groundCourse(plan.site, ceiling).surveyed))
		return shapes.rooms;
	const system = shapes.envelope.system;
	if (system === 'service-risers' || system === 'helical-services')
		return [serviceGallery(shape, shapes.opening, plan.sign)];
	return [shape];
}
function floorBodies(
	plan: Plan,
	shapes: CourseShapes,
	shape: Shape,
	i: number,
	z: number,
	ceiling: number,
	gallery: boolean,
	parts: Solid[],
	wing?: UpperWing
) {
	const { pier, envelope } = shapes;
	const { cells, ground, id } = plan.site;
	const raised = i === 0 && wing?.level === 1;
	const baseTop = raised ? z + (ceiling - z) * 0.46 : ceiling - rim;
	const shells = occupiedRooms(plan, shapes, shape, i, ceiling);
	const bodies = shells.map((shell, k) => {
		const body = makeBody(
			plan,
			id + '/level/' + i + '/body/' + k,
			shell,
			z,
			baseTop - z,
			i,
			gallery || i === wing?.level
		);
		if (body.band && i >= 2) {
			body.band.cells = cells;
			body.band.finish = envelope.finish;
			if (!gallery) body.band.skin = envelope.skin;
		}
		parts.push(bodySolid(body, shell, ground));
		return body;
	});
	if (raised) {
		const upper = makeBody(
			plan,
			id + '/level/0/body/pier',
			pier,
			baseTop,
			ceiling - rim - baseTop,
			i
		);
		bodies.push(upper);
		parts.push(bodySolid(upper, pier, ground));
	}
	return bodies;
}
function courses(
	plan: Plan,
	frontage: ReadonlySet<string>,
	context: EnsembleContext,
	galleryCourse?: number,
	wing?: UpperWing
) {
	const shapes = courseShapes(plan, frontage, wing);
	const { access, axis, opening, plot, foundation, envelope } = shapes;
	const { cells, programme, ground, id } = plan.site;
	const datums = courseDatums(plan, context.seed, galleryCourse);
	const { seat, slab, surveyed } = groundCourse(plan.site, datums[1]);
	datums[0] = seat;
	const exterior = parcelExterior(
		plot,
		cells,
		opening,
		envelope,
		datums,
		partyFaces(cells, frontage, context.podiums, [seat, datums[Math.min(2, programme.length)]])
	);
	const parts: Solid[] = (surveyed ? shapes.rooms : foundation).map((room, k) =>
		plate(id + (k ? '/plinth/' + k : '/plinth'), room, seat, slab, seat, 'base')
	);
	const levels: Level[] = [];
	for (let i = 0; i < programme.length; i++) {
		const z = i ? datums[i] : seat + slab;
		const ceiling = datums[i + 1];
		const gallery = i === galleryCourse;
		const shape = floorOutline(plan, shapes, i, gallery, exterior.stations[i].turn, wing);
		const bodies = floorBodies(plan, shapes, shape, i, z, ceiling, gallery, parts, wing);
		const [x, y] = extent(shape),
			use = bodies[0].use;
		levels.push({
			position: [x.center, y.center, z],
			width: x.length,
			depth: y.length,
			round: false,
			kind: 'workshop',
			use,
			programme: programme[i],
			bodies,
			landing: [axis[0], axis[1] - plan.sign * landingDepth, z],
			deckArea:
				ringArea(shape.polygon) - shape.holes.reduce((a, h) => a + Math.abs(ringArea(h)), 0),
			outline: shape.polygon.map(([u, v]) => [u, v, z])
		});
		const name = i === programme.length - 1 ? 'roof-walk' : 'level/' + (i + 1) + '/deck';
		const deck =
			i === programme.length - 1 && !gallery && i !== wing?.level
				? { ...shape, polygon: exterior.stations[programme.length].ring }
				: shape;
		parts.push(plate(id + '/' + name, deck, ceiling - rim, rim, ground, 'deck'));
	}
	const top = datums[programme.length];
	return { levels, parts, access, envelope, top, exterior };
}
/** Returns the same bearing solids used by the composer, before placing roof furniture. */
export function bearingCourses(plan: Plan, context: EnsembleContext) {
	const decision = context.houses.get(plan.site.id);
	return courses(
		plan,
		decision?.frontage ?? new Set(),
		context,
		decision?.galleryCourse,
		decision?.upperWing
	);
}
function roofAnchor(roof: Extract<Solid, { kind: 'prism' }>, preferred: XY, crown: Body): XY {
	const { polygon, holes = [] } = roof;
	if (roomOnDeck(polygon, holes, ...preferred, 0, 0)) return preferred;
	const centres = prismFaces([polygon, ...holes]).map((face): XY => [
		face.reduce((sum, point) => sum + point[0], 0) / face.length,
		face.reduce((sum, point) => sum + point[1], 0) / face.length
	]);
	const distance = ([x, y]: XY) => Math.hypot(x - preferred[0], y - preferred[1]);
	centres.sort((a, b) => distance(a) - distance(b));
	return (
		centres.find((p) => roomOnDeck(polygon, holes, ...p, crown.size[0] / 2, crown.size[1] / 2)) ??
		centres[0] ??
		preferred
	);
}
/** Fits occupied party-wall courses, a common gallery and stepped upper bays to adjoining parcels. */
export function perimeterHouse(
	plan: Plan,
	role: HouseRole,
	accessSide: HouseComposition['accessSide'],
	context: EnsembleContext
): HouseComposition {
	const { site } = plan,
		{ levels, parts, access, envelope, top, exterior } = bearingCourses(plan, context);
	const { bay, axis } = access;
	const use = levels[levels.length - 1].use;
	const options = [
		crownSpec(use),
		crownSpec(use, true),
		['primitive-dome', 'short', 'dome'] as const
	];
	const crowns = options.map((spec) =>
		objectSlot(site.id + '/crown', 'cantilever', spec, use, plan.seed, 0)
	);
	const crown =
		crowns.find((c) => c.size[0] <= bay.width * 0.7 && c.size[1] <= bay.depth * 0.32) ??
		crowns[crowns.length - 1];
	const roof = parts[parts.length - 1];
	const preferred: XY = [bay.x, bay.y - plan.sign * Math.min(bay.depth * 0.2, 1.5)];
	const anchor = roof.kind === 'prism' ? roofAnchor(roof, preferred, crown) : preferred;
	crown.position = [...anchor, top];
	crown.anchor = 'roof';
	const sharedRoof = context.houses.get(site.id)?.roof;
	if (sharedRoof !== 'terrace') parts.push(mounted(crown, site.ground, 'crown'));
	return {
		id: site.id,
		ensembleSize: context.houses.size,
		shellUse: context.shellUse,
		exterior,
		sharedRoof,
		compact: true,
		flightWidth: 1.25,
		path: 'ladder',
		signature: silhouette(envelope),
		bay,
		start: site.start,
		stories: site.programme.length,
		role,
		typology: 'block',
		cells: site.cells,
		datum: plan.datum,
		ground: exterior.bottom,
		accessSide,
		family: { bar: 0.3, radius: 0.15, parapet: 'rail' },
		core: { position: [axis[0], axis[1], site.ground], width: entranceWidth },
		levels,
		parts,
		supports: [],
		crown,
		fittings: [],
		ports: [{ level: 0, position: levels[0].landing }],
		people: terraceLife(site, levels, parts, crown, plan.seed)
	};
}
