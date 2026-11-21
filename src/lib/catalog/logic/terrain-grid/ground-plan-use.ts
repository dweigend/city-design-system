import { hash } from '../../core/random';
import type { TerrainCell } from './types';

export type GroundUse = 'buildable' | 'path' | 'plaza' | 'court';
const DRAW = { alongCadence: 4, crossCadence: 5, alongPlaza: 6, crossPlaza: 7 };

function pathCandidates(cells: readonly TerrainCell[], anchor: TerrainCell, seed: number) {
	const alongStep = 4 + Math.floor(2 * hash(seed, 0, DRAW.alongCadence));
	const crossStep = 4 + Math.floor(2 * hash(seed, 0, DRAW.crossCadence));
	return new Set(
		cells
			.filter(
				(cell) =>
					(cell.column - anchor.column) % crossStep === 0 ||
					(cell.row - anchor.row) % alongStep === 0
			)
			.map((cell) => cell.id)
	);
}

function joinPath(
	start: string,
	cells: ReadonlyMap<string, TerrainCell>,
	connected: ReadonlySet<string>,
	paths: Set<string>
) {
	const queue = [start];
	const parents = new Map<string, string | undefined>([[start, undefined]]);
	for (const id of queue) {
		if (connected.has(id)) {
			for (let parent = parents.get(id); parent !== undefined; parent = parents.get(parent)) {
				paths.add(parent);
			}
			return;
		}
		for (const neighbor of cells.get(id)?.neighbors ?? []) {
			if (neighbor === null || !cells.has(neighbor) || parents.has(neighbor)) continue;
			parents.set(neighbor, id);
			queue.push(neighbor);
		}
	}
	throw new Error('Expected a connected ground plan');
}

function connectPaths(cells: readonly TerrainCell[], anchor: TerrainCell, paths: Set<string>) {
	const byId = new Map(cells.map((cell) => [cell.id, cell]));
	const connected = new Set<string>();

	function grow(start: string) {
		const queue = [start];
		connected.add(start);
		for (const id of queue) {
			const cell = byId.get(id);
			for (const neighbor of cell?.neighbors ?? []) {
				if (neighbor === null || connected.has(neighbor) || !paths.has(neighbor)) continue;
				connected.add(neighbor);
				queue.push(neighbor);
			}
		}
	}

	grow(anchor.id);
	for (const start of paths) {
		if (connected.has(start)) continue;
		joinPath(start, byId, connected, paths);
		grow(start);
	}
}

function plazaCells(
	cells: readonly TerrainCell[],
	anchor: TerrainCell,
	seed: number,
	paths: ReadonlySet<string>
) {
	const alongSign = hash(seed, 0, DRAW.alongPlaza) < 0.5 ? -1 : 1;
	const crossSign = hash(seed, 0, DRAW.crossPlaza) < 0.5 ? -1 : 1;
	const candidates = cells.filter((cell) => {
		const along = (cell.column - anchor.column) * alongSign;
		const cross = (cell.row - anchor.row) * crossSign;
		return !paths.has(cell.id) && along >= 1 && along <= 2 && cross >= 1 && cross <= 2;
	});
	const byId = new Map(candidates.map((cell) => [cell.id, cell]));
	const queue = candidates.filter((cell) => fronts(cell, paths));
	const reachable = new Set(queue.map((cell) => cell.id));
	for (const { neighbors } of queue) {
		for (const id of neighbors) {
			if (id === null || reachable.has(id)) continue;
			const cell = byId.get(id);
			if (!cell) continue;
			reachable.add(id);
			queue.push(cell);
		}
	}
	return reachable;
}

function fronts(cell: TerrainCell, area: ReadonlySet<string>) {
	return cell.neighbors.some((id) => id !== null && area.has(id));
}

/** Reserves a connected path network, a hub-side plaza and ground without path frontage. */
export function groundPlanUses(cells: readonly TerrainCell[], anchor: TerrainCell, seed: number) {
	const paths = pathCandidates(cells, anchor, seed);
	connectPaths(cells, anchor, paths);
	const plaza = plazaCells(cells, anchor, seed, paths);
	const use = new Map<string, GroundUse>();
	for (const cell of cells) {
		let kind: GroundUse = fronts(cell, paths) ? 'buildable' : 'court';
		if (plaza.has(cell.id)) kind = 'plaza';
		if (paths.has(cell.id)) kind = 'path';
		use.set(cell.id, kind);
	}
	return use;
}
