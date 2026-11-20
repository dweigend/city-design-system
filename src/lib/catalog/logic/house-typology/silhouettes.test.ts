import { BODY_TOKEN } from '../../data/house-body';
import { projectBuildingSurface } from '../../scene/building-surface';
import { minimumGauge } from './specimens';
import { expect, test } from 'bun:test';
import { squareGrid } from '../quad-grid';
import { circulation, housePartPlan, planHouse, sectionParts } from '../composed-house';
import { shellSystems } from '../../data/house-shells';
import { sections } from './section-insets';
import type { HouseEnvelope } from './envelope';
import { accessShare } from '../composed-house/access-budget';
import { checkFit, planEnsemble } from './index';

function paintedHouse(n: number, system: HouseEnvelope['system']) {
	const cells = squareGrid(n === 1 ? 1 : 2, n === 4 ? 2 : 1, 10).cells;
	const uses = ['water', 'living', 'living', 'food', 'material', 'energy'] as const;
	return planHouse({
		cells,
		seed: 7,
		envelope: { system },
		stacks: new Map(cells.map((c) => [c.id, [...uses]]))
	});
}
test('every envelope system carries its members and keeps access within ten percent', () => {
	const findings: string[] = [];
	for (const system of shellSystems)
		for (const cells of [1, 2, 4]) {
			const s = paintedHouse(cells, system),
				fit = checkFit(s.composition.parts),
				share = accessShare(sectionParts(s));
			if (fit.length || share > 0.1)
				findings.push(system + '/' + cells + ' ' + share.toFixed(3) + ' ' + JSON.stringify(fit[0]));
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
function checkHardware(s: ReturnType<typeof planHouse>) {
	for (const p of s.composition.supports.filter((p) => p.joint === 'shaft'))
		expect(Math.min(p.size[0], p.size[1]), p.id).toBeGreaterThanOrEqual(0.3 - 1e-8);
	for (const p of sectionParts(s)) {
		if (!p.source.objectId.startsWith('person-'))
			expect(memberThickness(p), p.id).toBeGreaterThanOrEqual(minimumGauge(s, p) - 1e-7);
		if (p.kind === 'box' && p.id.endsWith('/stringer')) expect(p.size[1]).toBeCloseTo(0.3);
		if (p.kind !== 'pipe') continue;
		const functional =
			['railing', 'ladder', 'primitive-pipe'].includes(p.source.objectId) ||
			p.source.objectId.includes('parapet-rail');
		if (functional) expect(2 * p.radius, p.id).toBeGreaterThanOrEqual(0.12 - 1e-8);
	}
}
test('bearing sections and exposed circulation meet their minimum diameters', () => {
	for (const system of shellSystems)
		for (const cells of [1, 2, 4]) checkHardware(paintedHouse(cells, system));
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
test('each occupied body projects its own programme pigment on shell and screen surfaces', () => {
	for (const system of shellSystems) {
		const house = paintedHouse(1, system);
		const parts = sectionParts(house);
		for (const body of house.slots) {
			const surfaces = parts.filter(
				(p) =>
					p.id.startsWith(body.id + '/') &&
					(p.buildingSurface?.slot === 'shell' || p.buildingSurface?.slot === 'screen')
			);
			expect(surfaces.length, body.id).toBeGreaterThan(0);
			for (const p of surfaces) {
				expect(p.buildingSurface?.use, p.id).toBe(body.use);
				expect(projectBuildingSurface(p).token, p.id).toBe(BODY_TOKEN[body.use]);
			}
		}
	}
});
test('occupied outlines span at least four fifths of the painted bay', () => {
	const failures: string[] = [];
	for (const system of shellSystems)
		for (const n of [1, 2, 4]) {
			const s = paintedHouse(n, system),
				axis = s.composition.bay.width >= s.composition.bay.depth ? 0 : 1;
			const points = sectionParts(s)
				.filter((p) => !p.id.includes('/stair/'))
				.flatMap(housePartPlan)
				.map((p) => p[axis]);
			const width = Math.max(...points) - Math.min(...points);
			const share = width / (axis ? s.composition.bay.depth : s.composition.bay.width);
			if (share < 0.8 - 1e-8) failures.push(system + ' on ' + n + ' cells: ' + share.toFixed(3));
		}
	expect(failures).toEqual([]);
});
function envelopeHouse(envelope: Partial<HouseEnvelope>, metres = 12, seed = 23) {
	const cells = squareGrid(1, 1, metres).cells;
	return planHouse({
		cells,
		seed,
		stacks: new Map([[cells[0].id, Array<'living'>(7).fill('living')]]),
		envelope
	});
}
test('each section produces a distinct sequence of occupied outlines on a common parcel', () => {
	const profiles = sections.map((section) =>
		envelopeHouse({ section, outline: 'orthogonal' }).composition.levels.map((l) => l.outline)
	);
	expect(new Set(profiles.map((p) => JSON.stringify(p))).size).toBe(sections.length);
});
test('the wings and decks share the landing elevation on every inhabited floor', () => {
	for (const section of sections) {
		const h = envelopeHouse({ section });
		const route = circulation(h);
		for (const level of h.composition.levels) {
			expect(level.bodies.every((b) => b.position[2] === level.landing[2])).toBe(true);
			expect(route.docks.some((d) => d.door.every((v, k) => v === level.landing[k]))).toBe(true);
		}
	}
});
test('the structural systems have distinct projected meshes even at fixed section and finish', () => {
	const shapes = shellSystems.map((system) => {
		const h = envelopeHouse({ system, section: 'vessel', finish: 'beton-schalung' });
		const wall = sectionParts(h).find((p) => p.source.objectId === 'full-height-shell');
		if (wall?.kind !== 'mesh') throw Error('Missing structural wall');
		expect(h.composition.signature.support).toBe(system);
		return JSON.stringify([wall.points, wall.triangles]);
	});
	expect(new Set(shapes).size).toBe(shellSystems.length);
});
test('a terraced section retreats by at least eight percent across its elevation', () => {
	for (const metres of [6, 12, 24]) {
		const { levels } = envelopeHouse(
			{ section: 'terrace-fan', outline: 'orthogonal' },
			metres
		).composition;
		expect((levels[0].width - levels[levels.length - 1].width) / metres).toBeGreaterThanOrEqual(
			0.08
		);
	}
});
test('full-height members span more than three fifths of their inhabited elevation', () => {
	for (const system of shellSystems) {
		const h = envelopeHouse({ system });
		const shell = h.composition.exterior;
		if (!shell) throw Error('Missing parcel shell');
		expect(shell.stations[0].ring).toEqual(shell.ring);
		expect(shell.stations[0].z).toBe(h.composition.ground);
		expect(shell.stations.at(-1)?.z).toBe(h.top);
		const corners = h.cells[0].corners.map(([x, y]): [number, number] => [x, y]);
		expect(shell.ring).toHaveLength(corners.length);
		for (const corner of corners) expect(shell.ring).toContainEqual(corner);
		const walls = sectionParts(h).filter((p) => p.source.objectId === 'full-height-shell');
		expect(walls.length).toBe(4);
		for (const p of walls) {
			if (p.kind !== 'mesh') throw Error('Missing structural mesh');
			const z = p.points.map((q) => q[2]);
			expect((Math.max(...z) - Math.min(...z)) / (h.top - h.composition.ground)).toBeGreaterThan(
				0.6
			);
		}
	}
});
test('compact and broad carriers retain the specified form independently of the seed', () => {
	const envelope = { system: 'diagrid', section: 'waisted-shell', outline: 'fluted' } as const;
	for (const metres of [4, 12])
		for (const seed of [0, 1, 19, 103]) {
			const h = envelopeHouse(envelope, metres, seed).composition;
			expect([h.signature.support, h.signature.body, h.signature.outline]).toEqual([
				envelope.system,
				envelope.section,
				envelope.outline
			]);
		}
});

test('each seeded ensemble shares a structural system and retains individual occupied sections', () => {
	const cells = squareGrid(5, 1, 10).cells;
	const systems = new Set<string>();
	const outlines = new Set<string>();
	for (const seed of [1, 7, 11, 23, 41, 59]) {
		const sites = cells.map((cell) => ({
			cells: [cell],
			seed,
			stacks: new Map([[cell.id, Array<'living'>(6).fill('living')]])
		}));
		const context = planEnsemble(sites, seed);
		const houses = sites.map((site) => planHouse({ ...site, context }).composition);
		expect(houses.every((h) => h.exterior?.system === context.leadingSystem)).toBe(true);
		systems.add(context.leadingSystem);
		outlines.add(JSON.stringify(houses[0].levels.map((l) => l.outline)));
	}
	expect(systems.size).toBeGreaterThan(1);
	expect(outlines.size).toBeGreaterThan(1);
});
