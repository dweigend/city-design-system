import assert from 'node:assert/strict';
import { expect, test } from 'bun:test';
import { STORY } from '../../data/grid';
import { quadGrid, squareGrid } from '../quad-grid';
import { houseChunk, massesOfChunk, planEnsembles, type Ensembles, type Stacks } from './index';

function required<T>(value: T | undefined): T {
	assert(value !== undefined);
	return value;
}

const SEED = 7;
const grid = squareGrid(14, 6, 5, 2);

function paint(entries: readonly (readonly [string, number])[]) {
	const stacks: Stacks = new Map(
		entries.map(([id, height], i) => [
			id,
			Array<'living' | 'food'>(height).fill(i % 2 ? 'food' : 'living')
		])
	);
	const placements = new Map(
		entries.map(([id], placed) => [
			id,
			{
				placed,
				front: 0,
				district: 'bank' as const
			}
		])
	);
	return { stacks, placements };
}

function expectStepped(layout: Ensembles) {
	for (const ids of layout.members.values()) {
		const bodies = new Map(
			ids.map((id) => {
				const parcel = required(layout.cells.get(id));
				return [parcel.body, parcel] as const;
			})
		);
		const sorted = [...bodies.values()].sort((a, b) => b.height - a.height);
		expect(sorted.filter(({ role }) => role === 'turm')).toHaveLength(1);
		expect(sorted[0].role).toBe('turm');
		if (sorted.length > 1) expect(sorted[0].height - sorted[1].height).toBeGreaterThanOrEqual(2);
		for (const id of ids) {
			const parcel = required(layout.cells.get(id));
			for (const other of parcel.neighbors.map((n) => required(layout.cells.get(n))))
				if (other.body !== parcel.body) expect(parcel.height).not.toBe(other.height);
		}
	}
}

test('mixed uses join across a vacant parcel and solve storey bounds for every seed', () => {
	const { stacks, placements } = paint([
		['1/2', 1],
		['2/2', 2],
		['4/2', 1],
		['5/2', 1],
		['10/2', 1]
	]);
	for (let seed = 0; seed < 40; seed++) {
		const layout = planEnsembles(grid, grid, stacks, placements, seed);
		expect(layout.members.get('1/2')).toEqual(['1/2', '2/2', '4/2', '5/2']);
		expect(layout.members.get('10/2')).toEqual(['10/2']);
		expectStepped(layout);
		for (const [id, { height, surcharge }] of layout.cells) {
			expect(surcharge).toBeGreaterThanOrEqual(0);
			expect(surcharge).toBeLessThanOrEqual(2);
			expect(height).toBe(required(stacks.get(id)).length + surcharge);
		}
	}
});

test('an equal-height plateau joins by wall and uses its smallest cell ID', () => {
	const { stacks, placements } = paint([
		['1/2', 2],
		['2/2', 2],
		['3/2', 2],
		['4/2', 2]
	]);
	const layout = planEnsembles(grid, grid, stacks, placements, SEED);
	expectStepped(layout);
	expect(layout.cells.get('2/2')?.role).toBe('turm');
	expect(layout.cells.get('3/2')?.body).toBe('3/2');
	expect(layout.cells.get('4/2')?.body).toBe('3/2');
	const masses = massesOfChunk(grid, stacks, required(grid.cellsById.get('3/2')).chunk, layout);
	const wall = masses.find(({ id }) => id === '3/2@1');
	expect(wall?.stories.map(({ cell }) => cell.id)).toEqual(['3/2', '4/2']);
});

test('the tower is uphill even when the valley-edge parcel was painted first', () => {
	const slope = quadGrid(
		grid.cells.map((cell) => ({
			...cell,
			center: [cell.center[0], cell.center[1], cell.center[0]]
		}))
	);
	const { stacks, placements } = paint([
		['1/2', 2],
		['2/2', 2]
	]);
	const layout = planEnsembles(slope, slope, stacks, placements, SEED);
	expect(layout.cells.get('2/2')?.role).toBe('turm');
	expectStepped(layout);
});

test('replaying seed 7 is order independent and a local edit reuses the other ensemble', () => {
	const { stacks, placements } = paint([
		['1/2', 1],
		['2/2', 2],
		['10/2', 2],
		['11/2', 1]
	]);
	const first = planEnsembles(grid, grid, stacks, placements, SEED);
	const replay = planEnsembles(
		grid,
		grid,
		new Map([...stacks].reverse()),
		new Map([...placements].reverse()),
		SEED
	);
	expect(replay).toEqual(first);
	const edited = new Map(stacks).set('1/2', ['living', 'living', 'living']);
	const next = planEnsembles(grid, grid, edited, placements, SEED, first);
	expect(next.cells.get('1/2')).not.toEqual(first.cells.get('1/2'));
	for (const id of ['10/2', '11/2']) expect(next.cells.get(id)).toBe(first.cells.get(id));
});

test('the paper plinth, frontage setback and eight-centimeter joint reach wall geometry', () => {
	const { stacks, placements } = paint([
		['2/2', 2],
		['3/2', 2]
	]);
	const ensembles = planEnsembles(grid, grid, stacks, placements, SEED);
	const chunk = required(grid.cellsById.get('2/2')).chunk;
	const extended: Stacks = new Map(stacks).set('2/2', ['living', 'living', 'living', 'living']);
	const projection = (layout?: Ensembles) => {
		const floors = layout ? extended : stacks;
		return houseChunk(grid, floors, chunk, SEED, 'collage', {
			occupied: floors,
			ensembles: layout,
			blockOf: () => undefined,
			olderRoof: () => false
		});
	};
	const wall = (parts: ReturnType<typeof projection>, id: string) => {
		const part = parts.find((p) => p.id === id + ':wall');
		if (part?.kind !== 'prism') throw new Error('Expected a prism wall');
		return part;
	};
	const parts = projection(ensembles);
	const plinth = wall(parts, '2/2@0');
	const crown = wall(parts, '2/2@2');
	const body = wall(parts, '3/2@1');
	const original = projection();
	const edge = (p: typeof plinth, axis: number, end = Math.min) =>
		end(...p.polygon.map((pt) => pt[axis]));
	expect(plinth.token).toBe('--paper');
	expect(plinth.height + 0.32).toBeCloseTo(STORY);
	expect(edge(wall(original, '2/2@0'), 0) - edge(plinth, 0)).toBeCloseTo(0.3);
	expect(parts.some(({ id }) => id === '3/2@0:wall')).toBe(false);
	expect(edge(body, 0) - edge(wall(parts, '2/2@1'), 0, Math.max)).toBeCloseTo(0.08);
	expect(crown.height + 0.32).toBeCloseTo(STORY * 2);
	expect(parts.some(({ id }) => id === '2/2@3:wall' || id === '2/2@3:plate')).toBe(false);
	expect(edge(body, 1) - edge(wall(original, '3/2@1'), 1)).toBeCloseTo(
		required(ensembles.cells.get('3/2')).setback
	);
	expect(required(ensembles.cells.get('3/2')).setback).toBeGreaterThanOrEqual(0.3);
	expect(required(ensembles.cells.get('3/2')).setback).toBeLessThanOrEqual(0.6);
});
