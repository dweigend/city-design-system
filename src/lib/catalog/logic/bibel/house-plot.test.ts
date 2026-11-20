import { access as projectAccess } from '../composed-house/access';
import { bodyParts } from '../composed-house/provider';
import { houseStructure } from '../composed-house/structure';
import { checkParcel } from '../composed-house/parcel-assertions.test-support';
import { expect, test } from 'bun:test';
import { plotHouse, plotShapes } from './house-plot';
import {
	circulation,
	sectionParts,
	houseSurfaces,
	housePartPlan as planPoints
} from '../composed-house';
import type { Vec3 } from '../parametrik/types';

type Section = Parameters<typeof sectionParts>[0];
import { bounds } from '../ansicht/geometrie';
import { partsIntersect } from '../house-typology';
import { buildObject } from '../assets';

const palette = {
	...houseSurfaces,
	frame: { token: '--ink', finish: 'metal' },
	access: { token: '--signal', finish: 'metal' },
	deck: { token: '--paper', finish: 'metal' }
} as const;

function touches(point: Vec3, ring: [number, number][]) {
	return ring.some(([x, y], i) => {
		const [u, v] = ring[(i + 1) % ring.length],
			dx = u - x,
			dy = v - y;
		const t = Math.max(
			0,
			Math.min(1, ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy || 1))
		);
		return Math.hypot(point[0] - x - t * dx, point[1] - y - t * dy) <= 0.02;
	});
}
type Path = ReturnType<typeof circulation>;
type Parts = ReturnType<typeof projectAccess>;
function checkDecks(s: Section, path: Path) {
	const levels = new Set(path.stops.map((p) => Math.round(p[2] * 100)));
	for (const [i, d] of s.decks.entries()) {
		expect(levels.has(Math.round(d.position[2] * 100))).toBe(true);
		const elevation = d.position[2] - s.cells[0].pad;
		expect(
			(s.typology === 'block' &&
				(i
					? Math.abs(
							d.position[2] -
								(s.composition.levels[i - 1].bodies[0].position[2] +
									s.composition.levels[i - 1].bodies[0].size[2] +
									0.16)
						) < 1e-7
					: elevation >= 0.6 - 1e-8 && elevation <= 1.2)) ||
				elevation === 1 ||
				Math.abs(elevation / 2 - Math.round(elevation / 2)) < 1e-7
		).toBe(true);
	}
}
function checkDocks(path: Path, parts: Parts) {
	for (const dock of path.docks) {
		expect(
			parts.some(
				(p) =>
					p.kind === 'prism' &&
					Math.abs(p.z + p.height - dock.station[2]) <= 0.02 &&
					touches(dock.station, p.polygon)
			)
		).toBe(true);
	}
}
function checkFlights(s: Section, path: Path) {
	const previous = new Map<number, number>();
	const flights = new Set(
		path.legs.filter((l) => l.kind === 'stairs' || l.kind === 'ladder').map((l) => l.flight)
	);
	expect(flights.size).toBe(s.decks.length + 1);
	let length = 0,
		last = path.legs[0].from,
		climb = 0;
	for (const leg of path.legs) {
		expect(leg.from).toEqual(last);
		last = leg.to;
		const run = Math.hypot(leg.to[0] - leg.from[0], leg.to[1] - leg.from[1]);
		length += run;
		if ('first' in leg) {
			const prior = previous.get(leg.first);
			if (prior !== undefined) expect(prior - leg.from[2]).toBeGreaterThan(2.1);
			previous.set(leg.first, leg.from[2]);
		}
		if (leg.kind === 'stairs') {
			expect(run).toBeCloseTo(0.29, 8);
			const drop = leg.from[2] - leg.to[2];
			expect(Math.abs(drop - 0.17)).toBeLessThan(0.02);
			climb += drop;
			expect(climb).toBeLessThanOrEqual(3.02);
		} else climb = 0;
	}
	expect(length).toBeLessThanOrEqual(2.2 * (s.top - path.stops[path.stops.length - 1][2]));
}
function occupiedBounds(parts: Parts) {
	return parts.map((p) => {
		const b = bounds(p);
		const points = planPoints(p);
		for (const k of [0, 1] as const) {
			b.min[k] = Math.min(...points.map((q) => q[k]));
			b.max[k] = Math.max(...points.map((q) => q[k]));
		}
		return { ...b, part: p };
	});
}
function checkClearance(
	p: Parts[number],
	box: ReturnType<typeof bounds>,
	occupied: ReturnType<typeof occupiedBounds>
) {
	expect(
		occupied.every(
			(b) =>
				b.min.some((lo, i) => lo >= box.max[i] - 0.02 || b.max[i] <= box.min[i] + 0.02) ||
				!partsIntersect(p, b.part)
		),
		p.id + ' clearance'
	).toBe(true);
}
function stairSurface(p: Parts[number]) {
	const source = p.source.objectId;
	return source === 'stairs' || (source === 'ladder' && p.source.member === 0)
		? palette.access
		: source === 'railing' || source === 'ladder' || (p.kind === 'prism' && p.height === 0.3)
			? palette.frame
			: palette.deck;
}

