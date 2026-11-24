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
		const { site, layout, network, demoEnds, rail, columns } = cityMovementExample(variant);
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
		expect(demoEnds).toBeDefined();
		if (!demoEnds) throw new Error('No crossing');
		const route = network.readRoute(...demoEnds);
		expect(route?.edges.some(({ id }) => id === 'upper/bridge/0')).toBe(true);

		const roofs = new Map<string, number>();
		for (const column of columns) {
			const roof = columnRoof(column, layout.datumZ);
			for (const { id } of column.corners)
				roofs.set(id, Math.max(roof, roofs.get(id) ?? -Infinity));
		}
		for (const edge of network.edges.filter(({ kind }) => kind === 'walkway')) {
			expect(edge.supports).toHaveLength(2);
			expect(edge.supports?.map(({ top }) => top)).toEqual([
				edge.points[0],
				edge.points[edge.points.length - 1]
			]);
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
