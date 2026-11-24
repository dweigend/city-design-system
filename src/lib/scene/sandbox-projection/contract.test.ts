import { expect, test } from 'bun:test';
import { example } from './example';

test('keeps the town frame reversible and adds only a draped marker for the hovered parcel', () => {
	const { projection, parcel } = example();
	const [x, y] = parcel.outline[0];
	const [wx, wy] = projection.toWorld(...projection.toLocal(x, y));
	expect(wx).toBeCloseTo(x);
	expect(wy).toBeCloseTo(y);
	const marker = projection.projectHover(parcel);
	expect(marker.strokeSegments?.length).toBeGreaterThanOrEqual(parcel.outline.length * 6);
	expect(projection.background.some(({ id }) => id === marker.id)).toBe(false);
});
