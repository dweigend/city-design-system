import { Vector3 } from 'three/webgpu';
import { STORY } from '../../data/grid';
import { bounds } from '../../logic/ansicht/geometrie';
import { composedProjection, houseGroups, type World } from '../../logic/sandbox';
import { focuses } from '../../logic/presentation';
import type { Primitive } from '../../logic/parametrik/types';

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
		const parts = house.parts();
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
	const boxes = parts.map(bounds);
	const outer = boxes.filter(
		(b, i) =>
			!boxes.some(
				(a, j) =>
					j !== i &&
					a.min.every((v, k) => v <= b.min[k] && a.max[k] >= b.max[k]) &&
					(j < i || a.min.some((v, k) => v < b.min[k] || a.max[k] > b.max[k]))
			)
	);
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
	const chunks = new Set(
		[...world.state.stacks.keys()].map((id) => world.grid.cellsById.get(id)?.chunk)
	);
	const stock: Vector3[][] = [];
	for (const chunk of chunks) {
		if (!chunk) continue;
		for (const parts of houseGroups(world, chunk, focuses.all).values()) {
			const historic = parts.filter((p) => p.role === 'bestand');
			if (historic.length) stock.push(supportPoints(historic));
		}
	}
	stockCache.set(world, stock);
	return stock;
}
