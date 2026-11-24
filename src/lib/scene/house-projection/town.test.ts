import { expect, test } from 'bun:test';
import { createStripSpace, parcelEdgeId, type Parcel } from '../../domain/cell-space';
import {
	createHouseCourt,
	createHouseObject,
	houseFaces,
	houseStyles
} from '../../domain/house-court';
import {
	createTownBlockHouses,
	createParcelHouseObject,
	createTownHouseStudy
} from '../../world/house-site';
import { createClad } from '../material';
import { blockTriangleBudget, faceAreaM2, houseCladdings, houseMaterials } from './index';

test('a block of clad town houses stays within the block triangle budget at relief', () => {
	const town = createTownHouseStudy();
	for (const name of ['neutral', 'memphis'] as const) {
		const style = houseStyles[name];
		const { placed } = createTownBlockHouses(
			town,
			town.blocks.block,
			{
				height: 14,
				width: 28,
				complexity: 0.6,
				seed: 3
			},
			style
		);
		const houses = placed.map((house) => {
			const faces = houseFaces(house.space, house.house, 'full', style, house.adjoiningWalls);
			return { house, faces, area: faces.reduce((sum, face) => sum + faceAreaM2(face), 0) };
		});
		const total = houses.reduce((sum, { area }) => sum + area, 0);
		const triangles = houses.reduce((sum, { house, faces, area }) => {
			const claddings = houseCladdings(
				faces,
				houseMaterials[name],
				(blockTriangleBudget * area) / total
			);
			const clad = createClad(
				createParcelHouseObject(house, 'full', house.adjoiningWalls),
				claddings,
				{
					level: 'relief'
				}
			);
			return sum + clad.triangles;
		}, 0);
		expect(triangles).toBeGreaterThan(0);
		expect(triangles).toBeLessThanOrEqual(blockTriangleBudget);
	}
}, 60000);

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
	const materials = houseCladdings(faces, houseMaterials.neutral, blockTriangleBudget);
	const flat = houseCladdings(faces, houseMaterials.neutral, blockTriangleBudget, 'flat');
	expect(flat.length).toBe(materials.length);
	expect(flat.every(({ moduleScale }) => moduleScale === undefined)).toBe(true);
	expect(
		createClad(createHouseObject(space, house, 'full'), materials, { level: 'relief' }).triangles
	).toBeGreaterThan(0);
});
