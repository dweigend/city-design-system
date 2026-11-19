import { styleForYear } from './houses';
import { dockStroke } from './dock-stroke';
import { roofStroke } from './roof-stroke';
import { walkwayStroke } from './walkway-stroke';
import {
	rejected,
	type BuiltPart,
	type Owner,
	type PartId,
	type Proposal
} from './installation-parts';
import type { SandboxState } from './state';
import type { Tool } from './state';
import type { World } from './world';

/** Selects the stroke-level planner for the active house epoch or elevated path. */
export function propose(world: World, tool: Tool, ids: readonly string[]): Proposal | undefined {
	const cells = () => ids.flatMap((id) => world.grid.cellsById.get(id) ?? []);
	if (tool.kind === 'line' && tool.transit === 'walkway') {
		const path = walkwayStroke(world.grid, cells());
		if ('failure' in path) return path;
		const occupied = new Set(
			[...world.state.parts.values()]
				.filter((p) => world.state.compositions.get(p.owner)?.system === 'paths')
				.map((p) => p.anchor.cellId)
		);
		if (
			path.parts.some(
				(p) => occupied.has(p.anchor.cellId) || (p.kind === 'segment' && occupied.has(p.end.cellId))
			)
		)
			return rejected('occupied-path', cells());
		return path;
	}
	if (tool.kind !== 'house') return;
	const style = tool.style ?? styleForYear(world.state.year);
	if (style === 'megastructure') return roofStroke(world, cells());
	if (style === 'totem') return dockStroke(world, cells(), tool.use);
}

/** Assigns stable slots only after the complete proposal has passed its survey. */
export function install(
	state: SandboxState,
	proposal: Extract<Proposal, { parts: unknown }>,
	system: 'houses' | 'paths'
): SandboxState {
	const action = state.nextAction;
	const owner: Owner = proposal.owner ?? `c/${action}`;
	const compositions = new Map(state.compositions).set(owner, { id: owner, system });
	const parts = new Map(state.parts);
	proposal.parts.forEach((spec, slot) => {
		const id: PartId = `p/${action}/${slot}`;
		const p: BuiltPart = {
			...spec,
			id,
			owner,
			built: state.year,
			materials: { material: Math.min(1, Math.max(0, state.store.material - slot)) }
		};
		parts.set(id, p);
	});
	return {
		...state,
		nextAction: action + 1,
		compositions,
		parts,
		store: { ...state.store, material: Math.max(0, state.store.material - proposal.parts.length) }
	};
}
