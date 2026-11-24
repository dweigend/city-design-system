import { expect, test } from 'bun:test';
import { buildAsset, listAssets, readAsset } from '../../lib/world/asset-registry';
import { defaults } from '../../config/blocks-board';
import { buildBoard } from './board';
import { specimenHost } from './hosts';

test('builds every registered specimen at defaults and every combination of parameter bounds', () => {
	const assets = listAssets();
	expect(assets).toHaveLength(22);
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
			expect(object.anchors.length).toBeGreaterThan(0);
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

test('spaces the 22 specimen plinths on the configured metric grid', () => {
	const { bases } = buildBoard(listAssets());
	const {
		boardMaximumColumns,
		boardColumnPitchM,
		boardRowPitchM,
		boardPlotSideM,
		boardPlinthRimM,
		boardPlinthHeightM
	} = defaults;
	expect(bases).toHaveLength(22);
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
