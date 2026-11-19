import { cellsBetween, type TerrainGrid } from '../terrain-grid';
import { stylesForYear, styleForYear } from './state';
import { dockStroke } from './dock-stroke';
import { walkwayStroke } from './walkway-stroke';
import {
	rejected,
	type BuiltPart,
	type Installation,
	type Owner,
	type PartId,
	type Proposal
} from './installation-parts';
import type { SandboxState } from './state';
import type { Tool } from './state';
import type { World } from './world';

function occupiedCells(grid: TerrainGrid, part: Installation): string[] {
	return part.kind === 'segment'
		? cellsBetween(grid, part.anchor.cellId, part.end.cellId).map((c) => c.id)
		: [part.anchor.cellId];
}

/** Selects the stroke-level planner for the active house epoch or elevated path. */
export function propose(world: World, tool: Tool, ids: readonly string[]): Proposal | undefined {
	const cells = () => ids.flatMap((id) => world.grid.cellsById.get(id) ?? []);
	if (tool.kind === 'line' && tool.transit === 'walkway') {
		const path = walkwayStroke(world.grid, cells());
		if ('failure' in path) return path;
		const occupied = new Set(
			[...world.state.parts.values()]
				.filter((p) => world.state.compositions.get(p.owner)?.system === 'paths')
				.flatMap((p) => occupiedCells(world.grid, p))
		);
		if (path.parts.some((p) => occupiedCells(world.grid, p).some((id) => occupied.has(id))))
			return rejected('occupied-path', cells());
		return path;
	}
	if (tool.kind !== 'house') return;
	if (tool.style && !stylesForYear(world.state.year).includes(tool.style)) return;
	const style = tool.style ?? styleForYear(world.state.year);
	if (style === 'totem') return dockStroke(world, cells(), tool.use);
}

/** Assigns stable slots only after the complete proposal has passed its survey. */
export function install(
	state: SandboxState,
	proposal: Extract<Proposal, { parts: unknown }>,
	tool: Tool
): SandboxState {
	const system = tool.kind === 'line' ? 'paths' : 'houses';
	const flow = tool.kind === 'house' && tool.use !== 'living' ? tool.use : 'people';
	const action = state.nextAction;
	const owner: Owner = proposal.owner ?? `c/${action}`;
	const compositions = new Map(state.compositions).set(owner, { id: owner, system });
	const parts = new Map(state.parts);
	let available = state.store.material;
	proposal.parts.forEach((spec, slot) => {
		const debit = Math.min(1, available);
		available -= debit;
		const id: PartId = `p/${action}/${slot}`;
		const p: BuiltPart = {
			...(spec.recipe === 'plaza' ? { finish: 'beton-terrazzo' as const } : {}),
			...spec,
			id,
			owner,
			built: state.year,
			flow,
			materials: { material: debit }
		};
		parts.set(id, p);
	});
	return {
		...state,
		nextAction: action + 1,
		compositions,
		parts,
		store: { ...state.store, material: available }
	};
}
