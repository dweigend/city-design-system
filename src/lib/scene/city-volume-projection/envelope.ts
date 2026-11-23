import type { Vec2, Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { levelHeight, type CityColumn, type DistrictKind } from '../../domain/city-volume';
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
	toLocal: (x: number, y: number) => Vec2
) {
	const patches = { detached: mesh(), block: mesh(), center: mesh() } satisfies Record<
		DistrictKind,
		Patch
	>;
	const outlines = {
		detached: new Map<string, Wire>(),
		block: new Map<string, Wire>(),
		center: new Map<string, Wire>()
	};
	const byId = new Map(columns.map((column) => [column.planCellId, column]));
	for (const column of columns) {
		const patch = patches[column.kind];
		const wires = outlines[column.kind];
		const topZ = datumZ + levelHeight * column.levels;
		const base = column.corners.map(({ position: [x, y, z] }): Vec3 => [...toLocal(x, y), z]);
		const roof = base.map(([x, y]): Vec3 => [x, y, topZ]);
		addPolygon(patch, roof);
		for (const [i, a] of roof.entries()) {
			const j = (i + 1) % roof.length;
			const b = roof[j];
			const id = column.neighbors[i];
			const neighbor = id === null ? undefined : required(byId.get(id), 'envelope neighbor');
			if (neighbor?.districtId !== column.districtId || neighbor.levels !== column.levels)
				addWire(wires, a, b);
			if (neighbor && neighbor.levels >= column.levels) continue;
			const lower = neighbor ? datumZ + levelHeight * neighbor.levels : undefined;
			const ga: Vec3 = lower === undefined ? base[i] : [a[0], a[1], lower];
			const gb: Vec3 = lower === undefined ? base[j] : [b[0], b[1], lower];
			addPolygon(patch, [ga, gb, b, a]);
			addWire(wires, ga, a);
			addWire(wires, gb, b);
			addWire(wires, ga, gb);
		}
	}
	return { patches, outlines };
}
