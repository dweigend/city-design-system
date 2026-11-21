import { bodyParts } from '../composed-house/provider';
import { chainage } from '../linear-path';
import { access as projectAccess } from '../composed-house/access';
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
// Clip in 3D so a sloping or vertical sail is tested at the actual tread height.
function clipAtTreadEdge(points: Vec3[], a: [number, number], b: [number, number]) {
	const side = ([x, y]: Vec3) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
	return points.flatMap((p, i) => {
		const q = points[(i + 1) % points.length],
			u = side(p),
			v = side(q);
		const clipped = u >= 0 ? [p] : [];
		if (u * v < 0) clipped.push(p.map((n, k) => n + ((q[k] - n) * u) / (u - v)) as Vec3);
		return clipped;
	});
}
function checkSailHeadroom(parts: Parts, walk: Parts) {
	const sails = parts.filter((p) => p.kind === 'mesh' && p.id.includes('/sail/'));
	for (const tread of walk) {
		if (tread.kind !== 'prism') continue;
		const top = tread.z + tread.height;
		for (const sail of sails) {
			if (sail.kind !== 'mesh') continue;
			for (let j = 0; j < sail.triangles.length; j += 3) {
				let face = sail.triangles.slice(j, j + 3).map((k) => sail.points[k]);
				if (face.every((p) => p[2] <= tread.z) || face.every((p) => p[2] >= top + 2.1)) continue;
				for (const [i, a] of tread.polygon.entries()) {
					face = clipAtTreadEdge(face, a, tread.polygon[(i + 1) % tread.polygon.length]);
					if (!face.length) break;
				}
				expect(
					face.every((p) => p[2] <= tread.z) || face.every((p) => p[2] >= top + 2.1),
					tread.id + ' headroom under ' + sail.id
				).toBe(true);
			}
		}
	}
}
function stairSurface(p: Parts[number]) {
	const source = p.source.objectId;
	return source === 'stairs' ||
		p.id.includes('/access/stair/') ||
		(source === 'ladder' && p.source.member === 0)
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
	const { structure, levels } = s.composition;
	const bodyIds = new Set(levels.flatMap((l) => l.bodies.map((b) => b.id)));
	const frameIds = new Set(
		s.composition.parts
			.filter((p) => ['body', 'socket', 'foot', 'shaft', 'head'].includes(p.joint))
			.map((p) => p.id)
	);
	const platforms = new Set(structure.platforms.flatMap((p) => [p.id, p.id + '/room']));
	const belongs = (id: string, roots: Set<string>) => {
		while (!roots.has(id)) {
			const end = id.lastIndexOf('/');
			if (end < 0) return false;
			id = id.slice(0, end);
		}
		return true;
	};
	// Survey the installed rooms and their frame. Open platforms carry the programme in a truss.
	const bodies = parts.filter((p) => belongs(p.id, bodyIds) || platforms.has(p.id));
	const occupied = occupiedBounds([...bodies, ...parts.filter((p) => belongs(p.id, frameIds))]);
	for (const p of walk) {
		checkClearance(p, bounds(p), occupied);
		checkStairSurface(p);
	}
	const sum = (ps: Parts) => ps.reduce((v, p) => v + volume(p), 0);
	const stairs = sum(walk);
	// The programme budget is measured against its requested stock; clearance and the
	// ten-percent installed-volume budget are measured against the finished assembly.
	const programme = levels.flatMap((level) =>
		level.bodies.flatMap((body) => bodyParts(body, palette))
	);
	expect(sum(programme)).toBeGreaterThan(stairs);
	expect(stairs / sum(parts)).toBeLessThanOrEqual(0.1);
}
function inspect(s: Section) {
	const path = circulation(s),
		parts = sectionParts(s, palette);
	checkDecks(s, path);
	const reports: NonNullable<Parameters<typeof projectAccess>[2]> = [];
	const walk = parts.filter((p) => p.id.includes('/stair/'));
	expect(walk.length).toBeGreaterThan(0);
	if (!s.compact) {
		projectAccess(s, palette, reports);
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
				(v, p) => (p.kind === 'pipe' ? v + (chainage(p.points).at(-1) ?? 0) : v),
				0
			);
			expect(chord).toBeCloseTo(r.covered, 8);
		}
	}
	checkDocks(path, walk);
	checkFlights(s, path);
	checkParts(s, parts, walk);
	if (s.composition.structure.principle === 'fanned-truss') checkSailHeadroom(parts, walk);
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
