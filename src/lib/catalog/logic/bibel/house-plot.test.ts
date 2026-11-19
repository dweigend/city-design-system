import { expect, test } from 'bun:test';
import { plotHouse, plotShapes } from './house-plot';
import {
	circulation,
	sectionParts,
	type Section,
	houseSurfaces,
	housePartPlan as planPoints
} from '../composed-house';
import type { Vec3 } from '../parametrik/types';
import { bounds } from '../ansicht/geometrie';
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
function inspect(s: Section) {
	const path = circulation(s),
		parts = sectionParts(s, palette);
	const levels = new Set(path.stops.map((p) => Math.round(p[2] * 100)));
	for (const d of s.decks) {
		expect(levels.has(Math.round(d.position[2] * 100))).toBe(true);
		const elevation = d.position[2] - s.cells[0].pad;
		expect(elevation === 1 || Math.abs(elevation / 2 - Math.round(elevation / 2)) < 1e-7).toBe(
			true
		);
	}
	const previous = new Map<number, number>();
	for (const dock of path.docks) {
		expect(
			parts.some(
				(p) =>
					p.id.includes('/stair/') &&
					p.kind === 'prism' &&
					Math.abs(p.z + p.height - dock.station[2]) <= 0.02 &&
					touches(dock.station, p.polygon)
			)
		).toBe(true);
	}
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
	expect(length).toBeLessThanOrEqual(2.2 * (s.top - s.base[2]));
	const inside = (x: number, y: number) =>
		s.cells.some((c) =>
			c.corners.every(([u, v], i) => {
				const next = c.corners[(i + 1) % 4];
				return (next[0] - u) * (y - v) - (next[1] - v) * (x - u) >= -1e-6;
			})
		);
	const occupied = parts
		.filter((p) => p.id.includes('/body/') || p.id.includes('/post/'))
		.map(bounds);
	let body = 0,
		total = 0,
		access = 0;
	for (const p of parts) {
		expect(
			planPoints(p).every(([x, y]) => inside(x, y)),
			p.id + ' outside ' + s.id
		).toBe(true);
		const box = bounds(p);
		const volume = box.max.reduce((v, max, i) => v * (max - box.min[i]), 1);
		expect(Number.isFinite(volume)).toBe(true);
		total += volume;
		if (p.id.includes('/body/') || p.id.includes('/planter/')) body += volume;
		if (!p.id.includes('/stair/')) continue;
		access += volume;
		expect(
			occupied.every((b) =>
				b.min.some((lo, i) => lo >= box.max[i] - 0.02 || b.max[i] <= box.min[i] + 0.02)
			),
			p.id + ' clearance'
		).toBe(true);
		const source = p.source.objectId;
		const surface =
			source === 'stairs'
				? palette.access
				: source === 'railing' || source === 'ladder'
					? palette.frame
					: palette.deck;
		expect(p.token).toBe(surface.token);
		if (source === 'stairs' && p.kind === 'prism') {
			const ring = p.polygon;
			const j = p.source.variant === 'straight-tread' ? 3 : 1;
			expect(Math.hypot(ring[0][0] - ring[j][0], ring[0][1] - ring[j][1])).toBeCloseTo(1.25, 8);
		}
	}
	expect(body).toBeGreaterThan(access);
	expect(access / total).toBeLessThanOrEqual(0.1);
	return path;
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
		expect(a.width === b.width && a.depth === b.depth).toBe(false);
		expect(a.cells).toEqual(b.cells);
		expect(a.decks.map((d) => d.programme)).toEqual(b.decks.map((d) => d.programme));
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
