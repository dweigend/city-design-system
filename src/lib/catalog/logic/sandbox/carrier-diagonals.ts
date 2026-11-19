import { MAX_FRAME_SPAN_M, memberLength } from '../megastructure';
import type { QuadCell, QuadGrid } from '../quad-grid';
import { carrierProbe } from './carrier-probe';
import { position, type Anchor, type Installation, type Proposal } from './installation-parts';

type Segment = Extract<Installation, { kind: 'segment' }>;

function length(grid: QuadGrid, from: Anchor, to: Anchor) {
	return memberLength({ p: position(grid, from) }, { p: position(grid, to) });
}

function alternatives(grid: QuadGrid, parts: Installation[], diagonal: Segment) {
	const post = parts.find(
		(p): p is Segment => p.recipe === 'chord' && p.anchor === diagonal.anchor
	);
	const bearings = parts.filter((p) => p.recipe === 'bearing');
	const postFeet = new Set(
		parts
			.filter((p) => p.recipe === 'chord' && p.anchor.cellId === p.end.cellId)
			.map((p) => p.anchor)
	);
	// Retain the intended crown first. Within each crown, prefer post feet, then shorter ties,
	// breaking ties by the bearing's original assembly order.
	return [diagonal.end, ...(post ? [post.end] : [])].flatMap((end) =>
		bearings
			.filter((p) => p.anchor.cellId !== end.cellId)
			.map(({ anchor }) => ({ anchor, distance: length(grid, anchor, end) }))
			.filter((p) => p.distance <= MAX_FRAME_SPAN_M)
			.sort(
				(a, b) =>
					Number(postFeet.has(b.anchor)) - Number(postFeet.has(a.anchor)) || a.distance - b.distance
			)
			.map(({ anchor }) => ({ ...diagonal, anchor, end }))
	);
}

/** Retries overlength longitudinal diagonals using bearings already in the installation. */
export function probeWallConnections(
	grid: QuadGrid,
	parts: Installation[],
	cells: QuadCell[]
): Proposal {
	const original = carrierProbe(grid, parts, cells);
	if (!('failure' in original) || original.failure.reason !== 'member-too-long') return original;
	const choices: { index: number; rods: Segment[] }[] = [];
	for (const [index, part] of parts.entries()) {
		if (part.kind !== 'segment' || length(grid, part.anchor, part.end) <= MAX_FRAME_SPAN_M)
			continue;
		if (part.recipe !== 'brace' || part.anchor.cellId === part.end.cellId) return original;
		const rods = alternatives(grid, parts, part);
		if (!rods.length) return original;
		choices.push({ index, rods });
	}
	const candidate = parts.slice();
	function search(i: number): Proposal | undefined {
		if (i === choices.length) {
			const result = carrierProbe(grid, candidate, cells);
			return 'parts' in result ? result : undefined;
		}
		const { index, rods } = choices[i];
		for (const rod of rods) {
			if (
				candidate.some(
					(p, j) =>
						j !== index &&
						p.recipe === 'brace' &&
						p.anchor === rod.anchor &&
						p.end.cellId === rod.end.cellId &&
						p.end.face === rod.end.face
				)
			)
				continue;
			candidate[index] = rod;
			const result = search(i + 1);
			if (result) return result;
		}
		candidate[index] = parts[index];
	}
	return search(0) ?? original;
}
