import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { createCellSpace } from '../../lib/domain/cell-space';
import { createHouseCourt, createHouseObject } from '../../lib/domain/house-court';
import { parcelShapes } from './parcels';

// Full neutral model houses (#91), including envelope, rim, opening and canopy meshes.
const specimens = {
	rectangle: 'afdbdcc52d49553d5aac3600df2149ae36fe79fc7ecde3cc11cf29ab258cfe6f',
	trapezoid: '07d738002798d0b561bfb01ef739bef2dc0a2b96b92ab60dd3f2ff944cf3c220',
	hexagon: '852fed06adf567e8d098e6ba6c7fd81fbdbf9bf926cbaaa0b3b6364740163a65',
	triangle: '6e841e7a6585c4e807422491186228c86ac86b0801e493bf1f67fcfc3c692b87',
	ell: '67081efbd43b3090be6843b42696441516e9f0c60bc57cf587c41d845e9c4469'
};

test('the regular neutral specimens preserve their serialized geometry', () => {
	const inputs = { height: 14, width: 28, complexity: 0.6, seed: 3 };
	for (const key of Object.keys(parcelShapes) as (keyof typeof parcelShapes)[]) {
		const space = createCellSpace(parcelShapes[key].parcel);
		const object = createHouseObject(space, createHouseCourt(space, inputs), 'full');
		expect(createHash('sha256').update(JSON.stringify(object)).digest('hex')).toBe(specimens[key]);
	}
});
