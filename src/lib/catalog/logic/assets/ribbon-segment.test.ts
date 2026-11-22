import { expect, test } from 'bun:test';
import { assetRegistry, buildObject, type RibbonSection } from './index';

const sampleSections: RibbonSection[] = [
	{ centre: [0, 0, 3], left: [0, 0.9, 3], right: [0, -0.9, 3] },
	{ centre: [5, 0, 3], left: [5, 0.9, 3], right: [5, -0.9, 3] },
	{ centre: [10, 0, 3], left: [10, 0.9, 3], right: [10, -0.9, 3] }
];

test('ribbon-segment is registered as a site-parametric access object with a stock preview', () => {
	const entry = assetRegistry.find((a) => a.id === 'ribbon-segment');
	expect(entry).toBeDefined();
	expect(entry?.category).toBe('access');
	expect(entry?.siteParametric).toBe(true);
	expect(entry?.variants).toEqual(['supported', 'paired', 'tunnel']);
	expect(entry?.slotNames).toEqual(['walking', 'bearing']);
	expect(entry?.footprint).toEqual([6, 1.8]);
	expect(entry?.anchors).toEqual([{ attachment: 'deck', position: [0, 0, 0], normal: [0, 0, 1] }]);
});

test('ribbon-segment projects colour-free site geometry, swept footprint and port anchors', () => {
	const ports = [
		{ id: 'a', position: [0, 0, 3] as const, heading: Math.PI, width: 1.8 },
		{ id: 'b', position: [10, 0, 3] as const, heading: 0, width: 1.8 }
	];
	const built = buildObject('ribbon-segment', 'supported', 7, {
		instanceId: 'town-walk/a>b',
		site: { sections: sampleSections, ground: () => 0, ports }
	});
	expect(built.footprint).toEqual([10, 1.8]);
	expect(built.anchors).toHaveLength(2);
	expect(built.anchors[0].position).toEqual([0, 0, 3]);
	expect(built.anchors[0].normal[0]).toBeCloseTo(-1, 10);
	expect(built.anchors[1].position).toEqual([10, 0, 3]);
	expect(built.anchors[1].normal[0]).toBeCloseTo(1, 10);
	expect(built.geometry[0].id).toBe('town-walk/a>b/ramp');
	expect(built.geometry[0].slot).toBe('walking');
	for (const part of built.geometry) {
		expect(part).not.toHaveProperty('token');
		expect(part).not.toHaveProperty('finish');
		expect(part).not.toHaveProperty('material');
	}
	expect(built.parts[0]).toMatchObject({
		id: 'town-walk/a>b/ramp',
		role: 'neu',
		material: 'acrylic',
		token: '--cat-business',
		finish: 'kunststoff-formteil'
	});
	expect(built.parts.slice(1).every((p) => p.id.startsWith('town-walk/a>b/pier/'))).toBe(true);
});

test('material-only slot assignments dress ribbon segments without token or finish', () => {
	const paper = { role: 'bestand', material: 'paper' } as const;
	const built = buildObject('ribbon-segment', 'paired', 0, {
		instanceId: 'study/link',
		slots: { walking: paper, bearing: paper },
		site: { sections: sampleSections, ground: () => 0 }
	});
	expect(built.parts.length).toBeGreaterThan(1);
	for (const part of built.parts) {
		expect(part.role).toBe('bestand');
		expect(part.material).toBe('paper');
		expect(part.token).toBeUndefined();
		expect(part.finish).toBeUndefined();
	}
	expect(built.parts.some((p) => p.id === 'study/link/pier/0/0')).toBe(true);
	expect(built.parts.some((p) => p.id === 'study/link/pier/1/0')).toBe(true);
});

test('tunnel variant omits piers and invalid site inputs throw RangeError', () => {
	const tunnel = buildObject('ribbon-segment', 'tunnel', 0, {
		instanceId: 'town-walk/tunnel',
		site: { sections: sampleSections, ground: () => 0 }
	});
	expect(tunnel.parts).toHaveLength(1);
	expect(tunnel.parts[0].id).toBe('town-walk/tunnel/ramp');
	expect(() =>
		buildObject('ribbon-segment', 'supported', 0, {
			site: { sections: [sampleSections[0]], ground: () => 0 }
		})
	).toThrow(RangeError);
	expect(() =>
		buildObject('porthole', 'round', 0, {
			site: { sections: sampleSections, ground: () => 0 }
		})
	).toThrow(RangeError);
});
