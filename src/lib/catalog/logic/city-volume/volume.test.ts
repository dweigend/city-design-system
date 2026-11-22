import { beforeAll, expect, test } from 'bun:test';
import type { CellPoint, CellSpace } from '../cell-space';
import { deriveGroundPlan, type GroundPlan } from '../city-plan';
import { occupyCells } from '../occupancy';
import { required } from '../required';
import { createTerrain } from '../terrain';
import { deriveGrid } from '../terrain-grid';
import { deriveCityVolume, type CityVolume } from '.';

let plan: GroundPlan;
let volume: CityVolume;
beforeAll(() => {
	plan = deriveGroundPlan(deriveGrid(createTerrain({ seed: 7 })), '76/64', 104);
	volume = deriveCityVolume(plan);
}, 15000);

function subtract(a: CellPoint, b: CellPoint): CellPoint {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: CellPoint, b: CellPoint): CellPoint {
	return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: CellPoint, b: CellPoint) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function faceGeometry(space: CellSpace) {
	const nodes = new Map(space.nodes.map((n) => [n.id, n.position]));
	return new Map(
		space.faces.map((face) => {
			const points = face.nodeIds.map((id) => required(nodes.get(id), 'node'));
			const origin = points[0];
			const normals = points
				.slice(2)
				.map((p, i) => cross(subtract(points[i + 1], origin), subtract(p, origin)));
			const normal: CellPoint = [0, 1, 2].map((axis) =>
				normals.reduce((s, n) => s + n[axis], 0)
			) as [number, number, number];
			return [face.id, { points, origin, normal, area: Math.hypot(...normal) / 2, face }];
		})
	);
}
function contacts(space: CellSpace, parent: (id: string) => string) {
	const areas = new Map<string, number>();
	for (const { area, face } of faceGeometry(space).values()) {
		const ids = face.uses.map((u) => parent(u.cellId)).sort();
		if (ids[0] === ids[1]) continue;
		const key = ids.join('|');
		areas.set(key, (areas.get(key) ?? 0) + area);
	}
	return areas;
}

test('the coarse carrier is connected, bounded by the crop and covers its integrated canopy', () => {
	const { coarse } = volume;
	const nodes = new Map(coarse.nodes.map((n) => [n.id, n.position]));
	const bindings = new Map(volume.bindings.map((b) => [b.coarseId, b.groundId]));
	const ground = new Map(plan.cells.map((c) => [c.id, c]));
	const graph = new Map(coarse.cells.map((c) => [c.id, new Set<string>()]));
	for (const face of coarse.faces) {
		const [a, b] = face.uses;
		if (b) {
			expect(a.direction).toBe(-b.direction);
			graph.get(a.cellId)?.add(b.cellId);
			graph.get(b.cellId)?.add(a.cellId);
		} else if (
			!face.nodeIds.every((id) => id.includes('/node/ground/')) &&
			!face.nodeIds.every((id) => id.includes('/node/canopy/'))
		) {
			const cell = required(ground.get(required(bindings.get(a.cellId), 'source')), 'cell');
			const points = face.nodeIds.map((id) => required(nodes.get(id), 'point'));
			expect(
				cell.corners.some((p, i) => {
					const q = cell.corners[(i + 1) % 4];
					return (
						cell.neighbors[i] === null &&
						points.every((x) => Math.abs(cross(subtract(q, p), subtract(x, p))[2]) < 1e-7)
					);
				})
			).toBe(true);
		}
	}
	const visited = new Set([coarse.cells[0].id]);
	for (const id of visited)
		for (const neighbor of required(graph.get(id), 'contacts')) visited.add(neighbor);
	expect(visited.size).toBe(coarse.cells.length);
	let expected = 0;
	const heights: number[] = [];
	for (const cell of plan.cells) {
		const h = cell.vertexIds.map(
			(id, i) =>
				required(nodes.get(plan.id + '/node/canopy/' + id), 'canopy')[2] - cell.corners[i][2]
		);
		heights.push(...h);
		for (const [i, j] of [
			[1, 2],
			[2, 3]
		]) {
			const [p] = cell.corners;
			const area =
				Math.abs(cross(subtract(cell.corners[i], p), subtract(cell.corners[j], p))[2]) / 2;
			expected += (area * (h[0] + h[i] + h[j])) / 3;
		}
	}
	expect(volume.leaves.cells.reduce((sum, c) => sum + c.volumeM3, 0)).toBeCloseTo(expected, 7);
	expect(Math.min(...heights)).toBeCloseTo(7, 9);
	expect(Math.max(...heights)).toBeCloseTo(24, 9);
	expect(coarse.cells.reduce((s, c) => s + c.volumeM3, 0)).toBeCloseTo(expected, 7);
});

