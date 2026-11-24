import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import {
	columnRoof,
	createCityLattice,
	levelHeight,
	readCityColumns
} from '../../domain/city-volume';
import {
	createCitySite,
	readCityDistricts,
	readCityGrid,
	readCityParcels
} from '../../world/city-site';
import type { FocusChoice } from '../focus';
import type { Drawable } from '../surface';
import { drawnInPencil } from './blocks';
import { example } from './example';
import {
	cityElevation,
	cityPresentation,
	cityProfile,
	projectCityDistricts,
	projectCityLattice,
	projectCityTerrain
} from './index';
import { cityElevationRangeM } from './constants';
import { memberRank } from './lattice';
import { clockwise } from './mesh';

const isDrawn = drawnInPencil(1201);

test('projects shaded district bodies with flat caps, exposed walls split at every level', () => {
	const { envelope, columns, datumZ } = example();
	const { drawables, focus } = envelope;
	const bodies = drawables.filter(({ role }) => role === 'body');
	expect(new Set(bodies.map(({ kind, color }) => `${kind} ${color}`))).toEqual(
		new Set(['detached --district-detached', 'block --district-block', 'center --district-center'])
	);
	expect(focus?.max[2]).toBe(Math.max(...columns.map((column) => columnRoof(column, datumZ))));
	const byId = new Map(columns.map((column) => [column.planCellId, column]));
	const storeysBelow = (column: (typeof columns)[number], floor: number) =>
		Math.ceil((columnRoof(column, datumZ) - floor) / levelHeight - 1e-9);
	for (const { kind, levels, drawn, shape, opacity, strokeSegments, warp } of bodies) {
		expect(opacity).toBeUndefined();
		const lines = drawables
			.filter(({ id }) => id.startsWith(`${kind}/${levels}${drawn ? '/drawn' : ''}`))
			.flatMap(({ strokeSegments: segments }) => segments ?? []);
		expect(lines.length).toBeGreaterThanOrEqual(strokeSegments?.length ?? 0);
		expect(lines.length).toBeGreaterThan(0);
		if (shape.kind !== 'mesh') throw new Error('Expected an indexed envelope mesh');
		expect(warp?.fill.length).toBe((2 * shape.positions.length) / 3);
		const expectedTriangles = columns
			.filter(
				(column) =>
					column.kind === kind && column.levels === levels && isDrawn(column.planCellId) === drawn
			)
			.reduce((count, column) => {
				let walls = 0;
				for (const [i, id] of column.neighbors.entries()) {
					const top = columnRoof(column, datumZ);
					const lower =
						id === null ? undefined : columnRoof(required(byId.get(id), 'neighbor'), datumZ);
					if (lower !== undefined && lower >= top) continue;
					const floor =
						lower ??
						Math.max(
							column.corners[i].position[2],
							column.corners[(i + 1) % column.corners.length].position[2]
						);
					walls += storeysBelow(column, floor);
				}
				return count + column.corners.length - 2 + 2 * walls;
			}, 0);
		expect(shape.indices).toHaveLength(3 * expectedTriangles);
	}
	// About one stock column in six is drawn in pencil, by a keyed draw.
	const drawnShare =
		columns.filter(({ planCellId }) => isDrawn(planCellId)).length / columns.length;
	expect(drawnShare).toBeGreaterThan(0.1);
	expect(drawnShare).toBeLessThan(0.25);
});

test('projects one glyph per joint and one segment per unique member on common planes', () => {
	const { datumZ, heightAt, lattice, members } = example();
	const [drawable] = members.drawables;
	const { shape } = drawable;
	if (shape.kind !== 'mesh') throw new Error('Expected a mesh of lattice joints');
	expect(shape.indices.length).toBe(24 * lattice.nodes.length);
	const strokes = members.drawables.flatMap(({ strokeSegments }) => strokeSegments ?? []);
	expect(strokes.length).toBe(6 * lattice.edges.length);
	for (let i = 0; i < strokes.length; i += 6) {
		for (const offset of [0, 3]) {
			const [x, y, z] = strokes.slice(i + offset, i + offset + 3);
			if (z < datumZ + levelHeight) expect(z).toBeCloseTo(heightAt(x, y), 8);
			else expect((z - datumZ) % levelHeight).toBeCloseTo(0);
		}
	}
});

test('omits the lattice drawable when there are no bays', () => {
	const { frame } = example();
	expect(
		projectCityLattice(
			{ cells: [], faces: [], bayCorners: [], nodes: [], edges: [], solids: [] },
			frame
		).drawables
	).toEqual([]);
});

