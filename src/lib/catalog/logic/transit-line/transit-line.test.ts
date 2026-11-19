import { expect, test } from 'bun:test';
import { createTerrain } from '../terrain';
import { cellAtPoint, deriveGrid } from '../terrain-grid';
import {
	lineParts,
	routeLine,
	vehiclePoses,
	VEHICLE,
	type TransitKind,
	type TransitPose,
	type TransitPillar,
	type TransitStop
} from './index';

const grid = deriveGrid(createTerrain({ seed: 7 }));
function route(kind: TransitKind, cellIds: string[]) {
	const line = routeLine(grid, { id: 'test', kind, cellIds });
	if (!line) throw new Error('Expected a route');
	return line;
}
const straight = ['40/60', '40/95'];

test('a sparse saved profile falls back to defaults and validates values on read', () => {
	const line = route('capsule', straight);
	const partial = { ...line, profile: { supportRadius: 0.4 } };
	expect(lineParts(partial)[0]).toEqual(lineParts(line)[0]);
	expect(vehiclePoses(partial, 10)).toEqual(vehiclePoses(line, 10));
	const invalid = { ...line, profile: { hoopSpacing: 0.001 } };
	expect(() => lineParts(invalid)).toThrow(RangeError);
	expect(() => vehiclePoses(invalid, 10)).toThrow(RangeError);
});

test('rejects incompatible deck, station and hoop dimensions', () => {
	const stroke = { id: 'test', kind: 'viaduct', cellIds: straight } as const;
	expect(() => routeLine(grid, stroke, { clearance: 1, deckRadius: 1 })).toThrow(/Deck radius/);
	expect(() =>
		routeLine(grid, stroke, { clearance: 1, platformDrop: 0.6, platformHeight: 0.4 })
	).toThrow(/Station drop/);
	expect(() =>
		routeLine(grid, { ...stroke, kind: 'capsule' }, { clearance: 1.5, platformDrop: 1.5 })
	).toThrow(/Station drop/);
	expect(() => routeLine(grid, { ...stroke, kind: 'capsule' }, { deckRadius: 1.4 })).toThrow(
		/hoop radius/
	);
});

