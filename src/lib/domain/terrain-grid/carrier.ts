import type { Vec2 } from '../../core/geometry';
import type { Random } from '../../core/random';
import { axes, type Site } from './site';

export type Quad<T> = readonly [T, T, T, T];
export type Node = Readonly<{ id: string; xy: Vec2 }>;
type Triangle<T> = readonly [T, T, T];
type Address = readonly [column: number, row: number, half: number];

export function edgeId(a: string, b: string) {
	return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function average(points: readonly Node[], id: string): Node {
	const [x, y] = points.reduce(([x, y], { xy }) => [x + xy[0], y + xy[1]], [0, 0]);
	return { id, xy: [x / points.length, y / points.length] };
}

function* split(face: readonly Node[]) {
	const id = `face/${face
		.map(({ id }) => id)
		.sort()
		.join('/')}`;
	const center = average(face, `${id}/center`);
	const edges = face.map((a, index) => {
		const b = face[(index + 1) % face.length];
		return average([a, b], `edge/${edgeId(a.id, b.id)}`);
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

function baseNodes(random: Random, site: Site, bearing: number, spacing: number) {
	const { toWorld } = axes(bearing);
	const offsets = new Map<string, Vec2>();
	const nodes = new Map<string, Node>();
	function offset(column: number, row: number) {
		const key = `${column},${row}`;
		const cached = offsets.get(key);
		if (cached) return cached;
		const local = random.derive(`offset/${key}`);
		const bounds = { min: -0.1, max: 0.1 };
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
		const adjacent = [
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
			[0, 0]
		);
		const [u, v] = toWorld(
			(column + row * 0.5 + 0.76 * x + 0.04 * dx) * spacing,
			((row * Math.sqrt(3)) / 2 + 0.76 * y + 0.04 * dy) * spacing * 0.94
		);
		const node: Node = { id, xy: [site.origin[0] + u, site.origin[1] + v] };
		nodes.set(id, node);
		return node;
	};
}

function neighbor([column, row, half]: Address, side: number): Address {
	if (side === 0) return [column, row + (half ? 1 : -1), 1 - half];
	if (side === 2) return [column + (half ? 1 : -1), row, 1 - half];
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
		const rank = random.derive(`pair/${edgeId(from.id, to.id)}`).number();
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
	random: Random
) {
	const spacing = size * 2.25;
	const { toLocal } = axes(bearing);
	const axial = outline.map(([x, y]) => {
		const [u, v] = toLocal(x - site.origin[0], y - site.origin[1]);
		const row = v / (((spacing * Math.sqrt(3)) / 2) * 0.94);
		return [u / spacing - row * 0.5, row];
	});
	const columns = axial.map(([column]) => column);
	const rows = axial.map(([, row]) => row);
	const node = baseNodes(random, site, bearing, spacing);
	// A halo covers displaced vertices and every possible partner outside the requested cells.
	for (
		let row = Math.floor(Math.min(...rows)) - 2;
		row <= Math.ceil(Math.max(...rows)) + 2;
		row++
	) {
		for (
			let column = Math.floor(Math.min(...columns)) - 2;
			column <= Math.ceil(Math.max(...columns)) + 2;
			column++
		) {
			for (const half of [0, 1]) {
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