test('every coarse contact and exterior survives refinement with its full area', () => {
	const parents = new Map(volume.bindings.map((b) => [b.leafId, b.coarseId]));
	const coarse = contacts(volume.coarse, (id) => id);
	const leaves = contacts(volume.leaves, (id) => required(parents.get(id), 'parent'));
	expect([...leaves.keys()].sort()).toEqual([...coarse.keys()].sort());
	for (const [id, area] of coarse) expect(leaves.get(id)).toBeCloseTo(area, 8);
	const refined = new Set(
		volume.bindings.filter((b) => b.leafId !== b.coarseId).map((b) => b.coarseId)
	);
	expect(refined.size).toBe(2);
	const seam = volume.leaves.faces.filter(
		({ uses }) =>
			uses.length === 2 &&
			new Set(uses.map((u) => parents.get(u.cellId))).size === 2 &&
			uses.every((u) => refined.has(required(parents.get(u.cellId), 'parent')))
	);
	expect(seam).toHaveLength(4);
	for (const { uses } of seam) expect(uses[0].direction).toBe(-uses[1].direction);
});

test('each refined parent contains disjoint convex children of equal total volume', () => {
	const { leaves, coarse } = volume;
	const fineFaces = faceGeometry(leaves),
		coarseFaces = faceGeometry(coarse);
	const cells = new Map(leaves.cells.map((c) => [c.id, c]));
	function shell(
		id: string,
		faceIds: readonly string[],
		geometry: ReturnType<typeof faceGeometry>
	) {
		return faceIds.map((key) => {
			const { face, origin, normal, points, area } = required(geometry.get(key), 'face');
			const outward =
				required(
					face.uses.find((u) => u.cellId === id),
					'use'
				).direction /
				(2 * area);
			return { points, distance: (p: CellPoint) => dot(subtract(p, origin), normal) * outward };
		});
	}
	const children = new Map<string, string[]>();
	for (const b of volume.bindings)
		if (b.leafId !== b.coarseId)
			children.set(b.coarseId, [...(children.get(b.coarseId) ?? []), b.leafId]);
	for (const parent of coarse.cells.filter((c) => children.has(c.id))) {
		const actual = required(children.get(parent.id), 'children').map((id) =>
			required(cells.get(id), 'leaf')
		);
		expect(actual.reduce((s, c) => s + c.volumeM3, 0)).toBeCloseTo(parent.volumeM3, 8);
		const boundary = shell(parent.id, parent.faceIds, coarseFaces);
		const regions = actual.map((c) => shell(c.id, c.faceIds, fineFaces));
		for (const [i, region] of regions.entries()) {
			const points = region.flatMap((f) => f.points);
			expect([...region, ...boundary].every((f) => points.every((p) => f.distance(p) < 1e-8))).toBe(
				true
			);
			for (const other of regions.slice(i + 1)) {
				const otherPoints = other.flatMap((f) => f.points);
				expect(region.some((f) => otherPoints.every((p) => f.distance(p) > -1e-8))).toBe(true);
			}
		}
	}
});

test('exact path clearance and sky-open columns retain their owners and reject occupancy', () => {
	const areas = new Map(plan.areas.map((area) => [area.id, area]));
	const nodes = new Map(volume.coarse.nodes.map((n) => [n.id, n.position]));
	for (const area of plan.areas) {
		if (area.kind !== 'path') continue;
		const sources = new Set(area.cellIds);
		for (const cell of plan.cells.filter((c) => sources.has(c.id))) {
			for (const [i, id] of cell.vertexIds.entries()) {
				const top = required(nodes.get(plan.id + '/node/clearance/' + id), 'path clearance');
				expect(top[2] - cell.corners[i][2]).toBeCloseTo(area.reserve.clearanceM, 9);
			}
		}
	}
	expect(volume.occupancy.size).toBe(volume.leaves.cells.length);
	let protectedCount = 0,
		freePath = 0;
	for (const { groundId, leafId, layer } of volume.bindings) {
		const owner = plan.reservations.get(groundId);
		const path = owner && areas.get(owner)?.kind === 'path';
		const expected = path && layer === 'upper' ? undefined : owner;
		expect(volume.reservations.get(leafId)).toBe(expected);
		expect(volume.occupancy.get(leafId)).toEqual({ kind: 'empty' });
		if (expected) protectedCount++;
		if (path && !expected) freePath++;
	}
	expect(freePath).toBeGreaterThan(0);
	expect(protectedCount).toBe(volume.reservations.size);
	const [id] = volume.reservations.keys();
	expect(() =>
		occupyCells(volume.leaves, volume.occupancy, volume.reservations, [
			{ id, fill: { kind: 'bridge', connectionId: 'span' } }
		])
	).toThrow('reserved');
});
