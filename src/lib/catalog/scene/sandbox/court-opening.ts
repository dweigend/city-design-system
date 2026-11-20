import { Vector3 } from 'three/webgpu';
import { STORY } from '../../data/grid';
import { bounds } from '../../logic/ansicht/geometrie';
import { centreLandmark, composedProjection, houseGroups, type World } from '../../logic/sandbox';
import { focuses } from '../../logic/presentation';
import type { Primitive } from '../../logic/parametrik/types';

type PartGroups = Map<string, Primitive[]>;
const projected = new WeakMap<World, PartGroups>();
/** Retains the source geometry already emitted by the stage's initial complete house projection. */
export function collectOpeningGroups(world: World) {
	const groups: PartGroups = new Map();
	projected.set(world, groups);
	return groups;
}

function courtGroups(world: World) {
	return (world.state.city?.centres ?? []).flatMap((centre) =>
		(centre.ensembles ?? []).flatMap((group) => {
			const court = world.grid.cellsById.get(group.court);
			const lots = group.lots.filter((id) => world.state.stacks.has(id));
			return court && lots.length ? [{ court, lots }] : [];
		})
	);
}
type Court = ReturnType<typeof courtGroups>[number];
function lotCorners(world: World, group: Court) {
	return [group.court.id, ...group.lots].flatMap((id) => {
		const cell = world.grid.cellsById.get(id);
		if (!cell) return [];
		const roof = cell.pad + (world.state.stacks.get(id)?.length ?? 0) * STORY;
		return cell.corners.flatMap(([x, y, z]) => [new Vector3(x, z, -y), new Vector3(x, roof, -y)]);
	});
}

/** Occupied court envelopes and the individual houses used to measure apparent size. */
function survey(world: World) {
	const groups = courtGroups(world);
	const courts = groups.map((group) => ({
		center: group.court.center,
		points: lotCorners(world, group),
		houses: [] as Vector3[][]
	}));
	if (!courts.length) return courts;
	for (const house of composedProjection(world)) {
		if (house.span) continue;
		const indices = groups.flatMap((group, i) =>
			house.cells.some((id) => group.lots.includes(id)) ? [i] : []
		);
		if (!indices.length) continue;
		const parts = projected.get(world)?.get('composed/' + house.id) ?? house.parts();
		if (!parts.length) continue;
		const points = supportPoints(parts);
		for (const i of indices) {
			courts[i].houses.push(points);
		}
	}
	return courts;
}

/** Corners of a domain-space bounding box in three.js scene coordinates. */
export function boxCorners({ min, max }: ReturnType<typeof bounds>) {
	return [min[0], max[0]].flatMap((x) =>
		[min[1], max[1]].flatMap((y) => [min[2], max[2]].map((z) => new Vector3(x, z, -y)))
	);
}

// A box contained in another part cannot contribute an extremum at any camera heading.
function supportPoints(parts: Primitive[]) {
	const volume = (b: ReturnType<typeof bounds>) =>
		(b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]);
	const boxes = parts.map(bounds).sort((a, b) => volume(b) - volume(a));
	const outer: typeof boxes = [];
	for (const box of boxes) {
		if (
			!outer.some(
				(b) =>
					b.min[0] <= box.min[0] &&
					b.min[1] <= box.min[1] &&
					b.min[2] <= box.min[2] &&
					b.max[0] >= box.max[0] &&
					b.max[1] >= box.max[1] &&
					b.max[2] >= box.max[2]
			)
		)
			outer.push(box);
	}
	return outer.flatMap(boxCorners);
}

const surveys = new WeakMap<World, ReturnType<typeof survey>>();
/** Retains occupied courts and their house silhouettes across opening resizes. */
export function courtOpening(world: World) {
	const cached = surveys.get(world);
	if (cached) return cached;
	const courts = survey(world);
	surveys.set(world, courts);
	return courts;
}

const stockCache = new WeakMap<World, Vector3[][]>();
/** Historic buildings as drawn by the sandbox, including their fitted roofs. */
export function stockBounds(world: World) {
	const cached = stockCache.get(world);
	if (cached) return cached;
	const groups = projected.get(world);
	const source = groups ? [...groups.values()] : stockGroups(world);
	const stock = source.flatMap((parts) => {
		const historic = parts.filter((p) => p.role === 'bestand');
		return historic.length ? [supportPoints(historic)] : [];
	});
	stockCache.set(world, stock);
	return stock;
}

function stockGroups(world: World) {
	const chunks = new Set(
		[...world.state.stacks.keys()].map((id) => world.grid.cellsById.get(id)?.chunk)
	);
	return [...chunks].flatMap((chunk) =>
		chunk ? [...houseGroups(world, chunk, focuses.all).values()] : []
	);
}

/** Full exhibit footprint, including each court approach, its buildings and the centre landmark. */
export function centreOpening(world: World, centreId: string, courts: ReturnType<typeof survey>) {
	const city = world.state.city;
	const centre = city?.centres.find((c) => c.cellId === centreId);
	if (!centre?.ensembles?.length) return;
	const gates = new Set(centre.ensembles.map((e) => e.court));
	const cells = new Set([
		...centre.ensembles.flatMap((e) => [e.court, e.mouth, ...(e.plaza?.cells ?? [])]),
		...(city?.walk ?? []).filter((route) => gates.has(route[0])).flat()
	]);
	const centres = new Set([...gates].map((id) => world.grid.cellsById.get(id)?.center));
	return [
		...courts.filter((c) => centres.has(c.center)).flatMap((c) => c.houses.flat()),
		...[...cells].flatMap((id) =>
			(world.grid.cellsById.get(id)?.corners ?? []).map(([x, y, z]) => new Vector3(x, z, -y))
		),
		...centreLandmark(world, centre).flatMap((part) => boxCorners(bounds(part)))
	];
}
