import { MAX_FRAME_SPAN_M, memberLength } from '../megastructure';
import type { QuadCell, QuadGrid } from '../quad-grid';
import { carrierProbe } from './carrier-probe';
import {
	position,
	rejected,
	type Anchor,
	type Installation,
	type Proposal
} from './installation-parts';

type Segment = Extract<Installation, { kind: 'segment' }>;
const MAX_LAYOUTS = 2;

function length(grid: QuadGrid, from: Anchor, to: Anchor) {
	return memberLength({ p: position(grid, from) }, { p: position(grid, to) });
}

function tieKey(rod: Segment) {
	return JSON.stringify([rod.anchor.cellId, rod.anchor.face, rod.end.cellId, rod.end.face]);
}

function append<T>(map: Map<string, T[]>, id: string, value: T) {
	const list = map.get(id);
	if (list) list.push(value);
	else map.set(id, [value]);
}

function wallIndex(parts: Installation[]) {
	const bearings = new Map<string, Anchor[]>();
	const neighbors = new Map<string, string[]>();
	const crowns = new Map<string, Anchor>();
	const ties = new Set<string>();
	for (const part of parts) {
		if (part.recipe === 'bearing') append(bearings, part.anchor.cellId, part.anchor);
		if (part.recipe === 'brace') ties.add(tieKey(part));
		if (part.recipe !== 'chord') continue;
		if (part.anchor.cellId === part.end.cellId) crowns.set(part.anchor.cellId, part.end);
		else {
			append(neighbors, part.anchor.cellId, part.end.cellId);
			append(neighbors, part.end.cellId, part.anchor.cellId);
		}
	}
	return { bearings, neighbors, crowns, ties };
}

// Only wall bearings on a roof joined to the crown by a chord can supply a longitudinal tie.
function wallOptions(grid: QuadGrid, walls: ReturnType<typeof wallIndex>, diagonal: Segment) {
	const other = walls.crowns.get(diagonal.anchor.cellId);
	const options = [diagonal.end, ...(other ? [other] : [])].flatMap((end) =>
		(walls.neighbors.get(end.cellId) ?? []).flatMap((id) =>
			(walls.bearings.get(id) ?? []).map((anchor) => ({
				rod: { ...diagonal, anchor, end },
				distance: length(grid, anchor, end)
			}))
		)
	);
	return options
		.filter((o) => o.distance <= MAX_FRAME_SPAN_M && !walls.ties.has(tieKey(o.rod)))
		.sort((a, b) => a.distance - b.distance)
		.map((o) => o.rod);
}

/** Repairs each long diagonal by length alone, then probes at most two whole installations. */
export function probeWallConnections(
	grid: QuadGrid,
	parts: Installation[],
	cells: QuadCell[]
): Proposal {
	const choices: { index: number; rods: Segment[] }[] = [];
	let walls: ReturnType<typeof wallIndex> | undefined;
	for (const [index, part] of parts.entries()) {
		if (part.kind !== 'segment' || length(grid, part.anchor, part.end) <= MAX_FRAME_SPAN_M)
			continue;
		const rods =
			part.recipe === 'brace' && part.anchor.cellId !== part.end.cellId
				? wallOptions(grid, (walls ??= wallIndex(parts)), part)
				: [];
		if (!rods.length)
			return {
				failure: {
					reason: 'member-too-long',
					marks: [[position(grid, part.anchor), position(grid, part.end)]]
				}
			};
		choices.push({ index, rods });
	}
	if (!choices.length) return carrierProbe(grid, parts, cells);
	for (let rank = 0; rank < MAX_LAYOUTS; rank++) {
		if (rank && choices.every((c) => c.rods.length <= rank)) break;
		const candidate = parts.slice();
		const selected = choices.map((c) => c.rods[rank] ?? c.rods[0]);
		if (new Set(selected.map(tieKey)).size !== selected.length) continue;
		for (const [i, { index }] of choices.entries()) candidate[index] = selected[i];
		const result = carrierProbe(grid, candidate, cells);
		if ('parts' in result) return result;
	}
	return rejected('wall-layout-unresolved', cells);
}
