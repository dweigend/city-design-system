import type { Vec2 } from '../../core/geometry';
import type { Random } from '../../core/random';
import { axes, type Site } from './site';

export type Quad<T> = readonly [T, T, T, T];

export type Node = Readonly<{ id: string; xy: Vec2 }>;

export function edgeId(a: string, b: string) {
	return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function addresses(column: number, row: number): Quad<string> {
	return [
		`${column},${row}`,
		`${column + 1},${row}`,
		`${column + 1},${row + 1}`,
		`${column},${row + 1}`
	];
}

function center(points: readonly Node[], id: string): Node {
	const [x, y] = points.reduce(([x, y], { xy }) => [x + xy[0], y + xy[1]], [0, 0]);
	return { id, xy: [x / points.length, y / points.length] };
}

function split(face: readonly Node[], id: string): Quad<Node>[] {
	const middle = center(face, `${id}/center`);
	const edges = face.map((a, index) => {
		const b = face[(index + 1) % face.length];
		return center([a, b], `edge/${edgeId(a.id, b.id)}`);
	});
	return face.map((corner, index) => [
		corner,
		edges[index],
		middle,
		edges[(index + face.length - 1) % face.length]
	]);
}

// A fixed neighbourhood smooths the seeded offsets before subdivision. No crop edge is a pin.
function baseNodes(random: Random, site: Site, bearing: number, along: number, across: number) {
	const { toWorld } = axes(bearing);
	const offsets = new Map<string, Vec2>();
	const nodes = new Map<string, Node>();
	function offset(id: string) {
		const cached = offsets.get(id);
		if (cached) return cached;
		const local = random.derive(`base/${id}`);
		const bounds = { min: -0.19, max: 0.19 };
		const result: Vec2 = [local.number(bounds), local.number(bounds)];
		offsets.set(id, result);
		return result;
	}
	return (column: number, row: number): Node => {
		const id = `${column},${row}`;
		const cached = nodes.get(id);
		if (cached) return cached;
		const [x, y] = offset(id);
		const adjacent = [
			offset(`${column - 1},${row}`),
			offset(`${column + 1},${row}`),
			offset(`${column},${row - 1}`),
			offset(`${column},${row + 1}`)
		];
		const [dx, dy] = adjacent.reduce(([dx, dy], [u, v]) => [dx + u, dy + v], [0, 0]);
		const [u, v] = toWorld(
			(column + 0.78 * x + 0.055 * dx) * along,
			(row + 0.78 * y + 0.055 * dy) * across
		);
		const node: Node = { id: `base/${id}`, xy: [site.origin[0] + u, site.origin[1] + v] };
		nodes.set(id, node);
		return node;
	};
}

export function* carrier(site: Site, bearing: number, size: number, random: Random) {
	const along = size * 2.85;
	const across = size * 1.95;
	const angle = site.bearing - bearing;
	const c = Math.abs(Math.cos(angle));
	const s = Math.abs(Math.sin(angle));
	const columns = Math.ceil((c * site.length + s * site.width) / (2 * along)) + 1;
	const rows = Math.ceil((s * site.length + c * site.width) / (2 * across)) + 1;
	const node = baseNodes(random, site, bearing, along, across);
	for (let row = -rows; row < rows; row++) {
		for (let column = -columns; column < columns; column++) {
			const id = `face/${addresses(column, row).join('/')}`;
			const a = node(column, row);
			const b = node(column + 1, row);
			const c = node(column + 1, row + 1);
			const d = node(column, row + 1);
			const layout = random.derive(id).number();
			const faces =
				layout < 0.35
					? [
							[a, b, c],
							[a, c, d]
						]
					: layout < 0.7
						? [
								[a, b, d],
								[b, c, d]
							]
						: [[a, b, c, d]];
			for (const [face, ring] of faces.entries()) {
				const faceId = `${id}/split-${faces.length === 1 ? 'quad' : layout < 0.35 ? 'ac' : 'bd'}-${face}`;
				for (const [child, corners] of split(ring, faceId).entries()) {
					yield { id: `${faceId}/${child}`, corners };
				}
			}
		}
	}
}
