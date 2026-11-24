import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import { houseFaces, houseStyles } from '../../domain/house-court';
import {
	createParcelHouse,
	createParcelHouseObject,
	createTownHouseStudy
} from '../../world/house-site';
import { createClad } from '../material';
import { blockTriangleBudget, faceAreaM2, houseCladdings, houseMaterials } from './index';

test('a block of clad town houses stays within the block triangle budget at relief', () => {
	const { blocks, parcelsByBlock, portals, columns, layout, holdings, groundAt } =
		createTownHouseStudy();
	for (const name of ['neutral', 'memphis'] as const) {
		const style = houseStyles[name];
		const houses = (parcelsByBlock.get(blocks.block.id) ?? []).map((parcel) => {
			const placed = createParcelHouse(
				{
					parcel,
					portal: required(portals.get(parcel.portalId), 'portal'),
					block: blocks.block,
					columns,
					datumZ: layout.datumZ,
					linearToleranceM: holdings.linearToleranceM,
					groundAt
				},
				{ height: 14, width: 28, complexity: 0.6, seed: 3 },
				style
			);
			const faces = houseFaces(placed.space, placed.house, 'full', style);
			return { placed, faces, area: faces.reduce((sum, face) => sum + faceAreaM2(face), 0) };
		});
		const total = houses.reduce((sum, { area }) => sum + area, 0);
		const triangles = houses.reduce((sum, { placed, faces, area }) => {
			const claddings = houseCladdings(
				faces,
				houseMaterials[name],
				(blockTriangleBudget * area) / total
			);
			const clad = createClad(createParcelHouseObject(placed, 'full'), claddings, {
				level: 'relief'
			});
			return sum + clad.triangles;
		}, 0);
		expect(triangles).toBeGreaterThan(0);
		expect(triangles).toBeLessThanOrEqual(blockTriangleBudget);
	}
}, 60000);
