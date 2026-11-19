import { specimen } from './specimens';
import { expect, test } from 'bun:test';
import { squareGrid } from '../quad-grid';
import {
	circulation,
	houseSurfaces,
	housePartPlan,
	planHouse,
	sectionParts
} from '../composed-house';
import { nearestSilhouettes } from './silhouette-measure';
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
function memberThickness(p: ReturnType<typeof sectionParts>[number]) {
	switch (p.kind) {
		case 'box':
			return Math.min(...p.size);
		case 'pipe':
		case 'capsule':
			return 2 * p.radius;
		case 'cylinder':
			return Math.min(p.height, 2 * p.radius);
		case 'prism':
			return p.height;
		default:
			return Infinity;
	}
}
function checkHardware(s: ReturnType<typeof specimen>) {
	for (const p of s.composition.supports.filter((p) => p.joint === 'shaft'))
		expect(Math.min(p.size[0], p.size[1]), p.id).toBeGreaterThanOrEqual(0.3 - 1e-8);
	for (const p of sectionParts(s)) {
		if (!p.source.objectId.startsWith('person-'))
			expect(memberThickness(p), p.id).toBeGreaterThanOrEqual(0.12 - 1e-7);
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
test('full-height spiral count stays within the ensemble allowance on both bay widths', () => {
	for (const size of [4, 10])
		for (const count of [2, 3, 5, 8]) {
			const sites = squareGrid(count, 1, size).cells.map((cell, i) => ({
				cells: [cell],
				seed: i + 3,
				district: 'bank' as const,
				stacks: new Map([[cell.id, Array<'living'>(6 + (i % 3)).fill('living')]])
			}));
			const context = planEnsemble(sites);
			const windings = sites
				.map((site) => circulation(planHouse({ ...site, context })))
				.filter((route) => 'track' in route);
			expect(windings.length).toBeLessThanOrEqual(Math.floor(count / 3));
		}
});
const programmeTokens = new Set([
	houseSurfaces.living.token,
	houseSurfaces.energy.token,
	houseSurfaces.material.token,
	houseSurfaces.water.token,
	houseSurfaces.food.token
]);
test('the most frequent painted use leads every house, with shell on alternating storeys', () => {
	for (const type of typologies) {
		const s = specimen(footprints[type][0], type),
			parts = sectionParts(s);
		for (const body of s.slots) {
			const used = parts.filter(
				(p) => p.id.startsWith(body.id + '/' + body.objectId + '/') && programmeTokens.has(p.token)
			);
			const finishes = new Set(used.map((p) => p.token));
			expect(finishes.size).toBeLessThanOrEqual(1);
			for (const token of finishes) expect(token).toBe(houseSurfaces.living.token);
		}
	}
});
test('alternating capsule bands shift by half a metre to one and a quarter metres', () => {
	const levels = specimen(1, 'capsule-stack').composition.levels;
	const shifts = levels.slice(1).map((l, i) => l.position[0] - levels[i].position[0]);
	for (const [i, shift] of shifts.entries()) {
		expect(Math.abs(shift)).toBeGreaterThanOrEqual(0.5 - 1e-8);
		expect(Math.abs(shift)).toBeLessThanOrEqual(1.25 + 1e-8);
		if (i) expect(shift * shifts[i - 1]).toBeLessThan(0);
	}
});
test('occupied outlines span at least four fifths of the painted bay', () => {
	const exempt = ['capsule-stack', 'cluster-mast', 'lattice-head', 'twin-stack', 'bell-house'];
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
		'deck-tower': [0, 2, 4, 5],
		'round-tower': [0, 1, 2, 3, 4, 5],
		'portal-house': [4, 5],
		'lattice-head': [4, 5],
		'courtyard-house': [0, 1, 2, 3, 4, 5],
		'terrace-house': [0, 1, 2, 3, 4, 5],
		'plinth-house': [0, 1, 2, 3, 4, 5],
		'cluster-mast': [],
		rack: [0, 1, 2, 3, 4, 5],
		'bridge-house': [5],
		'bell-house': [5],
		'twin-stack': [0, 1, 2, 3, 4, 5],
		'slab-house': [0, 1, 2, 3, 4, 5],
		'water-house': [0, 5],
		'tree-house': [2, 3.5, 5]
	};
	for (const t of typologies) {
		const h = specimen(footprints[t][0], t).composition;
		const bands = h.levels
			.filter((_, i) => h.parts.some((p) => p.id === h.id + '/level/' + i + '/deck'))
			.map((l) => (l.position[2] - h.datum) / 4);
		expect(bands, t).toEqual(floors[t]);
	}
});
test('every pair differs in two silhouette features and seeds preserve each signature', () => {
	const signatures = typologies.map((type) => {
		const site = footprints[type][0],
			s = specimen(site, type).composition.signature;
		for (const footprint of footprints[type])
			for (const seed of [0, 1, 19, 103])
				expect(specimen(footprint, type, 6, seed).composition.signature).toEqual(s);
		return Object.values(s);
	});
	for (const [i, a] of signatures.entries())
		for (const [j, b] of signatures.slice(i + 1).entries())
			expect(
				a.filter((v, k) => v !== b[k]).length,
				typologies[i] + ' / ' + typologies[i + j + 1]
			).toBeGreaterThanOrEqual(2);
});
test('all admissible band-fill distances reach eight percent', () => {
	const minima = nearestSilhouettes(typologies, footprints, specimen);
	console.info('Band-fill minima', Object.fromEntries(minima));
	expect([...minima.values()].every((m) => m.distance >= 0.08)).toBe(true);
});

test('plug-in units span three fifths of the inhabited silhouette along their long axis', () => {
	for (const type of ['capsule-stack', 'cluster-mast', 'tree-house', 'bell-house'] as const) {
		for (const cells of footprints[type]) {
			const section = specimen(cells, type);
			const envelope = sectionParts(section)
				.filter((p) => p.id.includes('/body/') || p.roofCell !== undefined)
				.flatMap(housePartPlan);
			for (const body of section.composition.levels.flatMap((l) => l.bodies)) {
				const axis = Math.abs(Math.sin(body.rotation)) > 0.5 ? 1 : 0;
				const span = envelope.map((p) => p[axis]);
				expect(
					body.size[0] / (Math.max(...span) - Math.min(...span)),
					type + '/' + cells
				).toBeGreaterThanOrEqual(0.6 - 1e-7);
			}
		}
	}
});
