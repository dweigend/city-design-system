import { expect, test } from 'bun:test';
import { squareGrid } from '../quad-grid';
import { housePartPlan, planHouse, sectionParts } from '../composed-house';
import { bounds } from '../ansicht/geometrie';
import { accessShare } from '../composed-house/access-budget';
import { checkFit, planEnsemble, typologies, type Typology } from './index';

const footprints: Record<Typology, number[]> = {
	'capsule-stack': [1],
	'deck-tower': [1, 2],
	'round-tower': [1, 4],
	'portal-house': [2],
	'lattice-head': [1],
	'courtyard-house': [4],
	'terrace-house': [2, 4],
	'plinth-house': [1, 2, 4],
	'cluster-mast': [1],
	rack: [1, 2, 4],
	'bridge-house': [2],
	'bell-house': [1, 2, 4],
	'twin-stack': [2],
	'slab-house': [2],
	'water-house': [1],
	'tree-house': [1]
};
function specimen(n: number, typology: Typology, height = 6) {
	const cells = squareGrid(n === 1 ? 1 : 2, n === 4 ? 2 : 1, 10).cells;
	const uses = ['water', 'living', 'living', 'food', 'material', 'energy'] as const;
	const site = { cells, seed: 7, stacks: new Map(cells.map((c) => [c.id, uses.slice(0, height)])) };
	const context = planEnsemble([site]),
		houses = new Map(context.houses);
	const [id, decision] = [...houses][0];
	houses.set(id, { ...decision, typology });
	return planHouse({ ...site, context: { ...context, houses } });
}

