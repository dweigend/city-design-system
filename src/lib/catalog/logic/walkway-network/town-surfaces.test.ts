import { required } from '../required';
import { fitWalkingFlights } from './index';
import { townPath } from './town-path';
import { pathDeck } from './path-deck';
import { townLinkSurvey, townSpans } from './town-stations';
import type { Vec3, Primitive } from '../parametrik/types';
import { chainage, pathPoint } from '../linear-path';
import { test, expect } from 'bun:test';
import { openingScene, cityCentreView } from '../sandbox';
import { houseSurfaces } from '../composed-house';
import { area } from '../ansicht/geometrie';
import { intersect, shoelaceArea } from '../parametrik/raster/geometry';
import { publicFlight } from './town-deck';
import { walkingPlates } from './town-survey.test-support';

test('an unsupported ground span uses plain cast paving', () => {
	const parts = publicFlight({ id: 'ground', a: [0, 0, 0.2], b: [5, 0, 0.2] }, () => 0);
	expect(parts.find((p) => p.kind === 'prism')).toMatchObject({
		token: '--paper',
		finish: 'beton-schalung',
		material: 'concrete'
	});
});

test('a tread crossing the grid edge has finite retaining faces up to its soffit', () => {
	const parts = publicFlight({ id: 'edge', a: [0, 0, 0.2], b: [5, 0, 0.2] }, (_, y) =>
		y < 0 ? NaN : 0
	);
	const foot = parts.find((p) => p.kind === 'mesh' && p.id === 'edge/pier/foot');
	if (foot?.kind !== 'mesh') throw Error('Missing retaining face at the grid edge');
	expect(foot.points.flat().every(Number.isFinite)).toBe(true);
	expect(foot.points.filter(([, y]) => y < 0).every(([, , z]) => z === 0)).toBe(true);
	expect(foot.points.some(([, y, z]) => y > 0 && z < 0)).toBe(true);
});

for (const seed of [7, 13, 29])
	test(
		'single flush walking surfaces on ' + seed,
		() => {
			const parts = cityCentreView(openingScene(seed).world),
				faces = walkingPlates(parts);
			expect(faces.length).toBeGreaterThan(0);
			expect(
				parts
					.filter(
						(p) =>
							(p.id.startsWith('town-walk/') || p.id.startsWith('court/')) &&
							p.finish === 'holz-natur'
					)
					.map((p) => p.id)
			).toEqual([]);
			const courts = faces.filter((p) => /^court\/\d+\/\d+$/.test(p.id));
			expect(new Set(courts.map((p) => p.finish))).toEqual(
				new Set(['beton-schalung', 'beton-terrazzo'])
			);
			const joints = faces.filter((p) => p.id.startsWith('town-walk/joint/'));
			expect(joints.some((p) => p.token === houseSurfaces.access.token)).toBe(true);
			const checked = faces.map((p) => {
				expect(p.finish, p.id).not.toBe('holz-natur');
				if (p.token === houseSurfaces.access.token) expect(p.finish).toBe('kunststoff-formteil');
				if (p.id.startsWith('town-walk/platform/'))
					expect(p).toMatchObject({ token: '--paper', finish: 'beton-schalung' });
				return {
					p,
					polygon: shoelaceArea(p.polygon) < 0 ? [...p.polygon].reverse() : p.polygon,
					top: p.z + p.height
				};
			});
			for (const [i, a] of checked.entries())
				for (const b of checked.slice(i + 1)) {
					if (Math.abs(a.top - b.top) > 1e-7) continue;
					expect(
						area(intersect(a.polygon, b.polygon)),
						a.p.id + ' / ' + b.p.id
					).toBeLessThanOrEqual(0.0001);
				}
		},
		30000
	);

