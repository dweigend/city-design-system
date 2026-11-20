import { test, expect } from 'bun:test';
import { cases, type Variant } from './sites';
import { measure } from './measure';

/** Registers a bounded subset and emits one independent measurement per test. */
export function subset(variant: Variant) {
	for (const c of cases(variant))
		test(c.name, () => {
			let metrics;
			try {
				metrics = measure(c);
			} catch (error) {
				console.log(
					'HOUSE ' + JSON.stringify({ name: c.name, seed: c.seed, failure: String(error) })
				);
				throw error;
			}
			console.log('HOUSE ' + JSON.stringify({ name: c.name, seed: c.seed, ...metrics }));
			expect(metrics.missingGalleries).toEqual([]);
			expect(metrics.errors).toEqual([]);
			expect(metrics.share).toBeLessThanOrEqual(0.1);
			expect(metrics.isolated).toBeLessThanOrEqual(3);
			expect(metrics.isolatedCollisions).toBe(0);
			expect(metrics.collisions).toBe(0);
			expect(metrics.components).toBeGreaterThan(0);
			expect(metrics.components).toBeLessThanOrEqual(3);
		});
}
