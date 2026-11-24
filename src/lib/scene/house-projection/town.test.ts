import { expect, test } from 'bun:test';
import { createStripSpace, parcelEdgeId, type Parcel } from '../../domain/cell-space';
import {
	createHouseCourt,
	createHouseObject,
	houseFaces,
	houseStyles,
	readHouseFeatures,
	type HouseStyleName
} from '../../domain/house-court';
import {
	createTownBlockHouses,
	createParcelHouseObject,
	createTownHouseStudy
} from '../../world/house-site';
import { createClad } from '../material';
import {
	blockTriangleBudget,
	faceAreaM2,
	houseCladdings,
	houseMaterials,
	planHouseMaterials,
	projectCladHouse,
	readHouseSalience
} from './index';

const town = createTownHouseStudy();
const setup = { height: 14, width: 28, complexity: 0.6, seed: 3 };
const styles = Object.keys(houseStyles) as HouseStyleName[];

function block(name: HouseStyleName) {
	const style = houseStyles[name];
	return createTownBlockHouses(town, town.blocks.block, setup, style).placed.map((house) => ({
		house,
		object: createParcelHouseObject(house, 'full', house.adjoiningWalls),
		faces: houseFaces(house.space, house.house, 'full', style, house.adjoiningWalls)
	}));
}

test('a block of model houses stays within the block budget, a small share of the relief block', () => {
	for (const name of ['neutral', 'memphis'] as const) {
		const houses = block(name);
		const area = (faces: (typeof houses)[number]['faces']) =>
			faces.reduce((sum, face) => sum + faceAreaM2(face), 0);
		const total = houses.reduce((sum, { faces }) => sum + area(faces), 0);
		const triangles = houses.reduce((sum, { object, faces }) => {
			const budget = (blockTriangleBudget * area(faces)) / total;
			const claddings = houseCladdings(faces, houseMaterials[name], budget, 'near', object.id);
			return sum + createClad(object, claddings, { level: 'near' }).triangles;
		}, 0);
		expect(triangles).toBeGreaterThan(0);
		expect(triangles).toBeLessThanOrEqual(blockTriangleBudget);
	}
}, 60000);

test('every house of every style wears at most three materials, one per body', () => {
	for (const name of styles) {
		const materials = houseMaterials[name];
		for (const { object, faces } of block(name)) {
			const plan = planHouseMaterials(materials, object.id, setup.seed);
			const roles = new Set(
				object.slots.flatMap((slot) => {
					const role = (materials.slots as Partial<Record<string, string>>)[slot];
					return role && role !== 'roof' ? [role] : [];
				})
			);
			const worn = new Set(
				[...roles].map((role) => JSON.stringify(plan[role as keyof typeof plan]))
			);
			expect({ name, house: object.id, parts: worn.size <= 3 }).toEqual({
				name,
				house: object.id,
				parts: true
			});
			const claddings = houseCladdings(
				faces,
				materials,
				blockTriangleBudget,
				'near',
				object.id,
				setup.seed
			);
			const byBody = new Map<string, Set<string>>();
			for (const { body, family, tone, patch } of claddings) {
				if (patch.normal[2] > 0.5) continue;
				const set = byBody.get(body ?? '') ?? new Set();
				set.add(`${family}/${tone ?? ''}`);
				byBody.set(body ?? '', set);
			}
			for (const set of byBody.values()) expect(set.size).toBe(1);
		}
	}
}, 60000);

test('a house is plain by default; a granted level adds openings; builds are cached', () => {
	const [{ object, faces }] = block('neutral');
	const options = { budget: blockTriangleBudget, seed: setup.seed };
	const plain = projectCladHouse(object, faces, houseMaterials.neutral, 'full', options);
	const near = projectCladHouse(object, faces, houseMaterials.neutral, 'full', {
		...options,
		level: 'near'
	});
	expect(plain.triangles).toBe(0);
	expect(plain.drawables.some(({ id }) => id.endsWith('/openings'))).toBe(false);
	expect(
		new Set(plain.drawables.filter(({ id }) => id.includes('envelope')).map(({ color }) => color))
			.size
	).toBe(1);
	expect(near.drawables.some(({ id }) => id.endsWith('/openings'))).toBe(true);
	expect(near.triangles).toBeGreaterThan(0);
	const flat = projectCladHouse(object, faces, houseMaterials.neutral, 'full', {
		...options,
		level: 'flat'
	});
	expect(flat.drawables.map(({ id }) => id)).toEqual(plain.drawables.map(({ id }) => id));
	const again = projectCladHouse(object, faces, houseMaterials.neutral, 'full', {
		...options,
		level: 'near'
	});
	expect(again.drawables[0].shape).toBe(near.drawables[0].shape);
});

test('salience grants detail to few houses: capped per block, deterministic, focus first', () => {
	const houses = block('memphis').map(({ house, object }) => ({
		id: object.id,
		block: 'b',
		features: readHouseFeatures(house.space, house.house)
	}));
	const levels = readHouseSalience([...houses, { ...houses[0], id: 'focus', focus: true }], 3);
	const granted = [...levels].filter(([id, level]) => id !== 'focus' && level !== 'plain');
	expect(granted.length).toBeGreaterThan(0);
	expect(granted.length).toBeLessThanOrEqual(3);
	expect(levels.get('focus')).toBe('near');
	expect(readHouseSalience(houses, 3)).toEqual(readHouseSalience(houses, 3));
});

test('a 6 × 16 m parcel with a shallow rear notch can be clad', () => {
	const parcel: Parcel = {
		id: 'notched',
		corners: [
			{ id: 'a', position: [0, 0] },
			{ id: 'b', position: [6, 0] },
			{ id: 'c', position: [6, 16] },
			{ id: 'd', position: [3, 15.96] },
			{ id: 'e', position: [0, 16] }
		],
		frontage: [parcelEdgeId('a', 'b')],
		baseZ: 0,
		storeyCount: 4
	};
	const space = createStripSpace(parcel);
	const house = createHouseCourt(space, { seed: 3 }, houseStyles.neutral, { scale: 'calm' });
	const faces = houseFaces(space, house, 'full');
	const claddings = houseCladdings(faces, houseMaterials.neutral, blockTriangleBudget);
	expect(claddings.length).toBeGreaterThan(0);
	expect(
		createClad(createHouseObject(space, house, 'full'), claddings, { level: 'near' }).triangles
	).toBeGreaterThan(0);
});
