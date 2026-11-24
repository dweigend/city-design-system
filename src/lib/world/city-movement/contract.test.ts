import { expect, test } from 'bun:test';
import { columnRoof, levelHeight } from '../../domain/city-volume';
import { railConstraints } from '../../domain/transit-line';
import { citySiteParams } from '../city-site';
import { cityMovementExample } from './example';

for (const variant of [
	'square',
	'hex',
	'organic',
	'voronoi',
	'triangle',
	'bands',
	'contour'
] as const) {
	test(variant + ' routes at-grade neighborhoods, bridges and supported upper decks', () => {
		const { site, layout, network, heads, elevatedNodeIds, rail, columns } =
			cityMovementExample(variant);
		const components = network.readComponents();
		const cells = new Map(layout.grid.cells.map((cell) => [cell.id, cell]));
		for (const { vertexIds, neighbors } of cells.values()) {
			const component = components.get('ground/' + vertexIds[0]);
			expect(component).toBeDefined();
			for (const vertex of vertexIds) expect(components.get('ground/' + vertex)).toBe(component);
			for (const id of neighbors) {
				const neighbor = id && cells.get(id);
				if (neighbor) expect(components.get('ground/' + neighbor.vertexIds[0])).toBe(component);
			}
		}
		expect(heads).toHaveLength(2);
		const ends = heads.map((id) => elevatedNodeIds.get(id) ?? 'ground/' + id);
		const route = network.readRoute(ends[0], ends[1]);
		expect(route).toBeDefined();
		for (const [vertex, id] of elevatedNodeIds)
			expect(components.get(id)).toBe(components.get('ground/' + vertex));

		const roofs = new Map<string, number>();
		for (const column of columns) {
			const roof = columnRoof(column, layout.datumZ);
			for (const { id } of column.corners)
				roofs.set(id, Math.max(roof, roofs.get(id) ?? -Infinity));
		}
		for (const edge of network.edges.filter(({ kind }) => kind === 'walkway')) {
			expect(edge.supports).toHaveLength(edge.id.startsWith('dock/') ? 1 : 2);
			expect(edge.supports?.map(({ top }) => top)).toEqual(
				edge.id.startsWith('dock/')
					? [edge.points[0]]
					: [edge.points[0], edge.points[edge.points.length - 1]]
			);
			for (const { base, top } of edge.supports ?? []) {
				expect(site.valley.readGround(base[0], base[1]).cover).toBe('dry');
				expect(top[2]).toBeGreaterThan(base[2]);
			}
			for (const id of edge.nodeIds) {
				const node = network.readNode(id);
				expect(node?.level).toBe((edge.points[0][2] - layout.datumZ) / levelHeight);
				const vertex = id.split('/ground/')[1];
				if (vertex) expect(node?.position[2]).toBeGreaterThan(roofs.get(vertex) ?? -Infinity);
			}
			checkColumns(edge.points, columns, layout.datumZ);
		}
		expect(rail?.stations).toHaveLength(2);
		expect(rail?.wetRuns).toBe(0);
		expect(rail?.gradeRatio).toBeLessThanOrEqual(railConstraints.maximumGradeRatio);
		expect(rail?.minimumRadiusM).toBeGreaterThanOrEqual(railConstraints.minimumRadiusM);
		const planIds = new Set([...layout.plan.vertices, ...layout.grid.vertices].map(({ id }) => id));
		for (const { base, top, anchorId } of rail?.piers ?? []) {
			expect(site.valley.readGround(base[0], base[1]).cover).toBe('dry');
			expect(top[2]).toBeGreaterThan(base[2]);
			if (anchorId) expect(planIds.has(anchorId)).toBe(true);
		}
		for (const station of rail?.stations ?? []) {
			const id = 'station/' + station.id;
			expect(network.readNode(id)?.position).toEqual(station.position);
			const dock = network.readRoute(station.approachId, id);
			expect(dock?.edges.every(({ kind }) => kind === 'stair' || kind === 'walkway')).toBe(true);
		}
	});
}

function checkColumns(
	points: readonly (readonly [number, number, number])[],
	columns: ReturnType<typeof cityMovementExample>['columns'],
	datumZ: number
) {
	const z = points[0][2];
	for (const column of columns) {
		if (columnRoof(column, datumZ) < z) continue;
		for (let i = 1; i < points.length; i++) {
			const a = points[i - 1];
			const b = points[i];
			const samples = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
			for (let j = 0; j <= samples; j++) {
				const x = a[0] + ((b[0] - a[0]) * j) / samples;
				const y = a[1] + ((b[1] - a[1]) * j) / samples;
				let inside = false;
				for (let k = 0; k < column.corners.length; k++) {
					const [px, py] = column.corners[k].position;
					const [qx, qy] = column.corners[(k + 1) % column.corners.length].position;
					if (py > y !== qy > y && x < px + ((qx - px) * (y - py)) / (qy - py)) inside = !inside;
				}
				if (inside) throw new Error('Deck intersects taller column ' + column.planCellId);
			}
		}
	}
}

test('the valley guideway keeps its bearings on dry ground at relief 0.5', () => {
	const { rail, site } = cityMovementExample('organic', citySiteParams.citySize.default, 0.5);
	expect(rail?.lengthM).toBe(8000);
	expect(rail?.stations).toHaveLength(2);
	for (const { base } of rail?.piers ?? [])
		expect(site.valley.readGround(base[0], base[1]).cover).toBe('dry');
});

test('organic seed 1201 stairs clear the column at the primary crossing', () => {
	const { network, columns, layout, site, heads, elevatedNodeIds } = cityMovementExample('organic');
	const [from, to] = heads.map((id) => elevatedNodeIds.get(id) ?? 'ground/' + id);
	expect(network.readRoute(from, to)?.edges.map(({ id }) => id)).toContain('upper/bridge/0');
	const point = [276.94, 21.97, 0.96] as const;
	const reproduced = network.edges.find(({ id }) => id === 'stair/base/-1,2');
	expect(network.edges.some(({ id }) => id.startsWith('stair/'))).toBe(true);
	for (const edge of network.edges.filter(({ kind }) => kind === 'stair')) {
		for (let i = 1; i < edge.points.length; i++) {
			const a = edge.points[i - 1];
			const b = edge.points[i];
			const probes = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 4));
			for (let j = 1; j < probes; j++) {
				const t = j / probes;
				const p = [
					a[0] + (b[0] - a[0]) * t,
					a[1] + (b[1] - a[1]) * t,
					a[2] + (b[2] - a[2]) * t
				] as const;
				expect(site.sampleGround(p[0], p[1]).waterKind).toBeNull();
				checkColumns([p, [p[0] + 1e-7, p[1], p[2]]], columns, layout.datumZ);
				if (edge === reproduced)
					expect(Math.hypot(p[0] - point[0], p[1] - point[1], p[2] - point[2])).toBeGreaterThan(
						0.2
					);
			}
		}
	}
});

test('empty walkway centres keep the ground graph without inventing an eaves network', () => {
	const { network, elevatedNodeIds, heads } = cityMovementExample('organic', 1800, 0, false);
	expect(heads).toEqual([]);
	expect(elevatedNodeIds.size).toBe(0);
	expect(network.edges.some(({ kind }) => kind === 'lane')).toBe(true);
	expect(network.edges.some(({ id }) => id.startsWith('upper/') || id.startsWith('walkway/'))).toBe(
		false
	);
});
