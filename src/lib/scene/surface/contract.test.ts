import { expect, test } from 'bun:test';
import { PlaceableObject } from '../../core/object';
import {
	accent,
	existing,
	heightRamp,
	resolveSurfaces,
	validateTokens,
	type SurfaceAssignment
} from './index';

const object = PlaceableObject.create({
	id: 'opening',
	slots: ['glass', 'frame'],
	parts: [
		{
			id: 'arched-pane',
			slot: 'glass',
			shape: { kind: 'mesh', positions: [0, 0, 0, 1, 0, 0, 0.5, 0, 1], indices: [0, 1, 2] }
		},
		{
			id: 'sill',
			slot: 'frame',
			shape: { kind: 'box', center: [0.5, 0, 0], size: [1, 0.2, 0.1], rotation: 0 }
		}
	],
	footprint: { width: 1, depth: 0.2 },
	anchors: [{ name: 'sill', position: [0.5, 0, 0], normal: [0, 0, -1] }]
});
const { glass } = existing;
const frame = { color: '--ink', finish: 'line' } as const;

test('assigns surfaces in part order and reuses geometry across finishes', () => {
	const assignment = Object.freeze({ frame, glass });
	const first = resolveSurfaces(object, assignment);
	expect(first).toEqual([
		{ id: 'arched-pane', shape: object.parts[0].shape, color: glass.color, finish: 'glass' },
		{ id: 'sill', shape: object.parts[1].shape, color: frame.color, finish: 'line' }
	]);
	const second = resolveSurfaces(object, { frame, glass: { color: '--paper', finish: 'gloss' } });
	expect(second[0]).toMatchObject({ color: '--paper', finish: 'gloss' });
	expect(second[0].shape).toBe(first[0].shape);
	expect(second[0].shape).toBe(object.parts[0].shape);
	expect(object.anchors).toEqual([{ name: 'sill', position: [0.5, 0, 0], normal: [0, 0, -1] }]);
	expect(object.footprint).toEqual({ width: 1, depth: 0.2 });
	expect(assignment.glass).toBe(glass);
});

test('requires exactly the declared slots, including those without parts', () => {
	expect(() => resolveSurfaces(object, { frame })).toThrow(
		new RangeError('Missing surface for slot "glass"')
	);
	expect(() => resolveSurfaces(object, { glass: undefined, frame })).toThrow(RangeError);
	expect(() => resolveSurfaces(object, { frame, glass, roof: existing.roof })).toThrow(
		new RangeError('Unknown surface slot "roof"')
	);
	const withEmptySlot = PlaceableObject.create({ ...object, slots: [...object.slots, 'wall'] });
	expect(() => resolveSurfaces(withEmptySlot, { frame, glass })).toThrow(/wall/);
	const inherited: SurfaceAssignment = Object.create({ glass });
	expect(() => resolveSurfaces(object, inherited)).toThrow(/glass/);
});

test('validates every assigned token against the names supplied by the caller', () => {
	expect(() => validateTokens({ frame, glass }, [frame.color, glass.color])).not.toThrow();
	expect(() => validateTokens({ frame, glass }, [frame.color])).toThrow(
		new RangeError(`Unknown color token "${glass.color}" for slot "glass"`)
	);
});

test('accents only the wall and keeps every other stock surface', () => {
	const assigned = accent('--cat-living');
	expect(assigned).toEqual({ ...existing, wall: { ...existing.wall, color: '--cat-living' } });
	expect(assigned.glass).toBe(existing.glass);
	expect(existing.wall.color).toBe('--paper-2');
});

test('spreads the height palette over a caller-supplied elevation range', () => {
	expect(heightRamp(21).colorMix.amount).toBe(1);
	expect(heightRamp(21, 280).colorMix.amount).toBe(0.5);
	expect(heightRamp(300, 280).colorMix.amount).toBe(1);
});
