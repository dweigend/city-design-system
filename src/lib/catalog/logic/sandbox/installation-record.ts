import type { TerrainCell } from '../terrain-grid';
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
	const compositions = new Map([...state.compositions].filter(([id]) => !owners.has(id)));
	return {
		...state,
		parts,
		compositions,
		store: { ...state.store, material: state.store.material + state.parts.size - parts.size }
	};
}

/** Finds installation seats on the erased cell, including both ends of every span. */
export function clearInstallation(state: SandboxState, cell: TerrainCell) {
	return removeInstallations(
		state,
		(p) => p.anchor.cellId === cell.id || (p.kind === 'segment' && p.end.cellId === cell.id)
	);
}
