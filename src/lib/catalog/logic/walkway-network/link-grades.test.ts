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
