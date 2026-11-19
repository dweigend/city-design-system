import assert from 'node:assert/strict';
import { expect, test } from 'bun:test';
import type { EnsembleCell } from '../house-brush';
import { STORY } from '../../data/grid';
import { focuses } from '../presentation';
import { buildingPlots } from './building-plots';
import { houseEnsembles } from './house-ensembles';
import { acceptanceScene, applyEdit, changes, houseGroups, type World } from './index';

function required<T>(value: T | undefined): T {
	assert(value !== undefined);
	return value;
}

function expectPeakVolume(world: World, earliestFullYear: number, peak: EnsembleCell) {
	const cell = required(world.grid.cellsById.get(peak.body));
	const view = [
		...houseGroups(world, cell.chunk, focuses.all, undefined, earliestFullYear).values()
	].flat();
	const base = view.find((p) => p.id === peak.body + '@1:wall');
	const crown = view.find((p) => p.id === peak.body + '@' + (peak.height - 2) + ':wall');
	expect(base?.kind).toBe('prism');
	expect(crown?.kind).toBe('prism');
	if (base?.kind !== 'prism' || crown?.kind !== 'prism') throw Error('Missing joined walls');
	expect(crown.height + 0.32).toBeCloseTo(2 * STORY);
	expect(crown.z - base.z).toBeCloseTo(base.height + 0.32);
	for (const level of [2, 4])
		expect(view.some(({ id }) => id === peak.body + '@' + level + ':plate')).toBe(false);
}

test('the seed-7 bank has four distinct, stepped ensembles through the sandbox projection', () => {
	const { world, earliestFullYear } = acceptanceScene();
	const { grid, state, seed } = world;
	const plots = buildingPlots(grid);
	const layout = houseEnsembles(grid, plots, state, seed);
	const bank = [...layout.members.values()].filter((ids) =>
		ids.some((id) => grid.cellsById.get(id)?.zone === 'floodplain')
	);
	expect(bank).toHaveLength(4);
	for (const ids of bank) {
		const parcels = ids.map((id) => required(layout.cells.get(id)));
		const peaks = parcels.filter(({ role }) => role === 'turm');
		expect(peaks).toHaveLength(1);
		const peak = peaks[0];
		expect(
			peak.height -
				Math.max(...parcels.filter((parcel) => parcel !== peak).map(({ height }) => height))
		).toBeGreaterThanOrEqual(2);
		for (const parcel of parcels)
			for (const neighbor of parcel.neighbors.map((id) => required(layout.cells.get(id))))
				if (neighbor.body !== parcel.body) expect(neighbor.height).not.toBe(parcel.height);
		expectPeakVolume(world, earliestFullYear, peak);
	}
});

test('joining two painted components invalidates both and leaves a remote component untouched', () => {
	const { world: start, earliestFullYear } = acceptanceScene();
	let world: World = start;
	const ids = ['10/23', '14/23', '25/23'];
	const paint = (cellId: string) => {
		world = applyEdit(world, { kind: 'raise', cellId, use: 'living', style: 'collage' });
		expect(world.state.stacks.has(cellId)).toBe(true);
	};
	ids.forEach(paint);
	const before = world;
	paint('12/23');
	const delta = changes(before, world);
	for (const id of ids.slice(0, 2))
		expect([...delta.houseGroups.keys()].some((key) => key.includes(id + '@'))).toBe(true);
	expect([...delta.houseGroups.keys()].some((key) => key.includes(ids[2] + '@'))).toBe(false);
	const remote = (w: typeof world) =>
		houseGroups(
			w,
			required(w.grid.cellsById.get(ids[2])).chunk,
			focuses.all,
			undefined,
			earliestFullYear
		);
	expect(remote(world)).toEqual(remote(before));
});