function checkRails(
	parts: ReturnType<typeof pathDeck>,
	rails: Extract<Primitive, { kind: 'pipe' }>[],
	bands: ReturnType<typeof townPath>['bands']
) {
	for (const [i, rail] of rails.entries()) {
		const positions = rail.points.map(([x, y, z]): Vec3 => [x, y, z - 1.04]);
		const side = i === 0 ? 'right' : 'left';
		const expected = [...bands[0][side], ...bands[1][side].slice(1)];
		for (const [j, p] of positions.entries())
			for (const k of [0, 1, 2]) expect(p[k]).toBeCloseTo(expected[j][k], 10);
		const distance = chainage(positions),
			length = distance[distance.length - 1];
		const posts = parts.flatMap((p) =>
			p.kind === 'cylinder' && p.id.startsWith(rail.id + '/post/') ? [p.position] : []
		);
		expect(length / posts.length).toBeLessThanOrEqual(3);
		for (const [j, p] of posts.entries()) {
			const target = pathPoint(positions, distance, ((j + 0.5) * length) / posts.length);
			expect(Math.hypot(...p.map((v, k) => v - target[k]))).toBeLessThan(1e-8);
		}
	}
}
test('a swept bend has coincident deck seams and one arc-spaced guard on each walking edge', () => {
	for (const angle of [-1.3, -0.85, 0.42, 1.1, 1.5]) {
		const point: Vec3 = [9, 0, 2];
		const { bands, junctions } = townPath(
			[
				{ id: 'a', a: [0, 0, 2], b: point },
				{ id: 'b', a: point, b: [9 + 12 * Math.cos(angle), 12 * Math.sin(angle), 2] }
			],
			new Map()
		);
		for (const side of ['left', 'right'] as const)
			expect(bands[0][side].at(-1)).toEqual(bands[1][side][0]);
		const parts = pathDeck(bands, junctions, () => 0);
		const rails = parts.flatMap((p) => (p.kind === 'pipe' ? [p] : []));
		expect(rails).toHaveLength(2);
		checkRails(parts, rails, bands);
	}
});

test('a graded town flight reserves the stock going and limits both ascending and descending risers', () => {
	for (const rise of [-2, 2, 4]) {
		const route = [['a', 'b']];
		const a: Vec3 = [0, 0, 4],
			b: Vec3 = [10, 0, 4 + rise];
		const stations = new Map([
			['a', { position: a, arms: ['b'] }],
			['b', { position: b, arms: ['a'] }]
		]);
		const spans = townSpans(townLinkSurvey(route, stations, new Map()), stations, new Map()),
			flight = required(
				spans.find((s) => s.a[2] !== s.b[2]),
				'graded flight'
			);
		const steps = publicFlight(flight, () => 0).flatMap((p) => (p.kind === 'prism' ? [p] : []));
		expect(steps.length).toBeGreaterThan(1);
		for (const [i, p] of steps.entries()) {
			expect(
				Math.hypot(p.polygon[3][0] - p.polygon[0][0], p.polygon[3][1] - p.polygon[0][1])
			).toBeGreaterThanOrEqual(0.29 - 1e-9);
			if (i) expect(Math.abs(p.z - steps[i - 1].z)).toBeLessThanOrEqual(0.17 + 1e-9);
		}
	}
});

test('a gentle grade has a continuous solid ramp whose upper corners meet the paired handrails', () => {
	const parts = publicFlight({ id: 'grade', a: [0, 0, 2], b: [10, 0, 2.8] }, () => 0);
	const ramp = parts.find((p) => p.kind === 'mesh');
	if (ramp?.kind !== 'mesh') throw Error('Expected ramp');
	expect(ramp.triangles.length).toBe(36);
	const top = [ramp.points[3], ramp.points[7], ramp.points[2], ramp.points[6]];
	const rails = parts.flatMap((p) => (p.kind === 'pipe' ? p.points : []));
	expect(rails.map(([x, y]) => [x, y])).toEqual(top.map(([x, y]) => [x, y]));
	for (const [i, p] of top.entries()) expect(rails[i][2] - p[2]).toBeCloseTo(1.04);
});

