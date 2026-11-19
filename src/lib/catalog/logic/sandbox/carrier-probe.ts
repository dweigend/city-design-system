import type { QuadCell, QuadGrid } from '../quad-grid';
import { MAX_FRAME_SPAN_M, memberLength, probeFrame } from '../megastructure';
import type { Vec3 } from '../parametrik/types';
import { rodOf, position, rejected, type Proposal, type Installation } from './installation-parts';

/** Resolves the persisted wall seats and members exactly as they will appear in the world. */
export function carrierProbe(grid: QuadGrid, parts: Installation[], cells: QuadCell[]): Proposal {
	const nodes = new Map<string, { id: string; p: Vec3 }>();
	function joint(p: Vec3) {
		const id = p.join('/');
		const n = { id, p };
		nodes.set(id, n);
		return n;
	}
	const bearings = parts.flatMap((p) =>
		p.recipe === 'bearing' ? [joint(position(grid, p.anchor))] : []
	);
	const rods = parts.flatMap((part) => {
		const rod = rodOf(grid, part);
		return rod ? [{ a: joint(rod.a), b: joint(rod.b), radius: rod.radius }] : [];
	});
	const overlong = rods.find((r) => memberLength(r.a, r.b) > MAX_FRAME_SPAN_M);
	if (overlong)
		return { failure: { reason: 'member-too-long', marks: [[overlong.a.p, overlong.b.p]] } };
	if (probeFrame([...nodes.values()], bearings, rods).analysis.status !== 'ok')
		return rejected('unstable-frame', cells);
	return { parts };
}
