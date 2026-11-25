import { defaults } from '../../../config/terrain-grid';
import { distance, readVertexMean, type Vec2 } from '../../core/geometry';
import type { Random } from '../../core/random';
import { encodeKey } from '../../core/ref';
import { planEdgeId } from './edge-path';
import { axes, type Site } from './site';

type Quad<T> = readonly [T, T, T, T];
export type Node = Readonly<{
	id: string;
	xy: Vec2;
	shore?: Readonly<{ planEdgeId: string; t: number }>;
}>;
export type Candidate = Readonly<{ id: string; corners: readonly Node[] }>;
export type Carrier = (
	site: Site,
	outline: readonly Vec2[],
	bearing: number,
	size: number,
	random: Random
) => Iterable<Candidate>;
type Triangle<T> = readonly [T, T, T];
type Address = readonly [column: number, row: number, half: number];

export function ringMean(corners: readonly Node[]): Vec2 {
	return readVertexMean(
		corners.map(({ xy }) => xy),
		'before-sum'
	);
}

function average(points: readonly Node[], id: string): Node {
	return { id, xy: readVertexMean(points.map(({ xy }) => xy)) };
}

function faceCenter(points: readonly Node[], id: string): Node {
	if (points.length !== 3) return average(points, id);
	const weights = points.map((_point, i) =>
		distance(points[(i + 1) % 3].xy, points[(i + 2) % 3].xy)
	);
	const perimeter = weights.reduce((sum, weight) => sum + weight, 0);
	const xy: Vec2 = points.reduce<Vec2>(
		([x, y], { xy: [u, v] }, i) => [
			x + (u * weights[i]) / perimeter,
			y + (v * weights[i]) / perimeter
		],
		/* Exact arithmetic: initial sum of XY coordinates. */ [0, 0]
	);
	return { id, xy };
}

function* split(face: readonly Node[]) {
	const id = `face/${face
		.map(({ id }) => id)
		.sort()
		.join('/')}`;
	const center = faceCenter(face, `${id}/center`);
	const edges = face.map((a, index) => {
		const b = face[(index + 1) % face.length];
		return average([a, b], `edge/${planEdgeId(a.id, b.id)}`);
	});
	for (const [index, corner] of face.entries()) {
		const corners: Quad<Node> = [
			corner,
			edges[index],
			center,
			edges[(index + face.length - 1) % face.length]
		];
		yield { id: `${id}/split/${corner.id}`, corners };
	}
}

type Relaxation = Readonly<{ center: number; neighbor: number }>;
const organicRelaxation = {
	center: defaults.organicCenterWeight,
	neighbor: defaults.organicNeighborWeight
};

function baseNodes(
	random: Random,
	site: Site,
	bearing: number,
	spacing: number,
	relaxation: Relaxation
) {
	const { toWorld } = axes(bearing);
	const offsets = new Map<string, Vec2>();
	const nodes = new Map<string, Node>();
	function offset(column: number, row: number) {
		const key = encodeKey([column, row]);
		const cached = offsets.get(key);
		if (cached) return cached;
		const local = random.derive(`offset/${column},${row}`);
		const bounds = { min: -defaults.organicJitterRatio, max: defaults.organicJitterRatio };
		const result: Vec2 = [local.number(bounds), local.number(bounds)];
		offsets.set(key, result);
		return result;
	}
	return (column: number, row: number): Node => {
		const id = `base/${column},${row}`;
		const cached = nodes.get(id);
		if (cached) return cached;
		const [x, y] = offset(column, row);
		// A fixed relaxation stencil keeps displacements independent of the crop boundary.
		const adjacent = /* Exact arithmetic: six neighbors of a triangular lattice point. */ [
			[1, 0],
			[0, 1],
			[-1, 1],
			[-1, 0],
			[0, -1],
			[1, -1]
		];
		const [dx, dy] = adjacent.reduce(
			([dx, dy], [dc, dr]) => {
				const [u, v] = offset(column + dc, row + dr);
				return [dx + u, dy + v];
			},
			/* Exact arithmetic: initial sum of XY coordinates. */ [0, 0]
		);
		const [u, v] = toWorld(
			(column +
				row * /* Exact arithmetic: triangular rows alternate by half a lattice step. */ 0.5 +
				relaxation.center * x +
				relaxation.neighbor * dx) *
				spacing,
			((row * Math.sqrt(/* Exact arithmetic: equilateral triangle height factor. */ 3)) / 2 +
				relaxation.center * y +
				relaxation.neighbor * dy) *
				spacing *
				defaults.organicRowScaleRatio
		);
		const node: Node = { id, xy: [site.origin[0] + u, site.origin[1] + v] };
		nodes.set(id, node);
		return node;
	};
}

