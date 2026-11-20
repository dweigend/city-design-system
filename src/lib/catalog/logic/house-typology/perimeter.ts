import { wingRim, type UpperWing } from './upper-wings';
import { entranceCell, entranceRooms, entranceWidth } from './entrance';
import { courseDatums } from './course-datums';
import { houseEnvelope } from './envelope';
import { parcelSection, parcelExterior } from './parcel-section';
import { galleryPlot } from './gallery';
import { corners } from './bands';
import { boundaryRings, ringArea, type QuadCell } from '../quad-grid';
import { crownSpec, objectSlot, solid, mounted } from './objects';
import { footprintBay } from './footprint';
import { terraceLife } from './terrace-life';
import { silhouette } from './signature';
import type { EnsembleContext } from './ensemble';
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
	const [polygon, ...holes] = boundaryRings(cells, (id) => ids.has(id)).sort(
		(a, b) => ringArea(b) - ringArea(a)
	);
	return { polygon, holes };
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
	floor: number
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
		band: { shell: floor % 2 === 1, footprint: shape }
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
		bay = plan.site.envelope ? footprintBay(plan.site.cells) : footprintBay([anchor]);
	const axis: XY = [bay.x, bay.y + plan.sign * Math.min(bay.depth * 0.2, 1.4)];
	const opening = rectangle(...axis, entranceWidth, 0.82);
	return { anchor, bay, axis, opening };
}
function exposedWall(cells: readonly QuadCell[], frontage: ReadonlySet<string>) {
	const edges = cells.flatMap((cell) =>
		cell.corners.flatMap((p, i) =>
			frontage.has(cell.neighbors[i] ?? '') ? [[p, cell.corners[(i + 1) % 4]]] : []
		)
	);
	const near = (a: readonly number[], b: readonly number[]) =>
		Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-5;
	return (a: XY, b: XY) => !edges.some(([u, v]) => near(a, u) && near(b, v));
}
function courseShapes(plan: Plan, frontage: ReadonlySet<string>, wing?: UpperWing) {
	const access = accessBay(plan, frontage),
		{ bay, axis, opening } = access;
	const { cells, id } = plan.site;
	const envelope = houseEnvelope(id, plan.seed, plan.site.envelope);
	const plot = parcel(cells);
	const full = { polygon: plot.polygon, holes: [...plot.holes, opening] };
	const span = galleryPlot(cells, frontage, access.anchor);
	const bridge = { ...span, holes: [...span.holes, opening] };
	const pier = {
		polygon: rectangle(
			axis[0],
			axis[1],
			Math.max(entranceWidth + 0.2, Math.min(bay.width * 0.48, 3)),
			Math.max(1.12, Math.min(bay.depth * 0.46, 2.8))
		),
		holes: [opening]
	};
	if (wing && cells.length === 1) pier.polygon = wingRim(cells[0], wing.abutments, pier.polygon);
	const wingShape =
		wing && cells.length === 1
			? { polygon: wingRim(cells[0], wing.walls, pier.polygon), holes: [opening] }
			: bridge;
	const rooms = cells.flatMap((c) =>
		plan.site.envelope || c === access.anchor
			? entranceRooms(c, axis, plan.sign)
			: [{ polygon: c.corners.map(([x, y]): XY => [x, y]), holes: [] }]
	);
	return { access, axis, opening, plot, full, bridge, pier, wingShape, rooms, envelope };
}
type CourseShapes = ReturnType<typeof courseShapes>;
function floorOutline(
	plan: Plan,
	shapes: CourseShapes,
	i: number,
	gallery: boolean,
	wing?: UpperWing
) {
	if (i + 1 === wing?.level) return shapes.pier;
	if (i === wing?.level) return shapes.wingShape;
	if (gallery) return shapes.bridge;
	if (!plan.site.envelope && i < 2) return shapes.full;
	return parcelSection(
		shapes.plot,
		shapes.opening,
		shapes.envelope,
		i / Math.max(1, plan.site.programme.length - 1),
		i
	);
}
function courses(
	plan: Plan,
	frontage: ReadonlySet<string>,
	ensembleSeed: number,
	galleryCourse?: number,
	wing?: UpperWing
) {
	const shapes = courseShapes(plan, frontage, wing);
	const { access, axis, opening, plot, rooms, envelope, pier } = shapes;
	const { cells, programme, ground, id } = plan.site;
	const datums = courseDatums(plan, ensembleSeed, galleryCourse);
	const parts: Solid[] = rooms.map((room, k) =>
		plate(id + (k ? '/plinth/' + k : '/plinth'), room, ground, 0.6, ground, 'base')
	);
	const levels: Level[] = [];
	for (let i = 0; i < programme.length; i++) {
		const z = i ? datums[i] : ground + 0.6;
		const ceiling = datums[i + 1];
		const gallery = i === galleryCourse;
		const shape = floorOutline(plan, shapes, i, gallery, wing);
		const underGround = i === 0 && wing?.level === 1;
		const baseTop = underGround ? z + (ceiling - z) * 0.46 : ceiling - rim;
		const shells = i === 0 && !plan.site.envelope ? rooms : [shape];
		const bodies = shells.map((shell, k) => {
			const body = makeBody(plan, id + '/level/' + i + '/body/' + k, shell, z, baseTop - z, i);
			if (body.band && i >= 2) {
				body.band.cells = cells;
				body.band.finish = envelope.finish;
				if (!gallery) body.band.skin = envelope.skin;
			}
			parts.push(bodySolid(body, shell, ground));
			return body;
		});
		if (underGround) {
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
			landing: [axis[0], axis[1] - plan.sign * 0.41, z],
			deckArea:
				ringArea(shape.polygon) - shape.holes.reduce((a, h) => a + Math.abs(ringArea(h)), 0),
			outline: shape.polygon.map(([u, v]) => [u, v, z])
		});
		const name = i === programme.length - 1 ? 'roof-walk' : 'level/' + (i + 1) + '/deck';
		parts.push(plate(id + '/' + name, shape, ceiling - rim, rim, ground, 'deck'));
	}
	const top = datums[programme.length];
	const exterior =
		!frontage.size || wing?.roof === 'head'
			? parcelExterior(plot, opening, envelope, ground, top, exposedWall(cells, frontage))
			: undefined;
	return { levels, parts, access, profile: envelope.section, top, exterior };
}
/** Fits occupied party-wall courses, a common gallery and stepped upper bays to adjoining parcels. */
export function perimeterHouse(
	plan: Plan,
	role: HouseRole,
	accessSide: HouseComposition['accessSide'],
	frontage: ReadonlySet<string>,
	context: EnsembleContext
): HouseComposition {
	const { site } = plan,
		{ levels, parts, access, profile, top, exterior } = courses(
			plan,
			frontage,
			context.seed,
			context.houses.get(site.id)?.galleryCourse,
			context.houses.get(site.id)?.upperWing
		);
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
	crown.position = [bay.x, bay.y - plan.sign * Math.min(bay.depth * 0.2, 1.5), top];
	crown.anchor = 'roof';
	const sharedRoof = context.houses.get(site.id)?.upperWing?.roof;
	if (sharedRoof !== 'terrace') parts.push(mounted(crown, site.ground, 'crown'));
	return {
		id: site.id,
		ensembleSize: context.houses.size,
		exterior,
		sharedRoof,
		compact: true,
		flightWidth: 1.25,
		path: 'ladder',
		signature: silhouette('block', 'ladder', true, false, profile),
		bay,
		start: site.start,
		stories: site.programme.length,
		role,
		typology: 'block',
		cells: site.cells,
		datum: plan.datum,
		ground: site.ground,
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
