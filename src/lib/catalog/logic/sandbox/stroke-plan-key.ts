import { changedChunks } from '../quad-grid';
import { buildingPlots } from './building-plots';
import { position, rodOf, type Anchor, type Installation } from './installation-parts';
import type { StrokePlan } from './stroke';
import type { World } from './world';

function plotKey(world: World, id: string) {
	const cell = buildingPlots(world.grid).cellsById.get(id);
	return cell && [cell.corners, cell.pad, cell.neighbors];
}

function anchorKey(world: World, anchor: Anchor, plots: boolean) {
	const { cellId, level, face, inset, vertex, lift } = anchor;
	const grid = plots ? buildingPlots(world.grid) : world.grid;
	return [cellId, level, face, inset, vertex, lift, position(grid, anchor)];
}

function moduleKey(world: World, part: Extract<Installation, { kind: 'module' }>) {
	const support = world.state.parts.get(part.attachedTo);
	const rod = support && rodOf(buildingPlots(world.grid), support);
	return [part.attachedTo, part.share, part.pitch, rod?.a, rod?.b];
}

function partKey(world: World, part: Installation) {
	const plots = part.recipe === 'chord' || part.recipe === 'brace' || part.recipe === 'bearing';
	const base = [part.kind, part.recipe, anchorKey(world, part.anchor, plots)];
	if (part.kind === 'segment') return [...base, anchorKey(world, part.end, plots)];
	if (part.kind === 'pillar' && part.recipe === 'support') {
		const ground = world.grid.cellsById.get(part.anchor.cellId);
		return [...base, ground?.corners[part.anchor.vertex ?? 0]];
	}
	return part.kind === 'module' ? [...base, ...moduleKey(world, part)] : base;
}

function changedKeys<T>(before: ReadonlyMap<string, T>, after: ReadonlyMap<string, T>) {
	if (before === after) return [];
	return [...new Set([...before.keys(), ...after.keys()])]
		.filter((id) => before.get(id) !== after.get(id))
		.sort();
}

function storyChanges(before: World, after: World) {
	return changedKeys(before.state.storyParts, after.state.storyParts).map((id) => {
		const previous = before.state.storyParts.get(id) ?? [];
		const next = after.state.storyParts.get(id) ?? [];
		const removed = previous.filter((part) => !next.includes(part));
		const added = next.filter((part) => !previous.includes(part));
		return [
			id,
			removed,
			added.map(({ anchor, style }) => [
				anchor.level,
				style,
				after.state.stacks.get(id)?.[anchor.level]
			]),
			plotKey(before, id),
			plotKey(after, id)
		];
	});
}

function coverChanges(before: World, after: World) {
	return changedKeys(before.state.cover, after.state.cover).map((id) => [
		id,
		before.state.cover.get(id),
		after.state.cover.get(id),
		before.grid.cellsById.get(id)?.corners,
		after.grid.cellsById.get(id)?.corners
	]);
}

function terrainChanges(before: World, after: World) {
	if (before.grid === after.grid) return [];
	type Cell = World['grid']['cells'][number];
	const cells = new Map<string, [Cell | undefined, Cell]>();
	for (const chunk of changedChunks(before.grid, after.grid)) {
		for (const cell of after.grid.chunks.get(chunk) ?? []) {
			const previous = before.grid.cellsById.get(cell.id);
			if (previous === cell) continue;
			if (JSON.stringify(previous) !== JSON.stringify(cell)) cells.set(cell.id, [previous, cell]);
		}
	}
	const oldEdits = new Set(before.state.edits);
	const newEdits = new Set(after.state.edits);
	return [
		before.state.edits.filter((edit) => !newEdits.has(edit)),
		after.state.edits.filter((edit) => !oldEdits.has(edit)),
		[...cells.keys()].sort().map((id) => [id, cells.get(id)])
	];
}

function lineChanges(before: World, after: World) {
	if (before.lines === after.lines) return [];
	const oldLines = new Map(before.lines.map((line) => [line.id, line]));
	const newLines = new Map(after.lines.map((line) => [line.id, line]));
	const changed = changedKeys(oldLines, newLines);
	return [
		changed.flatMap((id) => {
			const previous = oldLines.get(id);
			const next = newLines.get(id);
			if (!previous || JSON.stringify(previous) === JSON.stringify(next)) return [];
			return [[previous, next]];
		}),
		after.lines
			.filter(({ id }) => !oldLines.has(id))
			.map(({ kind, profile, cellIds, path, length, stops, pillars }) => [
				kind,
				profile,
				cellIds,
				path,
				length,
				stops,
				pillars
			])
	];
}

/** Describes the result of a stroke by value, independent of new IDs and unrelated world state. */
export function strokePlanKey(plan: StrokePlan): string {
	const { base, proposal } = plan;
	if (proposal && 'parts' in proposal)
		return JSON.stringify([proposal.owner, proposal.parts.map((part) => partKey(base, part))]);
	const { draft, failure } = plan.outcome();
	if (draft === base) return JSON.stringify(['none', failure]);
	const removedParts = changedKeys(base.state.parts, draft.state.parts).flatMap((id) => {
		const part = base.state.parts.get(id);
		return part ? [[id, partKey(base, part)]] : [];
	});
	return JSON.stringify([
		storyChanges(base, draft),
		coverChanges(base, draft),
		removedParts,
		lineChanges(base, draft),
		terrainChanges(base, draft)
	]);
}