test('keeps true scale at quarter distance and resolves to the stepped envelope at city distance', () => {
	const elevation = Math.PI / 8;
	const peak = 91;
	const near = cityProfile(500, 0.5, peak, elevation, false);
	const far = cityProfile(5000, 3.88, peak, elevation, false);
	const displayPeak = peak * far.factor;
	expect(near).toMatchObject({ factor: 1, detail: 1, uprights: 1, rims: 1, envelope: 0 });
	expect(far).toMatchObject({ detail: 0, uprights: 0, rims: 0, envelope: 1 });
	expect(displayPeak * Math.cos(elevation)).toBeCloseTo(500);
	expect(cityProfile(5000, 3.88, peak, elevation, false, 2.3).factor).toBe(2.3);
	expect(cityProfile(5000, 3.88, peak, elevation, true)).toEqual({ ...far, factor: 1 });
});

test('keeps the taper at zero for the quarter frame on narrow and wide canvases', () => {
	const elevation = Math.PI / 10;
	for (const pixels of [400, 1600]) {
		expect(cityProfile(500, 500 / pixels, 91, elevation, true).taper).toBe(0);
		expect(cityProfile(4200, 4200 / pixels, 91, elevation, true).taper).toBeGreaterThan(0.8);
	}
});

test('winds roofs up and walls out, whatever the turn of the plan ring', () => {
	expect(
		clockwise([
			[0, 0],
			[0, 1],
			[1, 1],
			[1, 0]
		])
	).toBe(true);
	expect(
		clockwise([
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1]
		])
	).toBe(false);
	const city = createCitySite(undefined, { relief: 0.5 });
	const plan = readCityGrid(city, 1200);
	const terrain = projectCityTerrain(city, plan.grid, plan.plan);
	const columns = readCityColumns(plan.grid, readCityDistricts(city, plan));
	const { drawables } = projectCityDistricts(columns, plan.datumZ, terrain);
	for (const { role, shape } of drawables) {
		if ((role !== 'body' && role !== 'block') || shape.kind !== 'mesh') continue;
		const { positions: p, indices } = shape;
		for (let i = 0; i < indices.length; i += 3) {
			const [a, b, c] = indices.slice(i, i + 3).map((k) => p.slice(3 * k, 3 * k + 3));
			const up = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
			// A flat triangle is a roof and faces up; walls have no vertical normal component.
			if (a[2] === b[2] && b[2] === c[2]) expect(up).toBeGreaterThan(0);
		}
	}
}, 15_000);

test('ranks lattice members by direction, so the slants of a model stay its own', () => {
	expect(memberRank([0, 0, 0], [30, 0, 0.01], false)).toBe('rims');
	expect(memberRank([0, 0, 0], [30, 0, 3], true)).toBe('rims');
	expect(memberRank([0, 0, 0], [0.4, 0, 7], false)).toBe('uprights');
	expect(memberRank([0, 0, 0], [12, 9, 7], false)).toBe('detail');
	const { lattice, frame, taper } = example();
	const antiprism = createCityLattice(example().columns, example().datumZ, 'square', 'antiprism');
	const count = (value: typeof lattice) =>
		projectCityLattice(value, frame, taper).drawables.find(({ id }) => id === 'detail')
			?.strokeSegments?.length ?? 0;
	expect(count(lattice)).toBe(0);
	expect(count(antiprism)).toBeGreaterThan(0);
});

test('styles plan overlays from their slots and reuses one list per viewport', () => {
	const city = createCitySite(undefined, { relief: 0.5 });
	const plan = readCityGrid(city, 2600);
	const terrain = projectCityTerrain(city, plan.grid, plan.plan);
	const overlays = terrain.projectWetPlan(plan.selectedCrossings);
	const crossing = required(
		overlays.find(({ id }) => id === 'selected-crossings'),
		'crossings'
	);
	expect(crossing.stroke?.color).toBe('--path');
	const present = (focus: FocusChoice) =>
		cityPresentation({
			terrain: [...terrain.drawables, ...overlays],
			envelope: [],
			members: [],
			focus,
			peak: 0,
			relief: 0.5,
			trueScale: true,
			maxProfileScale: 1,
			taper: 0
		});
	const viewport = { width: 2600, metersPerPixel: 2 };
	const all = present('all');
	expect(all(viewport)).toBe(all({ ...viewport }));
	const byId = (list: readonly Drawable[], id: string) =>
		required(
			list.find((part) => part.id === id),
			id
		);
	const [inAll, inPlan] = [all(viewport), present('plan')(viewport)];
	expect(byId(inAll, 'water-plan').visible).toBe(false);
	expect(byId(inPlan, 'water-plan').visible).toBe(true);
	expect(byId(inAll, 'dry-plan').stroke?.opacity).toBeLessThan(
		byId(inPlan, 'dry-plan').stroke?.opacity ?? 0
	);
	expect(byId(inAll, 'selected-crossings').stroke).toEqual(crossing.stroke);
}, 15_000);

