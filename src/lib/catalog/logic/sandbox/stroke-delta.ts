import { changedChunks } from '../quad-grid';
import { buildingPlots } from './building-plots';
import type { PartId } from './installation-parts';
import { installationGeometry } from './installation-view';
import { canonicalChanges, stateChanges } from './state-delta';
import type { World } from './world';

function changedEntries<K, V>(before: ReadonlyMap<K, V>, after: ReadonlyMap<K, V>) {
	if (before === after) return [];
	return [...new Set([...before.keys(), ...after.keys()])].filter(
		(id) => before.get(id) !== after.get(id)
	);
}

function surfaceChanges(before: World, after: World) {
	if (before.grid === after.grid) return [];
	const chunks = changedChunks(before.grid, after.grid);
	return [...chunks].flatMap((chunk) =>
		(after.grid.chunks.get(chunk) ?? []).flatMap((cell) =>
			stateChanges(before.grid.cellsById.get(cell.id), cell, ['surface', cell.id])
		)
	);
}

function plotChanges(before: World, after: World) {
	const ids = new Set([
		...changedEntries(before.state.stacks, after.state.stacks),
		...changedEntries(before.state.storyParts, after.state.storyParts),
		...changedEntries(before.state.cover, after.state.cover)
	]);
	return [...ids].flatMap((id) => {
		const footprint = (world: World) => {
			const plot = buildingPlots(world.grid).cellsById.get(id);
			return plot && { corners: plot.corners, pad: plot.pad, neighbors: plot.neighbors };
		};
		return stateChanges(undefined, [footprint(before), footprint(after)], ['plot', id]);
	});
}

function installationAt(world: World, id: PartId) {
	const part = world.state.parts.get(id);
	if (!part) return;
	const support = part.kind === 'module' ? world.state.parts.get(part.attachedTo) : undefined;
	return [installationGeometry(world, part), support];
}

function installationChanges(before: World, after: World) {
	return changedEntries(before.state.parts, after.state.parts).flatMap((id) =>
		stateChanges(installationAt(before, id), installationAt(after, id), ['installation', id])
	);
}

/** Canonicalizes every persisted write and the corresponding derived build geometry. */
export function strokeDelta(before: World, after: World): string {
	return canonicalChanges([
		...stateChanges(before.state, after.state),
		...surfaceChanges(before, after),
		...plotChanges(before, after),
		...installationChanges(before, after),
		...stateChanges(before.lines, after.lines, ['routes'])
	]);
}
