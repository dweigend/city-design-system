import { checkProductionGroup } from './production-group.fixture.test';
checkProductionGroup('park-specimens');

import { expect, test } from 'bun:test';
import { buildObject } from '../../logic/assets';

test('pollard crowns stay low and no one clump dominates the hedge', () => {
	for (const variant of ['low-crown', 'street-crown', 'park-crown']) {
		for (const seed of [0, 17, 2026]) {
			const { geometry } = buildObject('pollard-park-tree-2p5m', variant, seed);
			const clumps = geometry.filter((part) => part.kind === 'sphere');
			expect(clumps.length).toBeGreaterThanOrEqual(3);
			expect(clumps.length).toBeLessThanOrEqual(5);
			const radii = clumps.map((part) => part.radius);
			expect(Math.max(...radii) / Math.min(...radii)).toBeLessThanOrEqual(1.6);
			const top = Math.max(...clumps.map((p) => p.position[2] + p.radius * (p.squash ?? 1)));
			const right = Math.max(...clumps.map((p) => p.position[0] + p.radius));
			const left = Math.min(...clumps.map((p) => p.position[0] - p.radius));
			expect(top / (right - left)).toBeLessThanOrEqual(0.8);
		}
	}
});
