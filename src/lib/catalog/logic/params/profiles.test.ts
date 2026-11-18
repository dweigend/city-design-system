// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { STRUCTURE_PARAMS, TERRAIN_VIEW_PARAMS } from '../../scene/sandbox/view-params';
import { forestChunk, LAND_COVER_PARAMS, type Cover } from '../land-cover';
import { squareGrid } from '../quad-grid';
import { createTerrain } from '../terrain';
import { deriveGrid } from '../terrain-grid';
import { lineParts, routeLine, TRANSIT_PARAMS, vehiclePoses } from '../transit-line';
import { TREE_PARAMS, trunkRadius } from '../tree-forms';
import { walkwayParts, WALKWAY_PARAMS } from '../walkway';
import { resolveParams } from './index';

const fingerprint = (value: unknown) =>
	createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('forest defaults retain the seed-7 geometry, part IDs and order from 9697b48', () => {
	const grid = squareGrid(6, 6, 5, 6);
	const cover: Cover = new Map(grid.cells.map((cell) => [cell.id, 'forest']));
	const defaults = forestChunk(grid, cover, '0:0', 7);
	expect(fingerprint(defaults)).toBe(
		'b0800045ebdda3d2f1d2357679595d967df505db5a1a31ae687f773b97541799'
	);
	const tree = resolveParams(TREE_PARAMS, { trunkRadiusMin: 0.5 });
	const overrides = resolveParams(LAND_COVER_PARAMS, { cellMargin: 0.5 });
	const changed = forestChunk(grid, cover, '0:0', 7, overrides, tree);
	expect(changed.map((p) => p.id)).toEqual(defaults.map((p) => p.id));
	expect(changed[0]).toMatchObject({ radius: trunkRadius(3, tree) });
	expect(changed).not.toEqual(defaults);
});

const grid = deriveGrid(createTerrain({ seed: 7 }));
const routes = [
	['viaduct', '13e8dadabf559d45e0b9b0845b969b2cf814e76834f810539c739776703de8b7'],
	['capsule', '723ddf36572243eace1fe5f5673cc6f7946d11c9c5786945002316e3c612c5c9']
] as const;
for (const [kind, expected] of routes) {
	test(kind + ' retains the default output and projects the persisted profile', () => {
		const stroke = { id: 'test', kind, cellIds: ['40/35', '80/35', '80/75'] };
		const line = routeLine(grid, stroke);
		if (!line) throw new Error('Expected the default route');
		expect(fingerprint([line, lineParts(line), vehiclePoses(line, 10)])).toBe(expected);
		const radius = TRANSIT_PARAMS[kind].deckRadius.default + 0.1;
		const changed = routeLine(grid, stroke, { deckRadius: radius, speed: 8 });
		if (!changed) throw new Error('Expected the customized route');
		expect(lineParts(JSON.parse(JSON.stringify(changed)))[0]).toMatchObject({ radius });
		expect(changed.path).toEqual(line.path);
		expect(changed.pillars[0].top).toBeCloseTo(line.pillars[0].top - 0.1);
		expect(vehiclePoses(changed, 10)).not.toEqual(vehiclePoses(line, 10));
	});
}

test('walkway defaults retain the bent route and its thickness follows the profile', () => {
	const points = [
		[0, 0, 6],
		[12, 0, 4],
		[12, 12, 4]
	] as const;
	const anchors = points.map(([x, y, z]): [number, number, number] => [x, y, z]);
	expect(fingerprint(walkwayParts(anchors))).toBe(
		'dbce442e79df9af123efa1c7aeebb83ab3ad2d4088c786c80a72d7883ad5a23f'
	);
	const overrides = resolveParams(WALKWAY_PARAMS, { thickness: 0.5, treadRise: 0.5 });
	const parts = walkwayParts(anchors, undefined, overrides);
	expect(parts.filter((p) => p.id.includes(':tread:'))).toHaveLength(5);
	expect(parts[0]).toMatchObject({ height: 0.5, z: 5.5 });
	expect(parts.find((p) => p.id === 'walkway:0:pier')).toMatchObject({ height: 4.5 });
});

test('sandbox projection exposes cell units and validates material overrides', () => {
	expect(TERRAIN_VIEW_PARAMS.parcelCells).toMatchObject({
		type: 'integer',
		unit: 'cells',
		default: 10
	});
	expect(() => resolveParams(TERRAIN_VIEW_PARAMS, { parcelCells: 2.5 })).toThrow(RangeError);
	expect(STRUCTURE_PARAMS.creasePx.unit).toBe('px');
	expect(() => resolveParams(STRUCTURE_PARAMS, { glassOpacity: 2 })).toThrow(RangeError);
});
