import { expect, test } from 'bun:test';
import { assetRegistry, buildObject } from './index';

test('pairs and the adult with a child have two heads across every pose', () => {
	const pairs = assetRegistry.filter(
		(a) =>
			a.id.startsWith('person-') && (a.id.endsWith('-pair') || a.id === 'person-holding-child-hand')
	);
	expect(pairs.length).toBe(5);
	for (const entry of pairs)
		for (const v of entry.variants) {
			const { geometry } = buildObject(entry.id, v, 17);
			expect(geometry.filter((p) => p.slot === 'body' && p.kind === 'sphere')).toHaveLength(2);
		}
});
test('the walker has a low distinct dog and a lead in every pose', () => {
	const entry = assetRegistry.find((a) => a.id === 'person-dog-walker');
	if (!entry) throw Error('Expected a registered dog walker');
	for (const v of entry.variants) {
		const { geometry } = buildObject(entry.id, v, 17);
		const dog = geometry.find((p) => p.slot === 'accent');
		if (dog?.kind !== 'mesh') throw Error('Expected a cut dog silhouette');
		expect(Math.min(...dog.points.map((p) => p[2]))).toBe(0);
		expect(Math.max(...dog.points.map((p) => p[2]))).toBeLessThan(0.6);
		expect(geometry.some((p) => p.kind === 'pipe' && p.slot === 'trim')).toBe(true);
	}
});
