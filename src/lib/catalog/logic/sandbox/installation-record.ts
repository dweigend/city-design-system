import { routeSlope } from '../megastructure';
import { position } from './installation-parts';
import type { TerrainGrid, TerrainCell } from '../terrain-grid';
import type { BuiltPart } from './installation-parts';
import type { SandboxState } from './state';
/** Retires the affected installations before their supporting roof or path seat disappears. */
export function removeInstallations(
	state: SandboxState,
	removed: (p: BuiltPart) => boolean
): SandboxState {
	const owners = new Set([...state.parts.values()].filter(removed).map((p) => p.owner));
	if (!owners.size) return state;
	const parts = new Map([...state.parts].filter(([, p]) => !owners.has(p.owner)));
	const recovered = [...state.parts.values()].reduce(
		(sum, p) => sum + (owners.has(p.owner) ? (p.materials.material ?? 0) : 0),
		0
	);
	const compositions = new Map([...state.compositions].filter(([id]) => !owners.has(id)));
	return {
		...state,
		parts,
		compositions,
		store: { ...state.store, material: state.store.material + recovered }
	};
}

/** Finds installation seats on the erased cell, including both ends of every span. */
export function clearInstallation(state: SandboxState, cell: TerrainCell) {
	return removeInstallations(
		state,
		(p) => p.anchor.cellId === cell.id || (p.kind === 'segment' && p.end.cellId === cell.id)
	);
}

/** Recheck changed seats and the spans they carry against the edited terrain. */
export function lostSeat(previous: TerrainGrid, grid: TerrainGrid, part: BuiltPart) {
	let changed = false;
	for (const anchor of part.kind === 'segment' ? [part.anchor, part.end] : [part.anchor]) {
		const cell = grid.cellsById.get(anchor.cellId);
		if (cell === previous.cellsById.get(anchor.cellId)) continue;
		changed = true;
		if (!cell || (anchor.level > 0 ? !cell.buildable : cell.zone === 'water')) return true;
		if (
			part.recipe === 'support' &&
			position(grid, anchor)[2] <= cell.corners[anchor.vertex ?? 0][2]
		)
			return true;
	}
	return changed && part.kind === 'segment' && invalidSpan(grid, part);
}

function invalidSpan(grid: TerrainGrid, part: Extract<BuiltPart, { kind: 'segment' }>) {
	const points = [position(grid, part.anchor), position(grid, part.end)];
	if (
		part.recipe === 'walkway' ||
		(part.recipe === 'chord' &&
			(part.anchor.cellId !== part.end.cellId || part.anchor.face !== part.end.face))
	)
		return Math.abs(points[0][2] - points[1][2]) > 1e-8;
	if (part.recipe === 'stair') return !routeSlope({ points, links: [[0, 1]] }, 0, 1);
	return false;
}