test('forced assemblies carry every member and keep access within ten percent', () => {
	const findings: string[] = [];
	for (const type of typologies)
		for (const cells of footprints[type]) {
			const s = specimen(cells, type),
				fit = checkFit(s.composition.parts),
				share = accessShare(sectionParts(s));
			if (fit.length || share > 0.1)
				findings.push(type + '/' + cells + ' ' + share.toFixed(3) + ' ' + JSON.stringify(fit[0]));
		}
	expect(findings).toEqual([]);
});
function checkHardware(s: ReturnType<typeof specimen>) {
	for (const p of s.composition.supports.filter((p) => p.joint === 'shaft'))
		expect(Math.min(p.size[0], p.size[1]), p.id).toBeGreaterThanOrEqual(0.3 - 1e-8);
	for (const p of sectionParts(s)) {
		if (p.kind === 'box' && p.id.endsWith('/stringer')) expect(p.size[1]).toBeCloseTo(0.3);
		if (p.kind !== 'pipe') continue;
		const functional =
			['railing', 'ladder', 'primitive-pipe'].includes(p.source.objectId) ||
			p.source.objectId.includes('parapet-rail');
		if (functional) expect(2 * p.radius, p.id).toBeGreaterThanOrEqual(0.12 - 1e-8);
	}
}
test('bearing sections and exposed circulation meet their minimum diameters', () => {
	for (const type of typologies)
		for (const cells of footprints[type]) checkHardware(specimen(cells, type));
});
test('occupied outlines span at least four fifths of the painted bay', () => {
	const exempt = ['capsule-stack', 'cluster-mast', 'lattice-head', 'twin-stack'];
	const failures: string[] = [];
	for (const t of typologies.filter((t) => !exempt.includes(t)))
		for (const n of footprints[t]) {
			const s = specimen(n, t),
				axis = s.composition.bay.width >= s.composition.bay.depth ? 0 : 1;
			const points = sectionParts(s)
				.filter((p) => !p.id.includes('/stair/'))
				.flatMap(housePartPlan)
				.map((p) => p[axis]);
			const width = Math.max(...points) - Math.min(...points);
			const share = width / (axis ? s.composition.bay.depth : s.composition.bay.width);
			if (share < 0.8 - 1e-8) failures.push(t + ' on ' + n + ' cells: ' + share.toFixed(3));
		}
	expect(failures).toEqual([]);
});
test('full occupied floors follow the sixteen typology sections', () => {
	const floors: Record<Typology, number[]> = {
		'capsule-stack': [],
		'deck-tower': [0, 3, 5],
		'round-tower': [0, 1, 2, 3, 4, 5],
		'portal-house': [4, 5],
		'lattice-head': [4, 5],
		'courtyard-house': [5],
		'terrace-house': [0, 1, 2, 3, 4, 5],
		'plinth-house': [0],
		'cluster-mast': [],
		rack: [0, 1, 2, 3, 4, 5],
		'bridge-house': [5],
		'bell-house': [5],
		'twin-stack': [0, 5],
		'slab-house': [],
		'water-house': [0],
		'tree-house': [4, 4.5, 5]
	};
	for (const t of typologies) {
		const h = specimen(footprints[t][0], t).composition;
		const bands = h.levels
			.filter((_, i) => h.parts.some((p) => p.id === h.id + '/level/' + i + '/deck'))
			.map((l) => (l.position[2] - h.datum) / 4);
		expect(bands, t).toEqual(floors[t]);
	}
});
function coverage(intervals: number[][]) {
	let end = -Infinity,
		covered = 0;
	for (const [a, b] of intervals.sort((a, b) => a[0] - b[0])) {
		covered += Math.max(0, b - Math.max(a, end));
		end = Math.max(end, b);
	}
	return covered;
}
function signature(n: number, type: Typology, height: number) {
	const s = specimen(n, type, height);
	const boxes = sectionParts(s).map((p) => {
		const b = bounds(p),
			outline = housePartPlan(p);
		for (const axis of [0, 1] as const) {
			b.min[axis] = Math.min(...outline.map((q) => q[axis]));
			b.max[axis] = Math.max(...outline.map((q) => q[axis]));
		}
		return b;
	});
	const bands = Math.ceil((Math.max(...boxes.map((b) => b.max[2])) - s.base[2]) / 2);
	const shares = [0, 1].flatMap((axis) =>
		Array.from({ length: bands }, (_, i) => {
			const start = s.base[2] + 2 * i;
			const slice = boxes.filter((b) => b.min[2] < start + 2 && b.max[2] > start);
			const edges = [
				...new Set([
					start,
					start + 2,
					...slice.flatMap((b) => [Math.max(start, b.min[2]), Math.min(start + 2, b.max[2])])
				])
			].sort((a, b) => a - b);
			return (
				edges.slice(1).reduce((area, z, j) => {
					const active = slice.filter((b) => b.min[2] < z && b.max[2] > edges[j]);
					return area + (z - edges[j]) * coverage(active.map((b) => [b.min[axis], b.max[axis]]));
				}, 0) /
				(2 * (axis ? s.composition.bay.depth : s.composition.bay.width))
			);
		})
	);
	return [shares.slice(0, bands), shares.slice(bands)];
}

function distance(a: number[][], b: number[][]) {
	const n = Math.max(a[0].length, b[0].length);
	return (
		a.reduce(
			(sum, view, k) =>
				sum +
				Array.from({ length: n }, (_, i) => Math.abs((view[i] ?? 0) - (b[k][i] ?? 0))).reduce(
					(x, y) => x + y,
					0
				),
			0
		) /
		(2 * n)
	);
}

function admits(type: Typology, height: number) {
	if (['courtyard-house', 'plinth-house', 'bridge-house'].includes(type)) return height <= 3;
	if (type === 'round-tower') return height >= 6;
	if (type === 'lattice-head') return height >= 5;
	return true;
}
test('forced typologies differ in projected fill by 25 percent across two elevations', () => {
	const minima = new Map<
		Typology,
		{ distance: number; other: Typology; cells: number; height: number }
	>();
	for (const height of [3, 6])
		for (const cells of [1, 2, 4]) {
			const samples = typologies
				.filter((t) => footprints[t].includes(cells) && admits(t, height))
				.map((type) => ({ type, fill: signature(cells, type, height) }));
			for (const a of samples)
				for (const b of samples) {
					if (a === b) continue;
					const d = distance(a.fill, b.fill);
					if (d < (minima.get(a.type)?.distance ?? Infinity))
						minima.set(a.type, { distance: d, other: b.type, cells, height });
				}
		}
	console.info('Nearest silhouette by typology', Object.fromEntries(minima));
	expect([...minima.values()].every((m) => m.distance >= 0.25)).toBe(true);
});