for (const kind of ['viaduct', 'capsule'] as const) {
	test(kind + ' crosses the scarp above ground within grade on a straight alignment', () => {
		const line = route(kind, straight);
		const [a, b] = straight.map((id) => grid.cellsById.get(id)?.center);
		if (!a || !b) throw new Error('Missing cell');
		const clearance = kind === 'viaduct' ? 9 : 6;
		expect(line.path[0].slice(0, 2)).toEqual(a.slice(0, 2));
		expect(line.path.at(-1)?.slice(0, 2)).toEqual(b.slice(0, 2));
		expect(line.path[0][2]).toBeGreaterThanOrEqual(a[2] + clearance - 1e-8);
		expect(line.path[line.path.length - 1][2]).toBeGreaterThanOrEqual(b[2] + clearance - 1e-8);
		for (const [i, p] of line.path.entries()) {
			const cell = cellAtPoint(grid, p[0], p[1]);
			if (!cell) throw new Error('Missing ground under scarp stroke');
			const low = Math.min(cell.center[2], ...cell.corners.map((c) => c[2]));
			expect(p[2]).toBeGreaterThanOrEqual(low + clearance - 1e-8);
			expect(Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0]))).toBeLessThan(
				1e-7
			);
			if (i) {
				const q = line.path[i - 1];
				expect(Math.abs(p[2] - q[2]) / Math.hypot(p[0] - q[0], p[1] - q[1])).toBeLessThanOrEqual(
					(kind === 'viaduct' ? 0.04 : 0.08) + 1e-9
				);
			}
		}
	});
	test(kind + ' rounds an L within its discrete curvature limit', () => {
		const { path } = route(kind, ['40/35', '80/35', '80/75']);
		for (let i = 1; i < path.length - 1; i++) {
			const [a, b, c] = path.slice(i - 1, i + 2);
			const x = b[0] - a[0],
				y = b[1] - a[1],
				u = c[0] - b[0],
				v = c[1] - b[1];
			const curvature =
				(2 * Math.abs(x * v - y * u)) /
				(Math.hypot(x, y) * Math.hypot(u, v) * Math.hypot(x + u, y + v));
			expect(curvature).toBeLessThanOrEqual(1 / (kind === 'viaduct' ? 30 : 18) + 1e-9);
		}
	});
	test(kind + ' spaces supports and places stations on deck samples', () => {
		const line = route(kind, ['40/35', '140/35']);
		const distances = [0];
		for (let i = 1; i < line.path.length; i++) {
			const a = line.path[i - 1],
				b = line.path[i];
			distances.push(distances[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
		}
		const stations = line.stops.map(
			(s: TransitStop) =>
				distances[line.path.findIndex((p) => p.every((n, i) => n === s.position[i]))]
		);
		expect(stations[0]).toBe(0);
		expect(stations.at(-1)).toBeCloseTo(line.length);
		stations.slice(1).forEach((s, i) => expect(s - stations[i]).toBeLessThanOrEqual(180));
		const spacing = kind === 'viaduct' ? 20 : 15;
		expect(line.pillars.length).toBe(Math.floor((line.length - 4) / spacing));
		line.pillars.forEach((pillar: TransitPillar, i) => {
			const start = line.path[0];
			expect(Math.hypot(pillar.foot[0] - start[0], pillar.foot[1] - start[1])).toBeCloseTo(
				(i + 1) * spacing,
				0
			);
		});
		expect(
			lineParts(line).every(
				(p) => p.id.startsWith(line.id) && p.material === 'concrete' && p.role === 'neu'
			)
		).toBe(true);
	});
}
test('pods dwell at the terminal and retrace the tube', () => {
	const line = route('capsule', straight);
	const arrival = 3 + line.length / 15;
	const outbound = vehiclePoses(line, arrival - 1)[0],
		inbound = vehiclePoses(line, arrival + 4)[0];
	expect(inbound).toEqual(vehiclePoses(line, arrival + 4)[0]);
	inbound.position.forEach((v, i) => expect(v).toBeCloseTo(outbound.position[i], 8));
	expect(Math.cos(inbound.headingRad - outbound.headingRad)).toBeCloseTo(-1);
	expect(vehiclePoses(line, arrival + 1)[0].position).toEqual(line.path[line.path.length - 1]);
});
test('unknown, repeated and too-short strokes cannot create a line', () => {
	for (const cellIds of [[], ['bad', '40/60', 'bad', '40/60'], ['40/60', '41/60']])
		expect(routeLine(grid, { id: 'a', kind: 'viaduct', cellIds })).toBeUndefined();
});

test('three cars keep their spacing on a grade and dwell together', () => {
	const line = route('viaduct', straight);
	const poses: TransitPose[] = vehiclePoses(line, 0);
	expect(poses).toHaveLength(3);
	expect(vehiclePoses(line, 2)).toEqual(poses);
	const arrival = 3 + (line.length - 22.2) / 11;
	for (const [i, pose] of poses.entries()) {
		const distance = 3.5 + i * 7.6;
		let remaining = distance;
		for (let j = 1; j < line.path.length; j++) {
			const a = line.path[j - 1],
				b = line.path[j];
			const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
			if (remaining > length) {
				remaining -= length;
				continue;
			}
			a.forEach((v, k) =>
				expect(pose.position[k]).toBeCloseTo(
					v + ((b[k] - v) * remaining) / length + (k === 2 ? 1.5 : 0),
					8
				)
			);
			break;
		}
	}
	expect(vehiclePoses(line, arrival + 1)).toEqual(vehiclePoses(line, arrival + 2));
});

test('static parts retain the station survey after serialization', () => {
	for (const kind of ['viaduct', 'capsule'] as const) {
		const line = route(kind, straight);
		const parts = lineParts(line);
		expect(parts).toEqual(lineParts(structuredClone(line)));
		expect(parts[0]).toMatchObject(
			kind === 'viaduct'
				? { kind: 'pipe', radius: 0.55, token: '--cat-business' }
				: { kind: 'pipe', radius: 1.25, glass: true, token: '--cat-business' }
		);
		const shaft = parts.find((p) => p.id === line.id + '/stop/0/shaft');
		if (shaft?.kind !== 'cylinder') throw new Error('Missing shaft');
		const cell = cellAtPoint(grid, shaft.position[0], shaft.position[1]);
		if (!cell) throw new Error('Missing shaft ground');
		const heights = [cell.center[2], ...cell.corners.map((p) => p[2])];
		expect(shaft.position[2]).toBeGreaterThanOrEqual(Math.min(...heights));
		expect(shaft.position[2]).toBeLessThanOrEqual(Math.max(...heights));
	}
});

test('routing ignores unknown and consecutive duplicate cells and preserves vehicle dimensions', () => {
	expect(route('capsule', [straight[0], 'missing', ...straight])).toEqual(
		route('capsule', straight)
	);
	expect(VEHICLE).toEqual({
		viaduct: { length: 7, radius: 1.15, cars: 3 },
		capsule: { length: 3.4, radius: 0.95, cars: 1 }
	});
});

test('a stroke traced exactly back to its origin collapses without a singular turn', () => {
	expect(
		routeLine(grid, { id: 'backtrack', kind: 'viaduct', cellIds: ['40/40', '40/80', '40/40'] })
	).toBeUndefined();
});
