import { cityCorridorSite, openingScene } from '../sandbox';
import { required } from '../required';
import { expect, test } from 'bun:test';
import type { Vec3 } from '../parametrik/types';
import { gradeWalkLinks } from './index';
import { townStairs } from './link-grades';

const at = (x: number, z: number): Vec3 => [x, 0, z];
const court = at(0, 2.6);
const mouths = [
	{ from: 'court', to: 'fork', a: court, b: at(5.21, 6.4) },
	{ from: 'fork', to: 'spur', a: at(6, 6.4), b: at(9, 0) },
	{ from: 'fork', to: 'hill', a: at(8, 6.4), b: at(20, 8.4) }
];

test('all three fork mouths share one graded elevation and each flight fits its own clear run', () => {
	const ends = new Map([['court', court]]);
	const links = gradeWalkLinks(mouths, ends, townStairs);
	expect(links[0].a).toEqual(court);
	expect(links[0].b[2]).toBeCloseTo(5.32, 6);
	expect(links[1].a[2]).toBe(links[0].b[2]);
	expect(links[2].a[2]).toBe(links[0].b[2]);
	expect(links[1].b[2]).toBeGreaterThan(0);
	expect(links[2].b).toEqual(mouths[2].b);
	for (const link of links) expect(link.requiredRun).toBeLessThanOrEqual(link.availableRun);
	expect(gradeWalkLinks([...mouths].reverse(), ends, townStairs).reverse()).toEqual(links);
	expect(mouths[0].b[2]).toBe(6.4);
});

test('incompatible fixed courts report the insufficient run before projection', () => {
	const ends = new Map([
		['court', court],
		['fork', mouths[0].b]
	]);
	expect(() => gradeWalkLinks(mouths, ends, townStairs)).toThrow('fixed court levels');
});

test('the finished court floor supplies the terminal level when the survey height differs', () => {
	const floor = at(0, 3.1);
	const [link] = gradeWalkLinks(mouths, new Map([['court', floor]]), townStairs);
	expect(link.a).toEqual(floor);
	expect(link.requiredRun).toBeLessThanOrEqual(link.availableRun);
});

test('fixed endpoints require two full goings even for a rise within numerical tolerance', () => {
	for (const rise of [townStairs.treadRise, 1e-10]) {
		const a = at(0, 0);
		const b = at(2 * townStairs.going - 1e-10, rise);
		const link = { from: 'low', to: 'high', a, b };
		const ends = new Map([
			['low', a],
			['high', b]
		]);
		expect(() => gradeWalkLinks([link], ends, townStairs)).toThrow('fixed court levels');
		b[0] = 2 * townStairs.going;
		const [fit] = gradeWalkLinks([link], ends, townStairs);
		expect(fit.b).toEqual(b);
		expect(fit.a).toEqual(a);
		expect(fit.requiredRun).toBe(fit.availableRun);
	}
});

// Clear centreline lengths from the swept-path survey, after both mouth setbacks.
for (const [seed, from, to, clearRun, originalRise, gradedRise] of [
	[7, '32/35', '32/34', 3.107688393765594, -3.089350073118546, -1.53],
	[29, '26/32', '26/36', 5.209529325940333, 3.456528748547703, 2.72]
] as const) {
	test(
		'the surveyed straight flight fits seed ' + seed + ' link ' + from + '>' + to,
		() => {
			const [routes, station, courts] = required(
				cityCorridorSite(openingScene(seed).world),
				'city walk'
			);
			expect(routes.some((path) => path.some((id, i) => id === from && path[i + 1] === to))).toBe(
				true
			);
			const ends = new Map(courts.map((c) => [c.id, c.position]));
			const z = (id: string) => (ends.get(id) ?? station(id))[2];
			const link = { from, to, a: at(0, z(from)), b: at(clearRun, z(to)) };
			expect(link.b[2] - link.a[2]).toBeCloseTo(originalRise);
			const [graded] = gradeWalkLinks([link], ends, townStairs);
			expect(graded.b[2] - graded.a[2]).toBeCloseTo(gradedRise, 6);
			expect(graded.requiredRun).toBeLessThanOrEqual(clearRun);
			expect(graded.availableRun).toBe(clearRun);
			expect(graded.a).toEqual(link.a);
		},
		60000
	);
}
