import { expect, test } from 'bun:test';
import { example } from './example';

test('offers a stronger cork grain than card fibre and a visible joint stroke', () => {
	const { modelGrain, pencilStroke } = example();
	expect(modelGrain.cork.amount).toBeGreaterThan(modelGrain.card.amount);
	expect(modelGrain.card.cellM).toBeGreaterThan(0);
	expect(pencilStroke.width).toBeGreaterThan(0);
});
