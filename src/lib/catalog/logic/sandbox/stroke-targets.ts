import type { BuiltPart } from './installation-parts';
import type { LineStroke, SandboxState } from './state';
import type { Stroke } from './stroke';
import type { World } from './world';

function touchesPart(part: BuiltPart, ids: ReadonlySet<string>) {
	return ids.has(part.anchor.cellId) || (part.kind === 'segment' && ids.has(part.end.cellId));
}

function partsChanged(before: SandboxState, after: SandboxState, ids: ReadonlySet<string>) {
	if (before.parts === after.parts) return false;
	for (const [id, part] of before.parts)
		if (after.parts.get(id) !== part && touchesPart(part, ids)) return true;
	for (const [id, part] of after.parts)
		if (before.parts.get(id) !== part && touchesPart(part, ids)) return true;
	return false;
}

function linesChanged(before: SandboxState, after: SandboxState, ids: ReadonlySet<string>) {
	if (before.lines === after.lines) return false;
	const previous = new Set(before.lines);
	const next = new Set(after.lines);
	const touches = (line: LineStroke) => line.cellIds.some((id) => ids.has(id));
	return (
		before.lines.some((line) => !next.has(line) && touches(line)) ||
		after.lines.some((line) => !previous.has(line) && touches(line))
	);
}

/** Checks the traced grid cells and their contents against the gesture's original world. */
export function strokeTargetsUnchanged(
	{ base, cellIds }: Pick<Stroke, 'base' | 'cellIds'>,
	world: World
) {
	if (base.seed !== world.seed) return false;
	const before = base.state;
	const after = world.state;
	for (const id of cellIds) {
		if (base.grid.cellsById.get(id) !== world.grid.cellsById.get(id)) return false;
		if (before.stacks.get(id) !== after.stacks.get(id)) return false;
		if (before.storyParts.get(id) !== after.storyParts.get(id)) return false;
		if (before.cover.get(id) !== after.cover.get(id)) return false;
	}
	if (before.parts === after.parts && before.lines === after.lines) return true;
	const targets = new Set(cellIds);
	return !partsChanged(before, after, targets) && !linesChanged(before, after, targets);
}
