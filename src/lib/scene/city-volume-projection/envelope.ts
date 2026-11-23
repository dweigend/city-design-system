import type { Vec2, Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import {
	columnRoof,
	levelHeight,
	type CityColumn,
	type CityTaper,
	type DistrictKind
} from '../../domain/city-volume';
import { drawnInPencil } from './blocks';
import { mesh } from './mesh';

type Patch = ReturnType<typeof mesh>;
type Wire = number[];
type Local = (x: number, y: number) => Vec2;

/** One group of columns of the same kind and height, plain or drawn in pencil when it is stock. */
export type EnvelopePart = {
	kind: DistrictKind;
	levels: number;
	drawn: boolean;
	shape: Patch;
	/** Taper offsets in local meters, x and y per fill vertex and per outline endpoint. */
	taper: { fill: number[]; outline: number[]; storeys: number[] };
	outline: Map<string, Wire>;
	storeys: Map<string, Wire>;
};

function wireKey(a: Vec3, b: Vec3) {
	return [a.join(','), b.join(',')].sort().join('/');
}

/** Converts a world point and its taper into a local point and a local offset. */
function localPoint(toLocal: Local, taper: CityTaper) {
	return ([x, y, z]: Vec3) => {
		const [u, v] = toLocal(x, y);
		const [dx, dy] = taper([x, y, z]);
		const [su, sv] = toLocal(x + dx, y + dy);
		return { point: [u, v, z] as Vec3, offset: [su - u, sv - v] as Vec2 };
	};
}

function addPolygon(
	part: EnvelopePart,
	points: readonly ReturnType<ReturnType<typeof localPoint>>[]
) {
	const { shape, taper } = part;
	const base = shape.positions.length / 3;
	for (const { point, offset } of points) {
		shape.positions.push(...point);
		taper.fill.push(...offset);
	}
	for (let i = 1; i < points.length - 1; i++) shape.indices.push(base, base + i, base + i + 1);
}

function addWire(
	part: EnvelopePart,
	set: 'outline' | 'storeys',
	a: ReturnType<ReturnType<typeof localPoint>>,
	b: ReturnType<ReturnType<typeof localPoint>>
) {
	const wires = part[set];
	const key = wireKey(a.point, b.point);
	if (wires.has(key)) return;
	wires.set(key, [...a.point, ...b.point]);
	part.taper[set === 'outline' ? 'outline' : 'storeys'].push(...a.offset, ...b.offset);
}

/** Wall heights from the floor to the roof: the floor, every plane between, the roof. */
function wallHeights(floor: number, top: number, datumZ: number) {
	const heights = [];
	for (let level = Math.ceil((floor - datumZ) / levelHeight - 1e-9); ; level++) {
		const z = datumZ + level * levelHeight;
		if (z >= top - 1e-9) break;
		if (z > floor + 1e-9) heights.push(z);
	}
	return [...heights, top];
}

/** Builds the roofs and exposed walls of the city volume, grouped by kind, height and the seeded
 * pencil draw. Walls are split at every level plane so the taper moves each storey on its own.
 * The outline holds roof edges at a step or a district border and the wall corners; drawn columns
 * outline their whole roof. Storeys hold the level lines on the walls. */
export function envelopeMeshes(
	columns: readonly CityColumn[],
	datumZ: number,
	toLocal: Local,
	taper: CityTaper,
	seed: number
) {
	const parts = new Map<string, EnvelopePart>();
	const byId = new Map(columns.map((column) => [column.planCellId, column]));
	const drawn = drawnInPencil(seed);
	const local = localPoint(toLocal, taper);
	for (const column of columns) {
		const { kind, levels } = column;
		const pencil = drawn(column.planCellId);
		const id = `${kind}/${levels}${pencil ? '/drawn' : ''}`;
		let part = parts.get(id);
		if (!part) {
			part = {
				kind,
				levels,
				drawn: pencil,
				shape: mesh(),
				taper: { fill: [], outline: [], storeys: [] },
				outline: new Map(),
				storeys: new Map()
			};
			parts.set(id, part);
		}
		const topZ = columnRoof(column, datumZ);
		const base = column.corners.map(({ position }) => position);
		const roof = base.map(([x, y]): Vec3 => [x, y, topZ]);
		addPolygon(part, roof.map(local));
		for (const [i, a] of roof.entries()) {
			const j = (i + 1) % roof.length;
			const b = roof[j];
			const id = column.neighbors[i];
			const neighbor = id === null ? undefined : required(byId.get(id), 'envelope neighbor');
			const lower = neighbor && columnRoof(neighbor, datumZ);
			if (pencil || neighbor?.districtId !== column.districtId || lower !== topZ)
				addWire(part, 'outline', local(a), local(b));
			if (lower !== undefined && lower >= topZ) continue;
			const floorA = lower ?? base[i][2];
			const floorB = lower ?? base[j][2];
			const heights = wallHeights(Math.max(floorA, floorB), topZ, datumZ);
			let bottom: [Vec3, Vec3] = [
				[a[0], a[1], floorA],
				[b[0], b[1], floorB]
			];
			if (lower === undefined) addWire(part, 'outline', local(bottom[0]), local(bottom[1]));
			for (const z of heights) {
				const top: [Vec3, Vec3] = [
					[a[0], a[1], z],
					[b[0], b[1], z]
				];
				addPolygon(part, [bottom[0], bottom[1], top[1], top[0]].map(local));
				if (z < topZ) addWire(part, 'storeys', local(top[0]), local(top[1]));
				addWire(part, 'outline', local(bottom[0]), local(top[0]));
				addWire(part, 'outline', local(bottom[1]), local(top[1]));
				bottom = top;
			}
		}
	}
	return parts;
}