function checkStairSurface(p: Parts[number]) {
	const source = p.source.objectId;
	expect(p.token).toBe(stairSurface(p).token);
	if (source === 'stairs' && p.kind === 'prism') {
		const ring = p.polygon;
		const j = p.source.variant === 'straight-tread' ? 3 : 1;
		expect(Math.hypot(ring[0][0] - ring[j][0], ring[0][1] - ring[j][1])).toBeCloseTo(1.25, 8);
	}
}
function volume(p: Parts[number]) {
	const box = bounds(p);
	const v = box.max.reduce((v, max, i) => v * (max - box.min[i]), 1);
	expect(Number.isFinite(v)).toBe(true);
	return v;
}
function checkParts(s: Section, parts: ReturnType<typeof sectionParts>, walk: Parts) {
	checkParcel(s, parts);
	const solids = s.composition.parts.filter((p) =>
		['body', 'socket', 'foot', 'shaft', 'head'].includes(p.joint)
	);
	const bodies = s.composition.levels.flatMap((l) =>
		l.bodies.flatMap((b) => bodyParts(b, palette))
	);
	const frame = houseStructure({ ...s, composition: { ...s.composition, parts: solids } }, palette);
	const occupied = occupiedBounds([...bodies, ...frame]);
	for (const p of walk) {
		checkClearance(p, bounds(p), occupied);
		checkStairSurface(p);
	}
	const sum = (ps: Parts) => ps.reduce((v, p) => v + volume(p), 0);
	const stairs = sum(walk);
	expect(sum(bodies)).toBeGreaterThan(stairs);
	expect(stairs / sum(parts)).toBeLessThanOrEqual(0.1);
}
function inspect(s: Section) {
	const path = circulation(s),
		parts = sectionParts(s, palette);
	checkDecks(s, path);
	const reports: NonNullable<Parameters<typeof projectAccess>[2]> = [];
	const walk = projectAccess(s, palette, reports);
	if (!s.compact) {
		const flights = new Set(path.legs.map((l) => l.flight));
		expect(new Set(reports.map((r) => r.flight + '/' + r.side)).size).toBe(flights.size * 2);
		for (const r of reports) {
			const open = r.length - r.omitted.wall;
			expect(r.covered + Object.values(r.omitted).reduce((a, b) => a + b, 0)).toBeCloseTo(
				r.length,
				8
			);
			if (r.covered < open * 0.8)
				expect(r.omitted.clearance + r.omitted.parcel + r.omitted.volume).toBeGreaterThan(0);
			const tops = walk.filter(
				(p) => p.id.includes('/rail/' + r.flight + '/' + r.side + '/') && p.source.member === 0
			);
			const chord = tops.reduce(
				(v, p) =>
					p.kind === 'pipe' ? v + Math.hypot(...p.points[1].map((n, k) => n - p.points[0][k])) : v,
				0
			);
			expect(chord).toBeGreaterThanOrEqual(r.covered * 0.96 - 1e-8);
		}
	}
	checkDocks(path, walk);
	checkFlights(s, path);
	checkParts(s, parts, walk);
}

for (const shape of plotShapes)
	test(
		shape + ' house circulation obeys width, run, volume, slot and reachability budgets',
		() => {
			for (const n of [1, 2, 4, 5, 8, 12, 32])
				for (const area of [64, 240, 960])
					for (const seed of [0, 1, 2, 7, 11, 17, 103, 0x8a34ff74]) {
						const s = plotHouse(n, area, shape, seed);
						inspect(s);
					}
		},
		120000
	);

test('regeneration changes geometry with the programme and painted carrier held fixed', () => {
	for (const shape of plotShapes) {
		const a = plotHouse(5, 240, shape, 11),
			b = plotHouse(5, 240, shape, 12);
		expect(sectionParts(a)).toEqual(sectionParts(plotHouse(5, 240, shape, 11)));
		expect(sectionParts(a).map(bounds)).not.toEqual(sectionParts(b).map(bounds));
		expect(a.cells).toEqual(b.cells);
		expect(a.decks.flatMap((d) => d.programme)).toEqual(b.decks.flatMap((d) => d.programme));
		const seen = new Set<string>();
		for (const p of sectionParts(a)) {
			const { objectId, variant, seed, member, slot } = p.source,
				key = JSON.stringify(p.source);
			if (seen.has(key)) continue;
			seen.add(key);
			const source = buildObject(objectId, variant, seed).geometry[member];
			expect(source).toMatchObject({ kind: p.kind, slot });
			for (const field of ['token', 'material', 'finish']) expect(source).not.toHaveProperty(field);
		}
	}
});
