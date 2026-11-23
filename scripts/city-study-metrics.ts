// Districts, carrier lattice and growth measurements of one city.
import { distance } from '../src/lib/core/geometry';
import { required } from '../src/lib/core/invariant';
import type { CityColumn, CityLattice, DistrictKind } from '../src/lib/domain/city-volume';
import type { TerrainGrid } from '../src/lib/domain/terrain-grid';
import { area, key, polygon } from './city-study-plan';

/** District shape, shares and height steps of one column set. */
export function districtMetrics(grid: TerrainGrid, columns: readonly CityColumn[]) {
	const shape = polygon(grid);
	const areas = new Map(grid.cells.map(({ id, vertexIds }) => [id, area(shape(vertexIds))]));
	const total = [...areas.values()].reduce((a, b) => a + b, 0);
	const share: Record<DistrictKind, number> = { detached: 0, block: 0, center: 0 };
	const components: Record<DistrictKind, Map<string, number>> = {
		detached: new Map(),
		block: new Map(),
		center: new Map()
	};
	const byId = new Map(columns.map((column) => [column.planCellId, column]));
	let maxJump = 0;
	for (const column of columns) {
		share[column.kind] += required(areas.get(column.planCellId), 'cell area') / total;
		const counts = components[column.kind];
		counts.set(column.districtId, (counts.get(column.districtId) ?? 0) + 1);
		for (const id of column.neighbors) {
			if (id === null) continue;
			maxJump = Math.max(
				maxJump,
				Math.abs(required(byId.get(id), 'neighbor column').levels - column.levels)
			);
		}
	}
	const sizesOf = (kind: DistrictKind) => [...components[kind].values()];
	return {
		kinds: (Object.keys(share) as DistrictKind[])
			.filter((k) => share[k] > 0)
			.sort()
			.join(','),
		detachedShare: share.detached,
		blockShare: share.block,
		centerShare: share.center,
		districts: (Object.keys(components) as DistrictKind[])
			.map((k) => `${k}:${components[k].size}`)
			.join(' '),
		fragments: (Object.keys(components) as DistrictKind[]).reduce(
			(sum, k) => sum + sizesOf(k).filter((n) => n < 3).length,
			0
		),
		mainShare: Math.min(
			...(['block', 'center'] as const)
				.filter((k) => components[k].size)
				.map((k) => Math.max(...sizesOf(k)) / sizesOf(k).reduce((a, b) => a + b, 0)),
			1
		),
		maxJump,
		peakLevels: Math.max(...columns.map(({ levels }) => levels)),
		everyCellHasColumn:
			columns.length === grid.cells.length && columns.every(({ levels }) => levels >= 1)
	};
}

/** Joints, members, duplicate joints, shared faces and member-graph continuity. */
export function latticeMetrics(columns: readonly CityColumn[], lattice: CityLattice) {
	const positions = new Map<string, number>();
	for (const { position } of lattice.nodes) {
		const k = key(position);
		positions.set(k, (positions.get(k) ?? 0) + 1);
	}
	const duplicateNodes = [...positions.values()].filter((n) => n > 1).length;
	const nodes = new Map(lattice.nodes.map(({ id, position }) => [id, position]));
	const byColumn = new Map<string, Map<number, CityLattice['cells'][number]>>();
	for (const bay of lattice.cells) {
		const levels = byColumn.get(bay.planCellId) ?? new Map();
		levels.set(bay.level, bay);
		byColumn.set(bay.planCellId, levels);
	}
	let shared = 0;
	let matched = 0;
	let missingFeet = 0;
	let maxJointErrorM = 0;
	for (const { planCellId, neighbors, corners } of columns) {
		const levels = required(byColumn.get(planCellId), 'column bays');
		for (const { id, position } of corners) {
			const foot = nodes.get(`vertex/${id}/level/0`);
			if (!foot) missingFeet++;
			else maxJointErrorM = Math.max(maxJointErrorM, distance(position, foot));
		}
		neighbors.forEach((neighbor, side) => {
			if (neighbor === null || neighbor < planCellId) return;
			for (const [level, bay] of levels) {
				const other = byColumn.get(neighbor)?.get(level);
				const face = bay.sideFaces[side];
				if (!other || face === null) continue;
				shared++;
				matched += +other.sideFaces.includes(face);
			}
		});
	}
	const parent = new Map(lattice.nodes.map(({ id }) => [id, id]));
	const find = (id: string): string => {
		let root = id;
		while (parent.get(root) !== root) root = required(parent.get(root), 'joint root');
		parent.set(id, root);
		return root;
	};
	for (const { from, to } of lattice.edges) parent.set(find(from), find(to));
	const components = new Set(lattice.nodes.map(({ id }) => find(id))).size;
	return {
		bays: lattice.cells.length,
		joints: lattice.nodes.length,
		members: lattice.edges.length,
		faces: lattice.faces.length,
		duplicateNodes,
		missingFeet,
		maxJointErrorM,
		faceMatch: shared ? matched / shared : 1,
		latticeComponents: components
	};
}

const order = { detached: 0, block: 1, center: 2 };

/** Compares the same seed one size step larger: addresses, kinds and levels of old cells. */
export function growthMetrics(before: readonly CityColumn[], after: readonly CityColumn[]) {
	const next = new Map(after.map((column) => [column.planCellId, column]));
	let lost = 0;
	let moved = 0;
	let demoted = 0;
	let lowered = 0;
	let kept = 0;
	for (const column of before) {
		const now = next.get(column.planCellId);
		if (!now) {
			lost++;
			continue;
		}
		if (JSON.stringify(now.corners) !== JSON.stringify(column.corners)) moved++;
		if (order[now.kind] < order[column.kind]) demoted++;
		if (now.levels < column.levels) lowered++;
		kept += +(now.kind === column.kind && now.levels === column.levels);
	}
	return {
		growthLost: lost,
		growthMoved: moved,
		growthDemoted: demoted,
		growthLowered: lowered,
		growthKept: kept / before.length,
		growthAdded: after.length - before.length
	};
}
