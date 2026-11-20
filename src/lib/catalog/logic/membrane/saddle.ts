import type { Membrane } from './cloth';
import type { Vec3 } from '../parametrik/types';

const divisions = 16;
const side = divisions + 1;
const cache = new Map<string, ReturnType<typeof relax>>();

// Opposite corners share a stand-off. The raised hem opens a passage between ground ties.
function grip(u: number, v: number, width: number, height: number): Vec3 {
	const diagonal = (2 * u - 1) * (2 * v - 1);
	return [
		width * u,
		height * (0.09 * u + v * (1 - 0.18 * u)),
		Math.min(width, height) * 0.18 * diagonal
	];
}

function netGrid(width: number, height: number) {
	const positions: Vec3[] = [],
		pinned: boolean[] = [],
		faces: number[] = [];
	for (let j = 0; j < side; j++)
		for (let i = 0; i < side; i++) {
			positions.push(grip(i / divisions, j / divisions, width, height));
			pinned.push((i === 0 || i === divisions) && (j === 0 || j === divisions));
			const a = j * side + i;
			if (i < divisions && j < divisions)
				faces.push(a, a + 1, a + side + 1, a, a + side + 1, a + side);
		}
	return { positions, pinned, faces };
}

function neighbours(count: number, dx: number, dy: number, tension: number) {
	// Force density is tensile force divided by edge length. Boundary cables gather the free hems.
	const warp = (tension * dy) / dx,
		weft = (tension * dx) / dy;
	return Array.from({ length: count }, (_, k) => {
		const x = k % side,
			y = Math.floor(k / side);
		const qu = warp * (y === 0 || y === divisions ? 9 : 1),
			qv = weft * (x === 0 || x === divisions ? 9 : 1);
		return [
			[x > 0 ? k - 1 : -1, qu],
			[x < divisions ? k + 1 : -1, qu],
			[y > 0 ? k - side : -1, qv],
			[y < divisions ? k + side : -1, qv]
		].filter(([index]) => index >= 0);
	});
}

function balanceNode(positions: Vec3[], k: number, edges: number[][], sum: number, net: Vec3) {
	for (const [index, q] of edges)
		for (let axis = 0; axis < 3; axis++) net[axis] += q * positions[index][axis];
	for (let axis = 0; axis < 3; axis++)
		positions[k][axis] += 1.35 * (net[axis] / sum - positions[k][axis]);
}

function relax(width: number, height: number, fabric: Membrane) {
	const { positions, pinned, faces } = netGrid(width, height);
	const dx = width / divisions,
		dy = height / divisions;
	const links = neighbours(positions.length, dx, dy, fabric.tension);
	const sums = links.map((edges) => edges.reduce((q, [, w]) => q + w, 0));
	for (let step = 0; step < 180; step++) {
		for (let k = 0; k < positions.length; k++) {
			if (pinned[k]) continue;
			const net: Vec3 = [0, -0.014 * dx * dy, fabric.pressure * dx * dy];
			balanceNode(positions, k, links[k], sums[k], net);
		}
	}
	return {
		positions,
		faces,
		upperGrips: [positions[divisions * side], positions[side * side - 1]]
	};
}

/** Finds a four-grip anticlastic sail under warp, weft, edge-cable tension and distributed load. */
export function tensionNet(width: number, height: number, fabric: Membrane) {
	const key = [width, height, fabric.tension, fabric.pressure].join('/');
	const prior = cache.get(key);
	if (prior) return prior;
	const sheet = relax(width, height, fabric);
	if (cache.size >= 64) cache.clear();
	cache.set(key, sheet);
	return sheet;
}
