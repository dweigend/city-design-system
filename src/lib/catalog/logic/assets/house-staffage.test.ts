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

test('all registry staffage bodies suggest ink and graphite through their public slot', () => {
	for (const entry of assetRegistry) {
		for (const variant of entry.variants) {
			const { geometry } = buildObject(entry.id, variant, 17);
			// The released figure starts with a round head and a three-section tapered torso.
			const heads = geometry.filter((part, i) => {
				const torso = geometry[i + 1];
				return (
					part.kind === 'sphere' &&
					part.radius <= 0.125 &&
					torso?.kind === 'mesh' &&
					torso.points.length === 36
				);
			});
			if (
				entry.id.startsWith('person-') ||
				entry.id.startsWith('kit-scatter-') ||
				entry.id === 'scale-figure'
			)
				expect(heads.length, entry.id).toBeGreaterThan(0);
			for (const { slot } of heads)
				expect(
					entry.slotDefaults[variant][slot],
					entry.id + '/' + variant + '/' + slot
				).toMatchObject({ token: '--ink', finish: 'metall-graphit' });
		}
	}
});
