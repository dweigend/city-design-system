import { expect, test } from 'bun:test';
import { buildObject } from './index';

test('both stringers support a flight of separate treads', () => {
	for (const v of ['short-flight', 'wide-flight', 'landing-flight']) {
		const { geometry } = buildObject('stairs', v, 17);
		const cheeks = geometry.filter((g) => g.kind === 'mesh' && g.slot === 'body');
		expect(cheeks).toHaveLength(2);
		for (const p of cheeks) {
			if (p.kind !== 'mesh') throw Error('Expected solid cheeks');
			expect(p.points[3][2] - p.points[0][2]).toBeCloseTo(0.6);
			const across = p.points.map((q) => q[1]);
			expect(Math.max(...across) - Math.min(...across)).toBeCloseTo(0.3);
		}
		const treads = geometry.filter((g) => g.kind === 'box' && g.slot === 'deck');
		const lower = treads[0],
			next = treads[1];
		if (lower.kind !== 'box' || next.kind !== 'box') throw Error('Expected closed risers');
		expect(lower.position[2] + lower.size[2] - next.position[2]).toBeCloseTo(0.12);
	}
});
test('bench and planter retain a walking strip on a 1.5 m terrace', () => {
	for (const id of ['kit-terrace-bench', 'kit-terrace-planter'])
		for (const v of ['short', 'standard', 'long']) {
			const parts = buildObject(id, v, 17).geometry;
			const across = parts.flatMap((p) => (p.kind === 'prism' ? p.polygon.map((q) => q[1]) : []));
			expect(1.5 - (Math.max(...across) - Math.min(...across))).toBeGreaterThanOrEqual(0.95);
		}
});

test('walkable stock binds the fine aggregate finish on thin solid geometry', () => {
	const cases = [
		['kit-terrace-paving', 'fine-terrazzo', 'body'],
		['stairs', 'winding-tread', 'deck'],
		['stairs', 'straight-tread', 'deck'],
		['kit-gallery-walk-5m', 'two-post', 'deck'],
		['kit-stair-landing-5m', 'two-post', 'deck']
	];
	for (const [id, variant, slot] of cases) {
		const { parts, geometry } = buildObject(id, variant, 17);
		const surfaces = parts.filter((_, i) => geometry[i].slot === slot);
		expect(surfaces.length).toBeGreaterThan(0);
		expect(surfaces.every((p) => p.finish === 'beton-terrazzo')).toBe(true);
	}
});
