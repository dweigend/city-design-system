import { expect, test } from 'bun:test';
import { buildObject } from './index';

test('both stringers support a flight of separate treads', () => {
	for (const v of ['short-flight', 'wide-flight', 'landing-flight']) {
		const { geometry } = buildObject('stairs', v, 17);
		const cheeks = geometry.filter((g) => g.kind === 'mesh' && g.slot === 'body');
		expect(cheeks).toHaveLength(2);
		for (const p of cheeks) {
			if (p.kind !== 'mesh') throw Error('Expected solid cheeks');
			const across = p.points.map((q) => q[1]);
			expect(Math.max(...across) - Math.min(...across)).toBeCloseTo(0.3);
		}
		const treads = geometry.filter((g) => g.kind === 'box' && g.slot === 'deck');
		expect(treads.some((g) => g.kind === 'box' && g.position[2] > 1)).toBe(true);
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