test('omits an empty district envelope and leaves the stage free to fit the terrain', () => {
	const { frame, datumZ } = example();
	const envelope = projectCityDistricts([], datumZ, frame);
	expect(envelope.drawables).toEqual([]);
	expect(envelope.focus).toBeUndefined();
	expect([...envelope.points()]).toEqual([]);
});

test('uses the same sampled mountain ground in the lattice and terrain triangles', () => {
	const city = createCitySite(undefined, { relief: 1 });
	const { grid } = readCityGrid(city, 1200, 'triangle');
	const { drawables, toLocal } = projectCityTerrain(city, grid);
	const shape = required(
		drawables.find(({ finish }) => finish === 'terrain'),
		'ground'
	).shape;
	if (shape.kind !== 'mesh') throw new Error('Expected triangle ground');
	const key = (position: readonly number[]) =>
		position.map((value) => Math.round(value * 1000)).join(',');
	const points = new Set(shape.indices.map((i) => key(shape.positions.slice(3 * i, 3 * i + 3))));
	for (const {
		position: [x, y, z]
	} of grid.vertices)
		expect(points.has(key([...toLocal(x, y), z]))).toBe(true);
}, 15_000);

test('the camera elevation never falls from quarter to whole city and does not jump', () => {
	for (const relief of [0, 0.5, 1]) {
		let previous = cityElevation(relief, 0);
		for (let width = 0; width <= cityElevationRangeM[1] + 500; width += 10) {
			const elevation = cityElevation(relief, width);
			expect(elevation).toBeGreaterThanOrEqual(previous - 1e-12);
			expect(elevation - previous).toBeLessThan((0.5 * Math.PI) / 180);
			previous = elevation;
		}
	}
});

test('projects both the ground and water elevations from the alternate city sampler', () => {
	const site = createCitySite((x) =>
		x < 0
			? { height: 240, waterKind: 'river', waterClearance: x, waterHeight: 245 }
			: { height: 240, waterKind: null, waterClearance: x }
	);
	const { drawables } = projectCityTerrain(site, { vertices: [], cells: [], boundary: [] });
	expect(site.valley).toBeNull();
	for (const [id, z] of [
		['ground', 240],
		['river', 245]
	] as const) {
		const shape = required(
			drawables.find((part) => part.id === id),
			id
		).shape;
		if (shape.kind !== 'mesh') throw new Error('Expected a sampled mesh');
		expect(shape.indices.length).toBeGreaterThan(0);
		expect(shape.positions.filter((_, i) => i % 3 === 2).every((height) => height === z)).toBe(
			true
		);
	}
});

test('drapes occupied lane widths and holding outlines across pinned terrain faces', () => {
	const site = createCitySite();
	const layout = readCityGrid(site, 1800);
	const terrain = projectCityTerrain(site, layout.grid, layout.plan);
	const holdingsPlan = readCityParcels(site, layout);
	const drawables = terrain.projectParcels(holdingsPlan);
	const planStroke = (mergedUnits: typeof holdingsPlan.mergedUnits) =>
		terrain
			.projectWetPlan(layout.selectedCrossings, mergedUnits)
			.find(({ id }) => id === 'dry-plan')?.strokeSegments?.length ?? 0;
	expect(planStroke(holdingsPlan.mergedUnits)).toBeLessThan(planStroke([]));
	const lanes = required(
		drawables.find(({ id }) => id === 'pedestrian-lanes'),
		'lane reserve'
	);
	const holdings = required(
		drawables.find(({ id }) => id === 'holding-outlines'),
		'holding outlines'
	);
	if (lanes.shape.kind !== 'mesh') throw new Error('Expected meshed lane widths');
	expect(lanes.shape.indices.length).toBeGreaterThan(0);
	expect(lanes.strokeSegments?.length ?? 0).toBeGreaterThan(0);
	expect(holdings.strokeSegments?.length ?? 0).toBeGreaterThan(0);
}, 30_000);
