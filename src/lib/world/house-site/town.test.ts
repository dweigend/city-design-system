import { describe, expect, test } from 'bun:test';
import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { Part } from '../../core/object';
import { fineCellWidth, minimumParcelEdgeM, minimumStripWidthM } from '../../domain/cell-space';
import {
	houseFaces,
	houseStyles,
	type HouseStyle,
	type HouseStyleName
} from '../../domain/house-court';
import type { Parcel, ParcelBlock } from '../../domain/parcels';
import {
	blockTriangleBudget,
	faceAreaM2,
	houseCladdings,
	houseMaterials
} from '../../scene/house-projection';
import { createClad } from '../../scene/material';
import { createParcelHouse, createParcelHouseObject, createTownHouseStudy } from './index';

const tolerance = 1e-6;
const inputs = { height: 14, width: 28, complexity: 0.6, seed: 3 };
const closedSlots = new Set([
	'plot',
	'court',
	'wall',
	'mass',
	'capsule',
	'capsule-accent',
	'body-shell',
	...Object.values(houseStyles).flatMap((style: HouseStyle) => [
		...style.slots.body,
		...style.slots.roof
	])
]);

/** Inside or within the cell-space minimum edge of the ring: shorter parcel edges collapse. */
function inside(ring: readonly Vec2[], [x, y]: Vec2): boolean {
	const tolerance = minimumParcelEdgeM;
	let crossings = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [[xi, yi], [xj, yj]] = [ring[i], ring[j]];
		const onEdge =
			Math.abs((xj - xi) * (y - yi) - (yj - yi) * (x - xi)) <=
				tolerance * Math.hypot(xj - xi, yj - yi) &&
			Math.min(xi, xj) - tolerance <= x &&
			x <= Math.max(xi, xj) + tolerance &&
			Math.min(yi, yj) - tolerance <= y &&
			y <= Math.max(yi, yj) + tolerance;
		if (onEdge) return true;
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) crossings = !crossings;
	}
	return crossings;
}

function planPoints({ shape }: Part): Vec2[] {
	if (shape.kind === 'prism') return [...shape.polygon];
	if (shape.kind === 'mesh')
		return Array.from({ length: shape.positions.length / 3 }, (_, k): Vec2 => [
			shape.positions[3 * k],
			shape.positions[3 * k + 1]
		]);
	return [];
}

const study = createTownHouseStudy();
const { blocks, parcelsByBlock, portals, columns, layout, holdings, groundAt } = study;

/** The study blocks, then further perimeter blocks until at least 60 parcels, with the smallest
 * private parcel and a triangle (a wedge) among them. */
function sample(): { block: ParcelBlock; parcel: Parcel }[] {
	const order = [blocks.block, blocks.neighbour, blocks.merged];
	const all = holdings.parcels.filter(({ publicUse }) => !publicUse);
	const smallest = all.reduce((a, b) => (b.areaM2 < a.areaM2 ? b : a));
	const wedge = required(
		all.find(({ outline }) => outline.length === 3),
		'a triangular parcel'
	);
	for (const parcel of [smallest, wedge]) {
		const block = required(
			holdings.blocks.find(({ id }) => id === parcel.blockId),
			'parcel block'
		);
		if (!order.includes(block)) order.push(block);
	}
	for (const block of holdings.blocks) {
		const count = order.reduce((sum, { id }) => sum + (parcelsByBlock.get(id)?.length ?? 0), 0);
		if (count >= 60) break;
		if (block.plannedKind === 'block' && !order.includes(block)) order.push(block);
	}
	return order.flatMap((block) =>
		(parcelsByBlock.get(block.id) ?? []).map((parcel) => ({ block, parcel }))
	);
}

const parcels = sample();

function place(block: ParcelBlock, parcel: Parcel, style: HouseStyle, ground = groundAt) {
	return createParcelHouse(
		{
			parcel,
			portal: required(portals.get(parcel.portalId), 'portal'),
			block,
			columns,
			datumZ: layout.datumZ,
			linearToleranceM: holdings.linearToleranceM,
			groundAt: ground
		},
		inputs,
		style
	);
}