function neighbor([column, row, half]: Address, side: number): Address {
	if (side === 0) return [column, row + (half ? 1 : -1), 1 - half];
	if (side === /* Exact arithmetic: third side of the triangular cell. */ 2)
		return [column + (half ? 1 : -1), row, 1 - half];
	return [column, row, 1 - half];
}

function triangle(
	[column, row, half]: Address,
	node: ReturnType<typeof baseNodes>
): Triangle<Node> {
	return half
		? [node(column + 1, row + 1), node(column, row + 1), node(column + 1, row)]
		: [node(column, row), node(column + 1, row), node(column, row + 1)];
}

function favorite(ring: Triangle<Node>, random: Random) {
	let best = 0;
	let highest = -1;
	for (const [index, from] of ring.entries()) {
		const to = ring[(index + 1) % 3];
		const rank = random.derive(`pair/${planEdgeId(from.id, to.id)}`).number();
		if (rank > highest) {
			highest = rank;
			best = index;
		}
	}
	return best;
}

export function* carrier(
	site: Site,
	outline: readonly Vec2[],
	bearing: number,
	size: number,
	random: Random,
	relaxation: Relaxation = organicRelaxation
) {
	const spacing = size * defaults.organicSpacingRatio;
	const { toLocal } = axes(bearing);
	const axial = outline.map(([x, y]) => {
		const [u, v] = toLocal(x - site.origin[0], y - site.origin[1]);
		const row =
			v /
			(((spacing * Math.sqrt(/* Exact arithmetic: equilateral triangle height factor. */ 3)) / 2) *
				defaults.organicRowScaleRatio);
		return [
			u / spacing -
				row * /* Exact arithmetic: triangular rows alternate by half a lattice step. */ 0.5,
			row
		];
	});
	const columns = axial.map(([column]) => column);
	const rows = axial.map(([, row]) => row);
	const node = baseNodes(random, site, bearing, spacing, relaxation);
	// A halo covers displaced vertices and every possible partner outside the requested cells.
	for (
		let row = Math.floor(Math.min(...rows)) - defaults.organicPaddingCount;
		row <= Math.ceil(Math.max(...rows)) + defaults.organicPaddingCount;
		row++
	) {
		for (
			let column = Math.floor(Math.min(...columns)) - defaults.organicPaddingCount;
			column <= Math.ceil(Math.max(...columns)) + defaults.organicPaddingCount;
			column++
		) {
			for (const half of /* Exact arithmetic: two halves of a parent cell. */ [0, 1]) {
				const address: Address = [column, row, half];
				const ring = triangle(address, node);
				const side = favorite(ring, random);
				const pair = triangle(neighbor(address, side), node);
				if (favorite(pair, random) !== side) {
					yield* split(ring);
				} else if (half === 0) {
					yield* split([
						ring[side],
						pair[(side + 2) % 3],
						ring[(side + 1) % 3],
						ring[(side + 2) % 3]
					]);
				}
			}
		}
	}
}

export const freeQuad: Carrier = (site, outline, bearing, size, random) =>
	carrier(site, outline, bearing, size, random.derive('free-quad'), {
		center: /* Exact arithmetic: free-quad uses the center sample without neighbor averaging. */ 1,
		neighbor: /* Exact arithmetic: free-quad uses the center sample without neighbor averaging. */ 0
	});
