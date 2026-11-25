import { expect, test } from 'bun:test';
import { houseLevels } from '../../lib/scene/house-projection';
import { readMaterialSurface } from '../../lib/scene/surface';
import { accessSurfaces, railSurfaces } from '../../lib/scene/paths-projection';
import {
	buildAsset,
	buildAssetResult,
	listAssets,
	readAsset
} from '../../lib/world/asset-registry';
import { defaults } from '../../config/blocks-board';
import { buildBoard, presentBoard } from './board';
import { specimenHost } from './hosts';

test('builds every registered specimen at defaults and every combination of parameter bounds', () => {
	const assets = listAssets();
	expect(assets).toHaveLength(27);
	for (const entry of assets) {
		const host = specimenHost(entry);
		const edges = Object.entries(entry.params).reduce<Record<string, number>[]>(
			(rows, [key, { min, max }]) =>
				rows.flatMap((row) => [
					{ ...row, [key]: min },
					{ ...row, [key]: max }
				]),
			[{}]
		);
		for (const overrides of [{}, ...edges]) {
			const object = buildAsset(entry.id, host, overrides, 37);
			expect(object).toEqual(buildAsset(entry.id, host, overrides, 37));
			expect(object.parts.length).toBeGreaterThan(0);
			if (entry.kind !== 'park') expect(object.anchors.length).toBeGreaterThan(0);
			for (const { slot, shape } of object.parts) {
				expect(object.slots).toContain(slot);
				expect(JSON.stringify(shape)).not.toMatch(
					/"(?:colou?r|material|finish|token)"|#[a-f\d]{3,8}\b/i
				);
			}
		}
	}
});

test('places a frame on a resolved lattice bay', () => {
	const bay = specimenHost(readAsset('lattice/box'));
	const frame = buildAsset('structure/frame-bay', bay, {}, 37);
	expect(frame.parts.length).toBeGreaterThan(0);
	expect(frame.anchors.length).toBeGreaterThan(0);
});

test('spaces the 27 specimen plinths on the configured metric grid', () => {
	const { bases } = buildBoard(listAssets());
	const {
		boardMaximumColumns,
		boardColumnPitchM,
		boardRowPitchM,
		boardPlotSideM,
		boardPlinthRimM,
		boardPlinthHeightM
	} = defaults;
	expect(bases).toHaveLength(27);
	const places = [
		[1, [boardColumnPitchM, -0]],
		[boardMaximumColumns, [0, -boardRowPitchM]]
	] as const;
	for (const [index, [x, y]] of places) {
		const side = boardPlotSideM + 2 * boardPlinthRimM;
		expect(bases[index].shape).toMatchObject({
			kind: 'box',
			center: [x, y, -boardPlinthHeightM / 2],
			size: [side, side, boardPlinthHeightM]
		});
	}
});

test('material specimens paint the same face and printed marks when display tags change', () => {
	const asset = readAsset('surface/stripe');
	const original = buildBoard([asset]).specimens;
	expect(original.length).toBeGreaterThan(1);
	expect(original.find(({ id }) => id.endsWith('/mark'))?.strokeSegments).toEqual([]);
	expect(buildBoard([{ ...asset, tags: ['display'] }]).specimens).toEqual(original);
});

test('access and rail specimens use the full Paths role surfaces', () => {
	const { specimens } = buildBoard(
		['access/walkway', 'access/stair', 'rail/pier', 'rail/platform'].map(readAsset)
	);
	const roles = [
		['access/walkway/deck', accessSurfaces.deck],
		['access/walkway/bearing', accessSurfaces.bearing],
		['access/stair/stairs', accessSurfaces.stairs],
		['rail/pier/bearing', railSurfaces.bearing],
		['rail/platform/platform', railSurfaces.platform],
		['rail/platform/bearing', railSurfaces.bearing]
	] as const;
	expect(specimens).toEqual(
		roles.map(([id, surface], index) => ({
			id,
			shape: specimens[index]?.shape,
			...surface
		}))
	);
});

test('paints every sculpture slot and reuses its geometry in all three display modes', () => {
	const assets = listAssets({ kind: 'sculpture' });
	for (const asset of assets) {
		const { object, metadata } = buildAssetResult(
			asset.id,
			specimenHost(asset),
			{},
			defaults.boardSeed
		);
		const board = buildBoard([asset]);
		const full = presentBoard(board, 'full');
		expect(full).toBe(board.drawables);
		expect(board.specimens).toHaveLength(object.parts.length);
		for (const [index, part] of object.parts.entries()) {
			const material = metadata?.[part.slot];
			if (!material) throw new Error('Expected material for ' + part.slot);
			expect(board.specimens[index]).toMatchObject({
				id: asset.id + '/' + part.id,
				...readMaterialSurface(material.family, material.role, 'normal')
			});
		}
		for (const level of ['pencil', 'transparent'] as const) {
			const [base, ...specimens] = presentBoard(board, level);
			expect(base).toBe(board.bases[0]);
			expect(specimens).toHaveLength(board.specimens.length);
			for (const [index, part] of specimens.entries()) {
				expect(part.shape).toBe(board.specimens[index].shape);
				expect(part).toMatchObject({
					hatch: houseLevels[level].hatch,
					fillAlpha: houseLevels[level].fillAlpha,
					occlude: level === 'transparent'
				});
			}
		}
	}
});
