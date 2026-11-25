import { expect, test } from 'bun:test';
import { createTownReview } from './town';
import { houseUseColors } from '../../lib/scene/house-projection';

test('the whole town shows retained stock, upper work and the six uses on the same geometry', () => {
	const town = createTownReview();
	const normal = town.draw('town').filter(({ useColor }) => useColor !== undefined);
	const focus = town.draw('houses').filter(({ useColor }) => useColor !== undefined);
	expect(new Set(focus.map(({ color }) => color))).toEqual(new Set(Object.values(houseUseColors)));
	expect(normal.some(({ color }) => color === '--stock-pencil' || color === '--stock-veil')).toBe(
		true
	);
	expect(
		normal.some(({ color, finish }) => color === '--model-acrylic' && finish === 'glass')
	).toBe(true);
	expect(
		town.draw('town').some(({ id, visible }) => visible && id.includes('/addition-frame/'))
	).toBe(true);
	expect(town.figures.walkwaysKm).toBeGreaterThan(0);
	expect(town.figures.triangles).toBeGreaterThan(0);
	expect(focus).toHaveLength(normal.length);
	for (const [index, body] of normal.entries()) {
		expect(focus[index].shape).toBe(body.shape);
		expect(body.preserveColor).toBeUndefined();
		expect(focus[index]).toMatchObject({
			color: body.useColor,
			preserveColor: true,
			hatch: undefined,
			occlude: undefined
		});
	}
	const pathHouses = town.draw('paths').filter(({ useColor }) => useColor !== undefined);
	expect(
		pathHouses.every(({ preserveColor, color }) => !preserveColor && color === '--paper')
	).toBe(true);
}, 30_000);
