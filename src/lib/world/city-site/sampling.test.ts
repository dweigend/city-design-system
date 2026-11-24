import { expect, test } from 'bun:test';
import { planGround } from './sampling';

test('clearance and height reuse the same terrain reading at a shared probe', () => {
	const calls: number[][] = [];
	const ground = planGround((x, y) => {
		calls.push([x, y]);
		return x < 0
			? { height: y - 1, waterClearance: x, waterKind: 'river', waterHeight: y }
			: { height: y, waterClearance: x, waterKind: null };
	}, 3);
	expect(ground.clearanceAt(10, 5)).toBe(7);
	expect(ground.heightAt(10, 5)).toBe(5);
	expect(ground.clearanceAt(-1, 5)).toBe(-4);
	expect(ground.heightAt(-1, 5)).toBeUndefined();
	expect(ground.heightAt(10, 6)).toBe(6);
	expect(calls).toEqual([
		[10, 5],
		[-1, 5],
		[10, 6]
	]);
});
