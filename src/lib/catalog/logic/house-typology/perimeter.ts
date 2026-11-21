import { climb } from '../house-structure';
import { required } from '../required';
import { podCourse } from './pod-course';
import { roofCrown } from './roof-crown';
import { partyFaces } from './party-faces';
import { serviceGallery } from './service-gallery';
import { convexHull } from '../parzelle';
import { wingRim, type UpperWing } from './upper-wings';
import {
	entranceCell,
	groundApproach,
	crossesApproach,
	entranceRooms,
	entranceLayout,
	entranceHeadroom,
	landingDepth,
	approachDepth
} from './entrance';
import { courseDatums, groundCourse } from './course-datums';
import { houseEnvelope } from './envelope';
import { parcelSection, parcelExterior, roomLining } from './parcel-section';
import { layeredStructure } from './layered-structure';
import { ensembleFigure, framedStructure, housePrinciple } from './principle';
import { galleryPlot } from './gallery';
import { corners } from './bands';
import { boundaryRuns, ringArea, surfaceHeight, type QuadCell } from '../quad-grid';
import { objectSlot, solid, mounted } from './objects';
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
	const lining = spanning ? shape.polygon : roomLining(shape);
	return {
		...body,
		position: [x.center, y.center, z],
		size: [x.length, y.length, height],
		band: {
			shell: floor % 2 === 1,
			footprint: shape,
			lining,
			paneRing: roomLining({ ...shape, polygon: lining }, 0.38)
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
	const layout = entranceLayout(bay.width, plan.site.programme.length);
	const opening = rectangle(...axis, layout.wellWidth, layout.wellDepth);
	return { anchor, bay, axis, opening, layout };
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
			!frontage.size ||
			c === access.anchor ||
			crossesApproach(c, axis, plan.sign, depth, access.layout.approachHalfWidth)
				? entranceRooms(c, axis, plan.sign, depth, access.layout.approachHalfWidth)
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
function occupiedRooms(plan: Plan, shapes: CourseShapes, shape: Shape, floor: number) {
	if (floor === 0) return shapes.rooms;
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
	const baseTop = raised ? z + Math.max(entranceHeadroom, (ceiling - z) * 0.46) : ceiling - rim;
	const shells = occupiedRooms(plan, shapes, shape, i);
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
function podBodies(
	plan: Plan,
	pod: NonNullable<ReturnType<typeof podCourse>>,
	floor: number,
	z: number,
	ceiling: number,
	parts: Solid[]
) {
	const base = plan.site.id + '/level/' + floor + '/body/';
	const collar = z + (ceiling - rim - z) * 0.32;
	const neck = makeBody(plan, base + 'neck', pod.neck, z, collar - z, floor, true);
	const chamber = makeBody(
		plan,
		base + '0',
		pod.chamber,
		collar,
		ceiling - rim - collar,
		floor,
		true
	);
	chamber.kind = 'capsule';
	parts.push(
		bodySolid(neck, pod.neck, plan.site.ground),
		bodySolid(chamber, pod.chamber, plan.site.ground)
	);
	return [chamber, neck];
}
function courseDeck(
	i: number,
	courseCount: number,
	gallery: boolean,
	wingLevel: number | undefined,
	shape: Shape,
	exterior: ReturnType<typeof parcelExterior>
) {
	const name = i === courseCount - 1 ? 'roof-walk' : 'level/' + (i + 1) + '/deck';
	const deck =
		i === courseCount - 1 && !gallery && i !== wingLevel
			? { ...shape, polygon: exterior.stations[courseCount].ring }
			: shape;
	return { name, deck };
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
	const floors: Parameters<typeof layeredStructure>[0]['floors'] = [];
	const pod = podCourse(plan, opening, galleryCourse, wing?.level);
	function assembleCourse(i: number, z: number, ceiling: number) {
		const gallery = i === galleryCourse;
		const chamber = i === programme.length - 1 ? pod : undefined;
		const shape =
			chamber?.chamber ?? floorOutline(plan, shapes, i, gallery, exterior.stations[i].turn, wing);
		const bodies = chamber
			? podBodies(plan, chamber, i, z, ceiling, parts)
			: floorBodies(plan, shapes, shape, i, z, ceiling, gallery, parts, wing);
		const { name, deck } = courseDeck(
			i,
			programme.length,
			gallery || !!chamber,
			wing?.level,
			shape,
			exterior
		);
		return { shape, bodies, name, deck };
	}
	let roofWalk = shapes.full;
	for (let i = 0; i < programme.length; i++) {
		const z = i ? datums[i] : seat + slab;
		const ceiling = datums[i + 1];
		const { shape, bodies, name, deck } = assembleCourse(i, z, ceiling);
		const [x, y] = extent(shape),
			use = programme[i][0];
		floors.push({
			polygon: shape.polygon,
			holes: shape.holes,
			datum: z,
			programme: programme[i],
			height: ceiling - rim - z
		});
		levels.push({
			position: [x.center, y.center, z],
			width: x.length,
			depth: y.length,
			round: false,
			kind: 'workshop',
			use,
			programme: programme[i],
			bodies,
			landing: access.layout.sideLadder
				? [axis[0] - plan.sign * access.layout.approachHalfWidth, axis[1], z]
				: [axis[0], axis[1] - plan.sign * landingDepth, z],
			deckArea:
				ringArea(shape.polygon) - shape.holes.reduce((a, h) => a + Math.abs(ringArea(h)), 0),
			outline: shape.polygon.map(([u, v]) => [u, v, z])
		});
		parts.push(plate(id + '/' + name, deck, ceiling - rim, rim, ground, 'deck'));
		roofWalk = deck;
	}
	const top = datums[programme.length];
	const openings = [
		groundApproach(
			cells,
			axis,
			plan.sign,
			seat,
			levels[0].landing[2],
			access.layout.approachHalfWidth
		)
	];
	const occupancy = { floors, roofWalk, parcel: { polygon: plot.polygon, holes: plot.holes } };
	return { levels, parts, access, envelope, top, exterior: { ...exterior, openings }, occupancy };
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
/** Fits occupied party-wall courses, a common gallery and stepped upper bays to adjoining parcels. */
export function perimeterHouse(
	plan: Plan,
	role: HouseRole,
	accessSide: HouseComposition['accessSide'],
	context: EnsembleContext
): HouseComposition {
	const { site } = plan,
		{ levels, parts, access, envelope, top, exterior, occupancy } = bearingCourses(plan, context);
	const { bay, axis } = access;
	const use = levels[levels.length - 1].use;
	const crown = roofCrown(
		plan,
		bay,
		use,
		parts[parts.length - 1],
		top,
		envelope.section === 'barrel'
	);
	const sharedRoof = context.houses.get(site.id)?.roof;
	if (sharedRoof !== 'terrace') parts.push(mounted(crown, site.ground, 'crown'));
	// The structure stands on the seated ground course, which may differ from the surveyed pad.
	const seat = exterior.stations[0].z;
	const ensemble = [...context.houses.keys()].sort()[0];
	const highPoint = role === 'high' && context.houses.size > 1;
	const figure = ensembleFigure(context.houses, context.seed) === site.id;
	const joined = exterior.seams.some((spans) => spans.some((span) => span.hidden));
	const principle = housePrinciple(site, joined, highPoint, figure);
	const layered = layeredStructure({
		...occupancy,
		id: site.id,
		ensemble,
		shellUse: context.shellUse,
		ground: seat,
		plate: rim,
		exterior,
		access: { axis, kind: 'ladder' },
		...(sharedRoof === 'terrace' ? {} : { crownUse: crown.use })
	});
	const mouth = exterior.openings[0],
		floor = levels[0].landing[2];
	const face: Level['landing'] = [axis[0], plan.sign > 0 ? mouth.max[1] : mouth.min[1], floor];
	const threshold = {
		position: face,
		heading: (plan.sign * Math.PI) / 2,
		width: mouth.max[0] - mouth.min[0],
		headroom: mouth.max[2] - floor
	};
	const built =
		principle === 'layers'
			? layered
			: framedStructure(
					principle,
					{
						id: site.id,
						ensemble,
						use: layered.use,
						ground: seat,
						parcel: { polygon: exterior.ring, holes: [] }
					},
					[...occupancy.floors.map((course) => course.datum), top],
					{
						from: axis,
						to: [face[0], face[1]],
						width: threshold.width,
						groundAt: site.start ? undefined : (x, y) => surfaceHeight(site.cells[0].corners, x, y)
					}
				);
	// The compact ladder and its landings occupy the entrance well up to the lookout.
	// A tapering mast deck needs a rim even when the well reaches beyond its original outline.
	if (built.principle === 'mast') {
		const lip = access.opening.map(([x, y]): XY => [
			axis[0] + 1.25 * (x - axis[0]),
			axis[1] + 1.25 * (y - axis[1])
		]);
		for (const deck of built.platforms) {
			deck.outline = convexHull([...deck.outline, ...lip]).map(([x, y]) => [x, y]);
			deck.holes = [access.opening];
		}
		built.access = climb(built.ground, 'ladder', built.platforms, axis);
	}
	const structure = { ...built, threshold };
	for (const run of built.access) {
		if (!run.landing) continue;
		const level = levels.find((level) => level.position[2] === run.head[2]);
		if (level) level.landing = run.landing;
	}
	const path = built.access[0]?.spiral ? 'spiral' : 'ladder';
	return {
		structure,
		id: site.id,
		ensembleSize: context.houses.size,
		shellUse: context.shellUse,
		exterior,
		sharedRoof,
		compact: true,
		flightWidth: 1.25,
		path,
		signature: { ...silhouette(envelope), stair: path },
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
		core: {
			position: [axis[0], axis[1], site.ground],
			width: access.layout.wellWidth,
			...(access.layout.sideLadder && { sideLadder: true })
		},
		levels,
		parts,
		supports: [],
		crown,
		fittings: [],
		ports: [{ level: 0, position: levels[0].landing }],
		people: terraceLife(site, levels, parts, crown, plan.seed)
	};
}
