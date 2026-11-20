import type { Vec3 } from '../parametrik/types';
import { addiere, huellmatrix, zerlege } from '../statik';

export const hemTensionFactor = 9;
export const deadLoadPerArea = 0.014; // kN/m²

function assemble(free: number[], positions: Vec3[], links: number[][][], loads: Vec3[]) {
	const rowOf = new Map(free.map((node, row) => [node, row]));
	const firstColumn = Int32Array.from(free, (node, row) =>
		Math.min(row, ...links[node].map(([other]) => rowOf.get(other) ?? row))
	);
	const matrix = huellmatrix(firstColumn);
	const rhs = [0, 1, 2].map((axis) => Float64Array.from(free, (node) => loads[node][axis]));
	// Sum(q) p_i - Sum(q p_j) = load_i. Fixed neighbors contribute directly to the RHS.
	for (const [row, node] of free.entries()) {
		for (const [other, density] of links[node]) {
			addiere(matrix, row, row, density);
			const column = rowOf.get(other);
			if (column === undefined) {
				for (let axis = 0; axis < 3; axis++) rhs[axis][row] += density * positions[other][axis];
			} else if (column < row) addiere(matrix, row, column, -density);
		}
	}
	return { matrix, rhs };
}

/** Solves the three equilibrium equations in metres with fixed grip positions and nodal loads in kN. */
export function balanceNet(
	positions: Vec3[],
	pinned: boolean[],
	links: number[][][],
	loads: Vec3[]
): void {
	const free = positions.map((_, i) => i).filter((i) => !pinned[i]);
	const { matrix, rhs } = assemble(free, positions, links, loads);
	const factor = zerlege(matrix);
	if (!factor.ok) throw RangeError('Fabric grips do not restrain the yarn network');
	for (const [axis, load] of rhs.entries()) {
		const solved = factor.loese(load);
		for (const [row, node] of free.entries()) {
			if (!Number.isFinite(solved[row]))
				throw RangeError('Fabric equilibrium exceeds the numeric range');
			positions[node][axis] = solved[row];
		}
	}
}