describe('houses on the parcels of the default town', () => {
	test('the sample holds at least 60 parcels, a wedge and the smallest parcel', () => {
		expect(parcels.length).toBeGreaterThanOrEqual(60);
		expect(parcels.some(({ parcel }) => parcel.outline.length === 3)).toBe(true);
		expect(Math.min(...parcels.map(({ parcel }) => parcel.areaM2))).toBeLessThan(110);
	});

	for (const name of Object.keys(houseStyles) as HouseStyleName[])
		test(`${name}: closed volume inside the parcel, no built sliver, a reachable entrance`, () => {
			const style = houseStyles[name];
			for (const { block, parcel } of parcels) {
				const placed = place(block, parcel, style);
				const object = createParcelHouseObject(placed, 'full');
				for (const part of object.parts.filter(({ slot }) => closedSlots.has(slot)))
					for (const point of planPoints(part)) expect(inside(parcel.outline, point)).toBe(true);
				for (const cell of placed.space.cells) {
					const run = required(
						placed.house.cells.find(({ id }) => id === cell.id),
						'cell run'
					);
					if (run.toStorey > run.fromStorey)
						expect(fineCellWidth(cell)).toBeGreaterThanOrEqual(minimumStripWidthM);
				}
				const entrance = required(
					object.anchors.find(({ name: anchor }) => anchor === 'entrance'),
					'entrance'
				);
				const [[ax, ay], [bx, by]] = required(portals.get(parcel.portalId), 'portal').points;
				const [x, y, z] = entrance.position;
				const along =
					Math.abs((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / Math.hypot(bx - ax, by - ay);
				expect(along).toBeLessThan(1e-6 * Math.max(1, Math.abs(x), Math.abs(y)));
				const rise = placed.house.site.entranceRiseM;
				expect(Math.abs(z - placed.laneZ) < tolerance || rise <= 0.15 + tolerance).toBe(true);
			}
		}, 60000);

	test('strip spaces keep every cell at least the minimum width', () => {
		let strips = 0;
		for (const { block, parcel } of parcels) {
			const { space } = place(block, parcel, houseStyles.neutral);
			if (!space.cells.every(({ id }) => id.includes('/strip/') && !id.includes('/part/')))
				continue;
			strips += 1;
			for (const cell of space.cells)
				expect(fineCellWidth(cell)).toBeGreaterThanOrEqual(minimumStripWidthM - tolerance);
		}
		expect(strips).toBeGreaterThan(parcels.length * 0.8);
	}, 60000);

	test('a house backing onto the block court opens to it instead of cutting its own', () => {
		let opened = 0;
		for (const { parcel } of parcels.filter(({ block }) => block === blocks.block)) {
			const placed = place(blocks.block, parcel, houseStyles.neutral);
			if (!placed.house.courtAccess) continue;
			opened += 1;
			expect(placed.house.cells.some(({ role }) => role === 'court')).toBe(false);
			const object = createParcelHouseObject(placed, 'full');
			expect(object.anchors.some(({ name }) => name === 'court')).toBe(true);
		}
		expect(opened).toBeGreaterThan(0);
	}, 60000);

	test('the merged unit is one large building over the whole unit', () => {
		const parcel = required(parcelsByBlock.get(blocks.merged.id)?.[0], 'merged parcel');
		for (const style of [houseStyles.neutral, houseStyles.memphis]) {
			const placed = place(blocks.merged, parcel, style);
			expect(placed.house.scale).toBe('large');
			const built = placed.house.cells.filter(({ toStorey }) => toStorey > 0).length;
			expect(built).toBeGreaterThan(placed.space.cells.length * 0.9);
		}
	}, 60000);

	test('a block of clad houses stays within its triangle budget and is deterministic', () => {
		for (const name of ['neutral', 'memphis'] as const) {
			const style = houseStyles[name];
			const houses = (parcelsByBlock.get(blocks.block.id) ?? []).map((parcel) => {
				const placed = place(blocks.block, parcel, style);
				const faces = houseFaces(placed.space, placed.house, 'full', style);
				return { placed, faces, area: faces.reduce((sum, face) => sum + faceAreaM2(face), 0) };
			});
			const area = houses.reduce((sum, { area: a }) => sum + a, 0);
			const triangles = houses.reduce((sum, { placed, faces, area: a }) => {
				const object = createParcelHouseObject(placed, 'full');
				const budget = (blockTriangleBudget * a) / area;
				const clad = createClad(object, houseCladdings(faces, houseMaterials[name], budget), {
					level: 'relief'
				});
				return sum + clad.triangles;
			}, 0);
			expect(triangles).toBeGreaterThan(0);
			expect(triangles).toBeLessThanOrEqual(blockTriangleBudget);
		}
		const { block, parcel } = parcels[0];
		const once = createParcelHouseObject(place(block, parcel, houseStyles.memphis), 'full');
		const twice = createParcelHouseObject(place(block, parcel, houseStyles.memphis), 'full');
		expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
	}, 60000);
});

describe('ground contact on relief 0 and 0.5', () => {
	for (const relief of [0, 0.5])
		test(`relief ${relief}: plinths reach the ground and steps start at the lane`, () => {
			const town = createTownHouseStudy({ relief });
			for (const block of [town.blocks.block, town.blocks.neighbour])
				for (const parcel of town.parcelsByBlock.get(block.id) ?? []) {
					const placed = createParcelHouse(
						{
							parcel,
							portal: required(town.portals.get(parcel.portalId), 'portal'),
							block,
							columns: town.columns,
							datumZ: town.layout.datumZ,
							linearToleranceM: town.holdings.linearToleranceM,
							groundAt: town.groundAt
						},
						inputs,
						houseStyles.memphis
					);
					const object = createParcelHouseObject(placed, 'full');
					const ground = Math.min(
						...parcel.outline.map((point) => town.groundAt(point)),
						placed.laneZ
					);
					for (const { slot, shape } of object.parts)
						if (slot === 'plot' && shape.kind === 'prism')
							expect(shape.base).toBeLessThanOrEqual(ground + tolerance);
					const steps = object.parts.find(({ id }) => id.endsWith('/steps'));
					if (placed.house.site.entranceRiseM > 0.15) {
						expect(steps).toBeDefined();
						if (steps?.shape.kind === 'mesh') {
							const zs = steps.shape.positions.filter((_, k) => k % 3 === 2);
							expect(Math.max(...zs)).toBeCloseTo(placed.space.baseZ, 6);
						}
					}
				}
		}, 60000);
});
