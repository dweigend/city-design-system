import { describe, expect, test } from 'bun:test';
import { bounds, union } from '../ansicht/geometrie';
import type { Primitive, Vec3 } from '../parametrik/types';
import {
	buildConstructionPhases,
	buildStyleHouse,
	styleHouseDefaults,
	styleHouseIds
} from './index';

const kinds = (parts: Primitive[]) => new Set(parts.map((part) => part.kind));

/** Bounds of all parts; bars and pipes are measured on their axes, which end flat on the ground. */
function extent(parts: Primitive[]) {
	const axes = parts.flatMap((part): Vec3[] => {
		if (part.kind === 'pipe') return part.points;
		return part.kind === 'frame' && part.members ? part.members.flat() : [];
	});
	const solids = parts.filter(
		(part) => part.kind !== 'pipe' && !(part.kind === 'frame' && part.members)
	);
	return union([...solids.map(bounds), ...axes.map((point) => ({ min: point, max: point }))]);
}

describe('style houses', () => {
	test.each(styleHouseIds)('%s is deterministic, dressed and free of colour values', (id) => {
		const house = buildStyleHouse(id);
		expect(buildStyleHouse(id)).toEqual(house);
		expect(new Set(house.parts.map((part) => part.id)).size).toBe(house.parts.length);
		for (const part of house.parts) {
			expect(part.finish).toBeDefined();
			expect(part.token).toMatch(/^--/);
		}
		expect(JSON.stringify(house.geometry)).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|oklch\(/i);
		expect(Object.keys(house.slots).sort()).toEqual(
			[...new Set(house.geometry.map((shape) => shape.slot))].sort()
		);
	});

	test.each(styleHouseIds)('%s reaches the height and keeps to its lot', (id) => {
		for (const inputs of [styleHouseDefaults, { height: 20, width: 12, complexity: 1 }]) {
			const { min, max } = extent(buildStyleHouse(id, { inputs }).parts);
			const reach = inputs.width * 0.75;
			// Planting may sit slightly in the ground.
			expect(min[2]).toBeGreaterThanOrEqual(-0.02 * inputs.width);
			expect(max[2]).toBeLessThanOrEqual(inputs.height + 1e-9);
			expect(max[2]).toBeGreaterThan(inputs.height * 0.9);
			for (const axis of [0, 1]) {
				expect(min[axis]).toBeGreaterThanOrEqual(-reach);
				expect(max[axis]).toBeLessThanOrEqual(reach);
			}
		}
	});

	test.each(styleHouseIds)('%s adds parts with complexity', (id) => {
		const plain = buildStyleHouse(id, { inputs: { complexity: 0 } });
		const rich = buildStyleHouse(id, { inputs: { complexity: 1 } });
		expect(rich.parts.length).toBeGreaterThan(plain.parts.length);
	});

	test('each phase builds with its own vocabulary', () => {
		const [memphis, archigram, organic] = styleHouseIds.map((id) =>
			kinds(buildStyleHouse(id).parts)
		);
		expect([...memphis]).toEqual(expect.arrayContaining(['box', 'wedge', 'cone', 'arch']));
		expect([...archigram]).toEqual(expect.arrayContaining(['frame', 'capsule', 'mesh', 'pipe']));
		expect(memphis.has('capsule')).toBe(false);
		expect(organic.has('box')).toBe(false);
		expect(organic.has('frame')).toBe(false);
		expect([...organic]).toEqual(expect.arrayContaining(['pipe', 'sphere', 'dome']));
	});

	test('a slot override dresses its parts and unknown input is rejected', () => {
		const house = buildStyleHouse('memphis', {
			slots: { accent: { finish: 'holz-natur', token: '--cat-nature' } }
		});
		const accents = house.parts.filter((_, i) => house.geometry[i].slot === 'accent');
		expect(accents.length).toBeGreaterThan(0);
		for (const part of accents) expect(part.finish).toBe('holz-natur');
		expect(() =>
			buildStyleHouse('organic', { slots: { frame: { finish: 'holz-natur', token: '--ink' } } })
		).toThrow(RangeError);
		expect(() => buildStyleHouse('organic', { inputs: { height: 99 } })).toThrow(RangeError);
	});

	test('phases build one after another and leave earlier houses as stock', () => {
		const axis = [1, 0] as const;
		const row = buildConstructionPhases(axis);
		const total = styleHouseIds.reduce((sum, id) => sum + buildStyleHouse(id).parts.length, 0);
		expect(row.active).toBeUndefined();
		expect(row.parts.length).toBe(total);
		expect(row.parts.every((part) => part.role === 'neu' && part.finish)).toBe(true);
		expect(row.lots.map(({ id }) => id)).toEqual([...styleHouseIds]);
		expect(row.lots[1].centre).toEqual([0, 0, 0]);
		expect(row.lots[2].centre[0] - row.lots[1].centre[0]).toBeGreaterThan(row.inputs.width);
		const diagonal = buildConstructionPhases([Math.SQRT1_2, Math.SQRT1_2]);
		expect(diagonal.lots[2].centre[0] - diagonal.lots[1].centre[0]).toBeGreaterThan(
			diagonal.inputs.width
		);

		const second = buildConstructionPhases(axis, 1);
		const stock = second.parts.filter((part) => part.role === 'bestand');
		expect(second.active).toBe(1);
		expect(stock.length).toBe(buildStyleHouse('memphis').parts.length);
		expect(stock.every((part) => !part.finish && part.id.startsWith('memphis/'))).toBe(true);
		expect(second.parts.some((part) => part.id.startsWith('organic/'))).toBe(false);
		expect(buildConstructionPhases(axis, 3).parts).toEqual(row.parts);
	});
});
