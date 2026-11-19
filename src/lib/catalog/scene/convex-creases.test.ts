import { expect, test } from 'bun:test';
import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu';
import { creaseChart } from './convex-creases';

function fold(height: number) {
	const geometry = new BufferGeometry();
	geometry.setAttribute(
		'position',
		new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, height], 3)
	);
	creaseChart(geometry, 0.15);
	return geometry.getAttribute('creaseDistance');
}

test('a convex shared edge bends the normal only within its bevel width', () => {
	const distances = fold(-1);
	expect(distances.getX(0)).toBe(0);
	expect(distances.getX(1)).toBe(0);
	expect(distances.getX(2)).toBeCloseTo(1 / 0.15);
	expect(distances.getX(3)).toBe(0);
});
test('a re-entrant fold leaves the contact joint unpolished', () => {
	expect([...fold(1).array].every((d) => d > 1)).toBe(true);
});
