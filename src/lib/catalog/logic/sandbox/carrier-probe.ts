import type { QuadGrid } from '../quad-grid';
import { probeFrame } from '../megastructure';
import type { Vec3 } from '../parametrik/types';
import { rodOf, position, type Installation } from './installation-parts';

/** Resolves the persisted wall seats and members exactly as they will appear in the world. */
export function carrierProbe(grid: QuadGrid, parts: readonly Installation[]) {
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
	return probeFrame([...nodes.values()], bearings, rods).analysis.status;
}
