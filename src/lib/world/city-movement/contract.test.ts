import { expect, test } from 'bun:test';
import { columnRoof, levelHeight } from '../../domain/city-volume';
import { railConstraints } from '../../domain/transit-line';
import { citySiteParams, readCityParcels } from '../city-site';
import { defaults } from '../../../config/city-movement';
import { required } from '../../core/invariant';
import { walkwayClearance } from './clearance';
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
		const { site, layout, network, heads, elevatedNodeIds, rail, columns, portalNodeIds } =
			cityMovementExample(variant);
		const components = network.readComponents();
		const plan = readCityParcels(site, layout);
		const laneById = new Map(plan.lanes.map((lane) => [lane.id, lane]));
		const reservedEdges = network.edges.filter(({ lane }) => lane);
		const laneByBlock = Map.groupBy(
			plan.lanes.flatMap((lane) => lane.blockIds.map((block) => ({ lane, block }))),
			({ block }) => block
		);
		const cellComponents = new Map<string, string>();
		for (const block of plan.blocks) {
			const labels = new Set(
				(laneByBlock.get(block.id) ?? []).flatMap(({ lane }) =>
					lane.nodeIds.map((id) => components.get('ground/' + id))
				)
			);
			expect(labels.size).toBe(1);
			const [label] = labels;
			expect(label).toBeDefined();
			if (label) for (const cell of block.memberCellIds) cellComponents.set(cell, label);
		}
		for (const { id, neighbors } of layout.grid.cells)
			for (const neighbor of neighbors)
				if (neighbor && cellComponents.has(neighbor))
					expect(cellComponents.get(neighbor)).toBe(cellComponents.get(id));

		const sourceLane = (id: string) => (JSON.parse(id.slice('lane/'.length)) as string[])[0];
		expect(new Set(reservedEdges.map(({ id }) => sourceLane(id))).size).toBe(plan.lanes.length);
		for (const edge of reservedEdges) {
			const id = sourceLane(edge.id);
			const lane = laneById.get(id);
			if (!lane) throw new Error('Missing parcel lane ' + id);
			expect(edge.lane).toEqual({
				widthM: lane.widthM,
				hierarchy: lane.hierarchy,
				surface: lane.surface
			});
			if (lane.surface === 'stairs') expect(edge.cost).toBeGreaterThan(edge.lengthM);
			else if (lane.hierarchy.some((role) => role === 'main' || role === 'promenade'))
				expect(edge.cost).toBeLessThan(edge.lengthM);
			else expect(edge.cost).toBe(edge.lengthM);
		}
		expect(portalNodeIds.size).toBe(plan.portals.length);
		for (const portal of plan.portals) {
			const id = portalNodeIds.get(portal.id);
			if (!id) throw new Error('Missing graph node for portal ' + portal.id);
			const endpoint = network.readNode(id);
			const [[a, b], [x, y]] = portal.points;
			expect(endpoint?.position[0]).toBeCloseTo((a + x) / 2);
			expect(endpoint?.position[1]).toBeCloseTo((b + y) / 2);
			expect(components.get(id)).toBe(
				components.get('ground/' + laneById.get(portal.laneId)?.nodeIds[0])
			);
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
				expect(plan.parcels.some(({ outline }) => insideOutline(base[0], base[1], outline))).toBe(
					false
				);
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
	datumZ: number,
	levelHeightM = levelHeight
) {
	const z = points[0][2];
	for (const column of columns) {
		if (columnRoof(column, datumZ, levelHeightM) < z) continue;
		const outline = column.corners.map(({ position: [x, y] }) => [x, y] as const);
		for (let i = 1; i < points.length; i++) {
			const a = points[i - 1];
			const b = points[i];
			const samples = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
			for (let j = 0; j <= samples; j++) {
				const x = a[0] + ((b[0] - a[0]) * j) / samples;
				const y = a[1] + ((b[1] - a[1]) * j) / samples;
				if (insideOutline(x, y, outline))
					throw new Error('Deck intersects taller column ' + column.planCellId);
			}
		}
	}
}

function insideOutline(x: number, y: number, outline: readonly (readonly [number, number])[]) {
	let inside = false;
	for (const [i, [px, py]] of outline.entries()) {
		const [qx, qy] = outline[(i + 1) % outline.length];
		if (py > y !== qy > y && x < px + ((qx - px) * (y - py)) / (qy - py)) inside = !inside;
	}
	return inside;
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
	expect(network.readRoute(from, to)?.edges.map(({ id }) => id)).toContain(
		'upper/bridge/' + layout.selectedCrossings[0].id
	);
	const point = [276.94, 21.97, 0.96] as const;
	const reproduced = network.edges.find(({ id }) => id === 'stair/base/-1,2');
	expect(network.edges.some(({ id }) => id.startsWith('stair/'))).toBe(true);
	const plan = readCityParcels(site, layout);
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
				expect(plan.parcels.some(({ outline }) => insideOutline(p[0], p[1], outline))).toBe(false);
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

test('uses the site spacing to clear roofs and address walkway and rail levels', () => {
	const levelHeightM = 15.7;
	const { layout, columns, heads, network, rail, level, elevationM } = cityMovementExample(
		'organic',
		undefined,
		undefined,
		true,
		{ levelHeightM }
	);
	const { datumZ } = layout;
	const headColumns = columns.filter(({ corners }) => corners.some(({ id }) => heads.includes(id)));
	expect(headColumns.length).toBeGreaterThan(0);
	const highestRoof = Math.max(
		...headColumns.map((column) => columnRoof(column, datumZ, levelHeightM))
	);
	const expectedLevel = Math.ceil(
		(highestRoof + defaults.walkwayRoofClearanceM - datumZ) / levelHeightM
	);
	expect(level).toBe(expectedLevel);
	expect(elevationM).toBe(datumZ + expectedLevel * levelHeightM);
	const walkways = network.edges.filter(
		({ kind, id }) => kind === 'walkway' && !id.startsWith('dock/')
	);
	expect(walkways.length).toBeGreaterThan(0);
	for (const { points } of walkways) checkColumns(points, columns, datumZ, levelHeightM);
	for (const station of required(rail, 'custom-spacing rail').stations) {
		const level = (station.position[2] - datumZ) / levelHeightM;
		expect(level).toBeCloseTo(Math.round(level));
		expect(network.readNode('station/' + station.id)?.level).toBe(Math.round(level));
	}

	const column = headColumns[0];
	const [a, b] = column.corners.map(({ position }) => position);
	const oldRoof = columnRoof(column, datumZ);
	const roof = columnRoof(column, datumZ, levelHeightM);
	expect(roof).toBeGreaterThan(oldRoof);
	const inBetween = (oldRoof + roof) / 2;
	expect(walkwayClearance([column], datumZ, levelHeight, inBetween, 0, 0)(a, b)).toBe(true);
	expect(walkwayClearance([column], datumZ, levelHeightM, inBetween, 0, 0)(a, b)).toBe(false);
});
