import type { Vec2, Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { columnRoof, levelHeight, type CityColumn } from '../../domain/city-volume';
import { mesh } from './mesh';

type Patch = ReturnType<typeof mesh>;
type Wire = number[];

function addPolygon(patch: Patch, points: readonly Vec3[]) {
	const base = patch.positions.length / 3;
	for (const point of points) patch.positions.push(...point);
	for (let i = 1; i < points.length - 1; i++) patch.indices.push(base, base + i, base + i + 1);
}

function addWire(wires: Map<string, Wire>, a: Vec3, b: Vec3) {
	const key = [a.join(','), b.join(',')].sort().join('/');
	if (!wires.has(key)) wires.set(key, [...a, ...b]);
}

export function envelopeMeshes(
	columns: readonly CityColumn[],
	datumZ: number,
	toLocal: (x: number, y: number) => Vec2,
	byHeight: boolean
) {
	const parts = new Map<
		string,
		{
			kind: CityColumn['kind'];
			levels: number;
			shape: Patch;
			wires: Map<string, Wire>;
		}
	>();
	const byId = new Map(columns.map((column) => [column.planCellId, column]));
	for (const column of columns) {
		const { kind, levels } = column;
		const id = byHeight ? `${kind}/${levels}` : kind;
		let part = parts.get(id);
		if (!part) {
			part = { kind, levels, shape: mesh(), wires: new Map() };
			parts.set(id, part);
		}
		const { shape: patch, wires } = part;
		const topZ = columnRoof(column, datumZ);
		const base = column.corners.map(({ position: [x, y, z] }): Vec3 => [...toLocal(x, y), z]);
		const roof = base.map(([x, y]): Vec3 => [x, y, topZ]);
		addPolygon(patch, roof);
		for (const [i, a] of roof.entries()) {
			const j = (i + 1) % roof.length;
			const b = roof[j];
			const id = column.neighbors[i];
			const neighbor = id === null ? undefined : required(byId.get(id), 'envelope neighbor');
			const lower = neighbor && columnRoof(neighbor, datumZ);
			if (neighbor?.districtId !== column.districtId || lower !== topZ) addWire(wires, a, b);
			if (lower !== undefined && lower >= topZ) continue;
			const ga: Vec3 = lower === undefined ? base[i] : [a[0], a[1], lower];
			const gb: Vec3 = lower === undefined ? base[j] : [b[0], b[1], lower];
			addPolygon(patch, [ga, gb, b, a]);
			const floor = lower ?? Math.max(base[i][2], base[j][2]);
			for (let z = topZ - levelHeight; z > floor; z -= levelHeight) {
				addWire(wires, [a[0], a[1], z], [b[0], b[1], z]);
			}
		}
	}
	return parts;
}
