import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { createCellSpace } from '../../lib/domain/cell-space';
import { createHouseCourt, createHouseObject } from '../../lib/domain/house-court';
import { parcelShapes } from './parcels';

// Full neutral placeable objects at 1b4514ee, including envelope and opening meshes.
const specimens = {
	rectangle: '35cbe514e29b25d0e2f2b3749f436528759407e970dd4bacda96ce2c05aed55a',
	trapezoid: '74e3bd6491a1b2544bbfb37a9887dd142dd9a15f007f656f2376a7bd4aa69a2d',
	hexagon: 'bf449f19e4ac8f8ec1f1b813f453421de45d637b5854c8d5ea31e4604e99104b',
	triangle: 'c315298aba1240eb102bcc0412402a4afdf215d3be8e0d15d49fddbdcd8d42a9',
	ell: '073cff312687a3b49e6db3a13894eb82b732d30ea2e7bc3493bb5b7504a7fd88'
};

test('the regular neutral specimens preserve their serialized geometry', () => {
	const inputs = { height: 14, width: 28, complexity: 0.6, seed: 3 };
	for (const key of Object.keys(parcelShapes) as (keyof typeof parcelShapes)[]) {
		const space = createCellSpace(parcelShapes[key].parcel);
		const object = createHouseObject(space, createHouseCourt(space, inputs), 'full');
		expect(createHash('sha256').update(JSON.stringify(object)).digest('hex')).toBe(specimens[key]);
	}
});