test('every fork mouth shares both deck corners with the landing and keeps its walking width open', () => {
	const center: Vec3 = [0, 0, 2],
		forks = new Map([['crossing', center]]);
	for (const turn of [0.1, 0.72, 1.25]) {
		const arms = [turn, turn + 2, turn + 4].map((angle, i) => {
			const out = (r: number): Vec3 => [r * Math.cos(angle), r * Math.sin(angle), 2];
			return { id: 'arm/' + i, a: out(2.5), b: out(9), fromFork: 'crossing' };
		});
		const { bands, junctions } = townPath(arms, forks);
		const corners = junctions[0].rim.flatMap((r) => [r[0], r[r.length - 1]]);
		const guards = pathDeck(bands, junctions, () => 0).filter((p) => p.kind === 'pipe');
		expect(guards).toHaveLength(3);
		for (const band of bands) {
			const [a, b] = [band.left[0], band.right[0]];
			expect(corners).toContainEqual(a);
			expect(corners).toContainEqual(b);
			expect(Math.hypot(...a.map((v, k) => v - b[k]))).toBeCloseTo(2.5, 9);
		}
	}
});

test('short flights report their deficit or fold inside the reserved side with a level turning landing', () => {
	const span = { id: 'terminal', a: [0, 0, 0] as Vec3, b: [5.3, 0, 4] as Vec3 };
	const blocked = fitWalkingFlights([span], new Map());
	expect(blocked.spans).toEqual([]);
	expect(blocked.unresolved[0]).toMatchObject({
		id: 'terminal',
		availableRun: 5.3
	});
	expect(blocked.unresolved[0].requiredRun).toBeCloseTo(7.25, 10);
	for (const side of ['left', 'right'] as const) {
		const fit = fitWalkingFlights([span], new Map([['terminal', { side, depth: 8 }]]));
		expect(fit.unresolved).toEqual([]);
		expect(fit.spans[0].a).toEqual(span.a);
		expect(fit.spans.at(-1)?.b).toEqual(span.b);
		const flights = fit.spans.filter((s) => s.a[2] !== s.b[2]);
		expect(flights).toHaveLength(2);
		for (const s of flights) {
			const count = 1 + Math.ceil(Math.abs(s.b[2] - s.a[2]) / 0.17);
			expect(Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) / count).toBeGreaterThanOrEqual(
				0.29 - 1e-9
			);
		}
		expect(fit.spans.some((s) => s.a[2] === 2 && s.b[2] === 2)).toBe(true);
		expect(fit.spans.every((s) => (side === 'left' ? s.a[1] >= 0 : s.a[1] <= 0))).toBe(true);
	}
});

test('guards stop at the exposed stretch of the downhill edge and omit the bank side', () => {
	const span = { id: 'bank', a: [0, 0, 2] as Vec3, b: [12, 0, 2] as Vec3 };
	const parts = publicFlight(span, (x, y) => (y < 0 && x >= 3 && x < 8 ? 0 : 1.9));
	const rails = parts.filter((p) => p.kind === 'pipe');
	expect(rails).toHaveLength(1);
	expect(rails[0].points).toEqual([
		[3, -1.25, 3.04],
		[8, -1.25, 3.04]
	]);
	expect(parts.filter((p) => p.id.includes('/post/'))).toHaveLength(2);
});
test('the public route keeps its walking finish across a low bank and a raised span', () => {
	const { bands, junctions } = townPath(
		[
			{ id: 'low', a: [0, 0, 2], b: [6, 0, 2] },
			{ id: 'high', a: [6, 0, 2], b: [12, 0, 2] }
		],
		new Map()
	);
	const parts = pathDeck(bands, junctions, (x) => (x <= 6 ? 1.8 : 0));
	for (const id of ['low', 'high'])
		expect(parts.find((p) => p.id === id)?.token).toBe(houseSurfaces.access.token);
	expect(parts.find((p) => p.id === 'low/pier/foot')?.token).toBe('--paper');
});
