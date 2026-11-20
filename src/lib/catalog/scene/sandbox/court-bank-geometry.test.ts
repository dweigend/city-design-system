import { expect, test } from 'bun:test';
import { type BufferGeometry, Mesh, Ray, Vector3 } from 'three/webgpu';
import { acceptanceScene, cityCorridorSite, createWorld } from '../../logic/sandbox';
import { bankHeight, cellAtPoint } from '../../logic/terrain-grid';
import { required } from '../../logic/required';
import { createTerrainMesh } from './terrain-mesh';
import { createTerrainPicker } from './terrain-pick';

test('court bank contours and terrain picks follow the same physical faces in the acceptance scene', () => {
	const { grid } = acceptanceScene(7).world;
	const scene = createTerrainMesh(grid);
	const banks = scene.group.children.find(
		(p) => p instanceof Mesh && p !== scene.surface && p.material === scene.surface.material
	);
	if (!(banks instanceof Mesh)) throw new Error('Court banks missing from terrain surface');
	const geometry: BufferGeometry = banks.geometry;
	const { position, relief, bankShade } = geometry.attributes;
	const indices = required(geometry.index, 'bank triangles');
	const picker = createTerrainPicker();
	picker.setGrid(grid);
	expect(indices.count).toBeGreaterThan(0);
	expect(bankShade.array.some((v) => v > 0.2)).toBe(true);
	for (let i = 0; i < indices.count; i += 531) {
		const centre = new Vector3();
		for (let j = 0; j < 3; j++) {
			const k = indices.getX(i + j);
			expect(relief.getX(k)).toBe(position.getY(k));
			centre.add(new Vector3().fromBufferAttribute(position, k));
		}
		centre.divideScalar(3);
		const cell = required(cellAtPoint(grid, centre.x, -centre.z), 'bank parcel');
		expect(bankHeight(cell, centre.x, -centre.z)).toBeCloseTo(centre.y, 4);
		const hit = required(
			picker.pick(new Ray(new Vector3(centre.x, 100, centre.z), new Vector3(0, -1, 0))),
			'bank pick'
		);
		expect(hit.index).toBe(cell.index);
		expect(100 - hit.distance).toBeCloseTo(centre.y, 4);
	}
	scene.setGrid(createWorld(7).grid);
	expect(banks.geometry.index?.count).toBe(0);
	scene.dispose();
}, 60000);

test('the seed-seven hillside court meets a fill bank and cuts into the opposite slope', () => {
	const [, , courts, ground] = required(cityCorridorSite(acceptanceScene(7).world), 'court survey');
	const court = required(
		courts.find((c) => c.id === '23/35'),
		'hillside court'
	);
	const [cx, cy, top] = court.position;
	const section = (side: number, outward: number) => {
		const a = court.polygon[side],
			b = court.polygon[(side + 1) % 4];
		const dx = (a[0] + b[0]) / 2 - cx,
			dy = (a[1] + b[1]) / 2 - cy;
		const scale = 1 + outward / Math.hypot(dx, dy);
		return ground(cx + scale * dx, cy + scale * dy);
	};
	for (const side of [1, 3]) {
		expect(top - section(side, 0)).toBeGreaterThan(0);
		expect(top - section(side, 0)).toBeLessThan(0.08);
	}
	expect(section(3, 0) - section(3, 4.5)).toBeGreaterThan(0.5);
	expect(section(1, 2) - section(1, 0)).toBeGreaterThan(0.4);
	expect(section(1, 4.5)).toBeGreaterThan(section(1, 0));
}, 60000);
