import { expect, test } from 'bun:test';
import { buildObject } from './index';

test('the rung bay fits in front of its facade with the rung above the mounting origin', () => {
	const { geometry, footprint, anchors } = buildObject('ladder', 'rung-bay', 17);
	expect(anchors[0]).toMatchObject({ attachment: 'facade', position: [0, 0, 0] });
	for (const [index, part] of geometry.entries()) {
		if (part.kind !== 'pipe') throw Error('Expected ladder member');
		for (const [x, y, z] of part.points) {
			expect(x - part.radius).toBeGreaterThanOrEqual(0);
			expect(x + part.radius).toBeLessThanOrEqual(footprint[0]);
			expect(Math.abs(y) + part.radius).toBeLessThanOrEqual(footprint[1] / 2);
			if (index === 0) expect(z - part.radius).toBeGreaterThan(0);
		}
	}
});
