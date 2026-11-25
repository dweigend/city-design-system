import { expect, test } from 'bun:test';
import { createTownReview } from './town';

test('the whole town shows retained stock, upper work and the six uses on the same geometry', () => {
	const town = createTownReview();
	const normal = town.draw('town').filter(({ useColor }) => useColor !== undefined);
	const focus = town.draw('houses').filter(({ useColor }) => useColor !== undefined);
	const transparent = town.draw('town', true).filter(({ useColor }) => useColor !== undefined);
	expect(new Set(focus.map(({ color }) => color))).toEqual(
		new Set([
			'--path',
			'--cat-living',
			'--cat-mobility',
			'--body-living',
			'--cat-nature',
			'--cat-foliage'
		])
	);
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
	expect(focus).toHaveLength(normal.length);
	for (const [index, body] of normal.entries()) {
		expect(focus[index].shape).toBe(body.shape);
		expect(transparent[index].shape).toBe(body.shape);
		expect(transparent[index]).toMatchObject({ color: body.useColor, preserveColor: true });
	}
}, 30_000);
