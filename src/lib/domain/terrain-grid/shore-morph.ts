import { distance, measurePolygon, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { edgeId, type Candidate, type Node } from './carrier';
import { quality } from './metrics';

type Clearance = (x: number, y: number) => number;
type Vertex = { node: Node; neighbors: Set<string>; boundary: Set<string>; fade: number };

/** Shore morph distances in meters and minimum and maximum retained cell area ratios. */
export const shorelineMorphLimits = Object.freeze({
	bandM: 145,
	minimumWaterWidthM: 42,
	bankToleranceM: 8,
	bankAllowanceM: 1.8,
	maximumMoveM: 48,
	minimumAreaRatio: 0.52,
	maximumAreaRatio: 1.62
});
const limits = shorelineMorphLimits;
const gradientProbeM = 4;

function center({ corners }: Candidate): Vec2 {
	return corners.reduce<Vec2>(
		([x, y], { xy: [a, b] }) => [x + a / corners.length, y + b / corners.length],
		[0, 0]
	);
}

function network(cells: readonly Candidate[], clearance: Clearance) {
	const vertices = new Map<string, Vertex>();
	const edges = new Map<string, boolean>();
	for (const cell of cells) {
		const dry = clearance(...center(cell)) >= 0;
		for (const [i, node] of cell.corners.entries()) {
			const next = cell.corners[(i + 1) % cell.corners.length];
			for (const end of [node, next]) {
				if (vertices.has(end.id)) continue;
				const t = Math.max(0, 1 - Math.abs(clearance(...end.xy)) / limits.bandM);
				vertices.set(end.id, {
					node: end,
					neighbors: new Set(),
					boundary: new Set(),
					fade: t * t * (3 - 2 * t)
				});
			}
			const a = required(vertices.get(node.id), 'shore node');
			const b = required(vertices.get(next.id), 'shore neighbor');
			a.neighbors.add(next.id);
			b.neighbors.add(node.id);
			const key = edgeId(node.id, next.id);
			const preceding = edges.get(key);
			if (preceding !== undefined && preceding !== dry) {
				a.boundary.add(next.id);
				b.boundary.add(node.id);
			}
			edges.set(key, dry);
		}
	}
	return vertices;
}

function normal([x, y]: Vec2, clearance: Clearance) {
	const dx = clearance(x + gradientProbeM, y) - clearance(x - gradientProbeM, y);
	const dy = clearance(x, y + gradientProbeM) - clearance(x, y - gradientProbeM);
	const length = Math.hypot(dx, dy);
	if (length < gradientProbeM * 0.7 || !Number.isFinite(length)) return;
	return [dx / length, dy / length] as const;
}

function onShore(point: Vec2, clearance: Clearance): Vec2 | undefined {
	let [x, y] = point;
	for (let i = 0; i < 5; i++) {
		const residual = clearance(x, y) - limits.bankAllowanceM;
		if (Math.abs(residual) < 0.08) return [x, y];
		const n = normal([x, y], clearance);
		if (!n || Math.abs(residual) > limits.maximumMoveM) return;
		x -= n[0] * residual;
		y -= n[1] * residual;
	}
	if (Math.abs(clearance(x, y) - limits.bankAllowanceM) < 0.5) return [x, y];
}

function anchors(vertices: ReadonlyMap<string, Vertex>, clearance: Clearance) {
	const result = new Map<string, Vec2>();
	for (const {
		node: { id, xy },
		boundary,
		fade
	} of vertices.values()) {
		if (!boundary.size || boundary.size > 2 || !fade) continue;
		const n = normal(xy, clearance);
		if (!n) continue;
		// Redistribute the rail tangentially before projecting. A stair turn otherwise
		// sends neighboring nodes to almost the same point on the shore.
		const tangent =
			[...boundary].reduce((sum, key) => {
				const [x, y] = required(vertices.get(key), 'shore rail neighbor').node.xy;
				return sum - (x - xy[0]) * n[1] + (y - xy[1]) * n[0];
			}, 0) / boundary.size;
		const offset = 0.36 * tangent;
		const target = onShore([xy[0] - offset * n[1], xy[1] + offset * n[0]], clearance);
		if (!target || distance(xy, target) > limits.maximumMoveM || !wideEnough(target, clearance))
			continue;
		result.set(id, [target[0] - xy[0], target[1] - xy[1]]);
	}
	return result;
}

function wideEnough(point: Vec2, clearance: Clearance) {
	const n = normal(point, clearance);
	if (!n) return false;
	const reach = limits.minimumWaterWidthM + 4;
	const probe = (depth: number) => clearance(point[0] - depth * n[0], point[1] - depth * n[1]);
	return probe(reach * 0.5) <= -reach * 0.33 && probe(reach) < 0;
}

function relax(vertices: ReadonlyMap<string, Vertex>, fixed: ReadonlyMap<string, Vec2>) {
	let field = new Map(fixed);
	for (let pass = 0; pass < 9; pass++) {
		const next = new Map(fixed);
		for (const [id, { fade, neighbors }] of vertices) {
			if (fixed.has(id) || !fade) continue;
			let x = 0;
			let y = 0;
			for (const other of neighbors) {
				const delta = field.get(other);
				if (!delta) continue;
				x += delta[0];
				y += delta[1];
			}
			const weight = (0.92 * fade) / neighbors.size;
			if (x || y) next.set(id, [x * weight, y * weight]);
		}
		field = next;
	}
	return field;
}

function minimumAngle(points: readonly Vec2[]) {
	return Math.min(
		...points.map(([x, y], i) => {
			const [a, b] = points[(i + 1) % points.length];
			const [u, v] = points[(i + points.length - 1) % points.length];
			return Math.atan2(
				(a - x) * (v - y) - (b - y) * (u - x),
				(a - x) * (u - x) + (b - y) * (v - y)
			);
		})
	);
}

function safeCells(
	cells: readonly Candidate[],
	inside: (ring: readonly Vec2[]) => boolean,
	field: ReadonlyMap<string, Vec2>
) {
	const bounds = cells
		.map(({ corners }) => {
			const points = corners.map(({ xy }) => xy);
			const edges = points.map((point, i) => distance(point, points[(i + 1) % points.length]));
			return {
				corners,
				minimumAngle: Math.min(quality.minimumAngle, minimumAngle(points)),
				maximumRatio: Math.max(quality.maximumEdgeRatio, Math.max(...edges) / Math.min(...edges)),
				area: measurePolygon(points).area
			};
		})
		.filter(({ corners }) => corners.some(({ id }) => field.has(id)));
	const scale = new Map<string, number>();
	const point = ({ id, xy }: Node): Vec2 => {
		const delta = field.get(id);
		const factor = scale.get(id) ?? 1;
		return delta && factor ? [xy[0] + factor * delta[0], xy[1] + factor * delta[1]] : xy;
	};
	for (let pass = 0; ; pass++) {
		const rejected = new Set<string>();
		for (const { corners, area, minimumAngle: angle, maximumRatio } of bounds) {
			const points = corners.map(point);
			if (points.every((p, i) => p === corners[i].xy)) continue;
			const lengths = points.map((p, i) => distance(p, points[(i + 1) % points.length]));
			const ratio = measurePolygon(points).area / area;
			if (
				ratio >= limits.minimumAreaRatio &&
				ratio <= limits.maximumAreaRatio &&
				minimumAngle(points) >= angle - 1e-10 &&
				Math.max(...lengths) <= maximumRatio * Math.min(...lengths) + 1e-9 &&
				inside(points)
			)
				continue;
			for (const { id } of corners) if (field.has(id)) rejected.add(id);
		}
		if (!rejected.size) return point;
		for (const id of rejected) scale.set(id, pass < 7 ? (scale.get(id) ?? 1) * 0.6 : 0);
	}
}

/** Moves the same topological carrier toward its flowing and standing shorelines. */
export function alignShore(
	cells: readonly Candidate[],
	clearance: Clearance,
	inside: (ring: readonly Vec2[]) => boolean
): readonly Candidate[] {
	const vertices = network(cells, clearance);
	const field = relax(vertices, anchors(vertices, clearance));
	const point = safeCells(cells, inside, field);
	const nodes = new Map([...vertices].map(([id, { node }]) => [id, { id, xy: point(node) }]));
	return cells.map(({ id, corners }) => ({
		id,
		corners: corners.map((node) => required(nodes.get(node.id), 'morphed corner'))
	}));
}
