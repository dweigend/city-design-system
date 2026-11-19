import { STORY } from '../../data/grid';
import { neighborsOf, type QuadCell, type QuadGrid } from '../quad-grid';
import { storiesOf, type HouseUse, type Stacks } from './stacks';
import type { Ensembles } from './ensemble';
import { volumeAt, type Volume } from './ensemble-volume';

export type Story = Readonly<{ cell: QuadCell; level: number }>;

/**
 * One building mass on a common floor datum. Joined walls can span a continuous storey interval.
 */
export type Mass = Readonly<{
	/** Identity from the anchor: `cellId@level`. */
	id: string;
	use: HouseUse;
	/** Floor height in meters. */
	floor: number;
	/** True if the mass stands on the raised datum of flooding ground. */
	raised: boolean;
	/** Bottom story of each footprint cell, ordered by cell index; the first is the anchor. */
	stories: readonly Story[];
	/** A continuous extruded volume with one footprint for its whole storey interval. */
	volume?: Volume;
}>;

type Like = Pick<Mass, 'use' | 'floor' | 'raised'>;

/** Floor height of a story in meters. */
export const floorOf = (cell: QuadCell, level: number) => cell.pad + level * STORY;

/** Number of storeys in the extrusion, including its top storey. */
export const massStoreys = (mass: Mass) => (mass.volume ? mass.volume.end - mass.volume.start : 1);

/** Stable story keys covered by a mass, in footprint order and bottom to top. */
export function massStoryKeys(mass: Mass): string[] {
	return mass.stories.flatMap(({ cell, level }) =>
		Array.from({ length: massStoreys(mass) }, (_, offset) => `${cell.id}@${level + offset}`)
	);
}

/** Level of the story of `cell` that belongs to a mass with this floor and use, or -1. */
function memberLevel(stacks: Stacks, cell: QuadCell, like: Like, join?: boolean) {
	if (cell.raised !== like.raised) return -1;
	const level = (like.floor - cell.pad) / STORY;
	if (!Number.isInteger(level) || level < 0) return -1;
	const use = storiesOf(stacks, cell.id)[level];
	return use !== undefined && (use === like.use || join) ? level : -1;
}

function matchingVolume(a: Volume, b: Volume | undefined) {
	return !!b && a.start === b.start && a.end === b.end && a.form === b.form;
}

const matchingBody = (volume: Volume, a: string, b: string) => volume.form === 'sockel' || a === b;

function volumeNeighbor(
	stacks: Stacks,
	ensembles: Ensembles | undefined,
	anchor: Story,
	other: QuadCell,
	volume: Volume | undefined
) {
	if (!ensembles) return undefined;
	const a = ensembles.cells.get(anchor.cell.id);
	const b = ensembles.cells.get(other.id);
	if (!volume) return b?.neighbors.length ? false : undefined;
	if (!a || !b || a.id !== b.id || anchor.cell.pad !== other.pad) return false;
	const next = volumeAt(stacks, ensembles, other.id, anchor.level);
	return matchingVolume(volume, next) && matchingBody(volume, a.body, b.body);
}

/**
 * The mass that contains story `level` of `cell`. The story must exist.
 * Cost: one flood fill over the mass. Order-independent: stories come sorted by cell index.
 */
export function massAt(
	grid: QuadGrid,
	stacks: Stacks,
	cell: QuadCell,
	level: number,
	ensembles?: Ensembles
): Mass {
	const volume = volumeAt(stacks, ensembles, cell.id, level);
	level = volume?.start ?? level;
	const like: Like = {
		use: storiesOf(stacks, cell.id)[level],
		floor: floorOf(cell, level),
		raised: cell.raised
	};
	const stories: Story[] = [{ cell, level }];
	const seen = new Set([cell.id]);
	for (let i = 0; i < stories.length; i++)
		for (const neighbor of neighborsOf(grid, stories[i].cell)) {
			if (seen.has(neighbor.id)) continue;
			seen.add(neighbor.id);
			const join = volumeNeighbor(stacks, ensembles, { cell, level }, neighbor, volume);
			if (join === false) continue;
			const neighborLevel = memberLevel(stacks, neighbor, like, join);
			if (neighborLevel >= 0) stories.push({ cell: neighbor, level: neighborLevel });
		}
	stories.sort((a, b) => a.cell.index - b.cell.index);
	const anchor = stories[0];
	return {
		...like,
		use: storiesOf(stacks, anchor.cell.id)[anchor.level],
		id: `${anchor.cell.id}@${anchor.level}`,
		stories,
		...(volume && { volume })
	};
}

/**
 * All masses anchored in a chunk, in anchor order. A mass may reach into other chunks;
 * it belongs to the chunk of its anchor alone.
 */
export function massesOfChunk(
	grid: QuadGrid,
	stacks: Stacks,
	chunk: string,
	ensembles?: Ensembles
): Mass[] {
	const masses: Mass[] = [];
	const done = new Set<string>();
	for (const cell of grid.chunks.get(chunk) ?? [])
		storiesOf(stacks, cell.id).forEach((_, level) => {
			if (done.has(`${cell.id}@${level}`)) return;
			const mass = massAt(grid, stacks, cell, level, ensembles);
			for (const key of massStoryKeys(mass)) done.add(key);
			if (mass.stories[0].cell.chunk === chunk) masses.push(mass);
		});
	return masses;
}

/**
 * Chunks whose masses differ between two stack states that differ only in `cellIds`.
 * Covers the edited cells and their side neighbors, whose walls and crowns react.
 */
export function touchedChunks(
	grid: QuadGrid,
	before: Stacks,
	after: Stacks,
	cellIds: Iterable<string>
): Set<string> {
	const chunks = new Set<string>();
	const visit = (cell: QuadCell) => {
		for (const stacks of [before, after])
			storiesOf(stacks, cell.id).forEach((_, level) =>
				chunks.add(massAt(grid, stacks, cell, level).stories[0].cell.chunk)
			);
	};
	for (const cellId of cellIds) {
		const cell = grid.cellsById.get(cellId);
		if (!cell) continue;
		visit(cell);
		neighborsOf(grid, cell).forEach(visit);
	}
	return chunks;
}
