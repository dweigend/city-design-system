import { distance, measurePolygon, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { ringMean, type Candidate, type Node } from './carrier';
import { planEdgeId } from './edge-path';
import { shorelineMorphLimits as limits } from './config';

type Clearance = (x: number, y: number) => number;
type Vertex = { node: Node; neighbors: Set<string>; boundary: Set<string>; fade: number };

function network(cells: readonly Candidate[], clearance: Clearance) {
	const vertices = new Map<string, Vertex>();
	const edges = new Map<string, boolean>();
	for (const cell of cells) {
		const dry = clearance(...ringMean(cell.corners)) >= 0;
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
			const key = planEdgeId(node.id, next.id);
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
	const dx = clearance(x + limits.gradientProbeM, y) - clearance(x - limits.gradientProbeM, y);
	const dy = clearance(x, y + limits.gradientProbeM) - clearance(x, y - limits.gradientProbeM);
	const length = Math.hypot(dx, dy);
	if (length < 2 * limits.gradientProbeM * limits.minimumGradientRatio || !Number.isFinite(length))
		return;
	return [dx / length, dy / length] as const;
}

function onShore(point: Vec2, clearance: Clearance): Vec2 | undefined {
	let [x, y] = point;
	for (let i = 0; i < limits.projectionPassCount; i++) {
		const residual = clearance(x, y) - limits.bankAllowanceM;
		if (Math.abs(residual) < limits.projectionToleranceM) return [x, y];
		const n = normal([x, y], clearance);
		if (!n || Math.abs(residual) > limits.maximumMoveM) return;
		x -= n[0] * residual;
		y -= n[1] * residual;
	}
	if (Math.abs(clearance(x, y) - limits.bankAllowanceM) < limits.projectionFallbackToleranceM)
		return [x, y];
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
			[...boundary].sort().reduce((sum, key) => {
				const [x, y] = required(vertices.get(key), 'shore rail neighbor').node.xy;
				return sum - (x - xy[0]) * n[1] + (y - xy[1]) * n[0];
			}, 0) / boundary.size;
		const offset = limits.tangentRelaxationRatio * tangent;
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
	const reach = limits.minimumWaterWidthM;
	const probe = (depth: number) =>
		clearance(
			point[0] - (limits.bankAllowanceM + depth) * n[0],
			point[1] - (limits.bankAllowanceM + depth) * n[1]
		);
	return probe(reach * 0.5) <= -reach * limits.widthProbeDepthRatio && probe(reach) < 0;
}

function relax(vertices: ReadonlyMap<string, Vertex>, fixed: ReadonlyMap<string, Vec2>) {
	const movable = [...vertices].flatMap(([id, { fade, neighbors }]) =>
		!fixed.has(id) && fade ? [{ id, fade, neighbors: [...neighbors].sort() }] : []
	);
	let field = new Map(fixed);
	for (let pass = 0; pass < limits.diffusionPassCount; pass++) {
		const next = new Map(fixed);
		for (const { id, fade, neighbors } of movable) {
			let x = 0;
			let y = 0;
			for (const other of neighbors) {
				const delta = field.get(other);
				if (!delta) continue;
				x += delta[0];
				y += delta[1];
			}
			const weight = (limits.diffusionRetentionRatio * fade) / neighbors.length;
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

function cellBounds({ corners }: Candidate) {
	const points = corners.map(({ xy }) => xy);
	const edges = points.map((point, i) => distance(point, points[(i + 1) % points.length]));
	return {
		corners,
		minimumAngle: Math.min(limits.minimumAngleRad, minimumAngle(points)),
		maximumRatio: Math.max(limits.maximumEdgeRatio, Math.max(...edges) / Math.min(...edges)),
		area: measurePolygon(points).area
	};
}

function fitsCell(
	{ corners, area, minimumAngle: angle, maximumRatio }: ReturnType<typeof cellBounds>,
	point: (node: Node) => Vec2,
	inside: (ring: readonly Vec2[]) => boolean
) {
	const points = corners.map(point);
	if (points.every((p, i) => p === corners[i].xy)) return true;
	const lengths = points.map((p, i) => distance(p, points[(i + 1) % points.length]));
	const ratio = measurePolygon(points).area / area;
	return (
		ratio >= limits.minimumAreaRatio &&
		ratio <= limits.maximumAreaRatio &&
		minimumAngle(points) >= angle - limits.guardAngleToleranceRad &&
		Math.max(...lengths) <= maximumRatio * Math.min(...lengths) + limits.guardEdgeToleranceM &&
		inside(points)
	);
}

function limitDisplacement(
	cells: readonly Candidate[],
	inside: (ring: readonly Vec2[]) => boolean,
	field: ReadonlyMap<string, Vec2>,
	anchors: ReadonlyMap<string, Vec2>
) {
	const bounds = cells
		.filter(({ corners }) => corners.some(({ id }) => field.has(id)))
		.map(cellBounds);
	const scale = new Map<string, number>();
	const point = ({ id, xy }: Node): Vec2 => {
		const delta = field.get(id);
		const factor = scale.get(id) ?? 1;
		return delta && factor ? [xy[0] + factor * delta[0], xy[1] + factor * delta[1]] : xy;
	};
	for (let pass = 0; ; pass++) {
		const rejected = new Set<string>();
		for (const cell of bounds) {
			if (fitsCell(cell, point, inside)) continue;
			for (const { id } of cell.corners) if (field.has(id)) rejected.add(id);
		}
		if (!rejected.size) break;
		for (const id of rejected)
			scale.set(
				id,
				pass < limits.guardPassCount ? (scale.get(id) ?? 1) * limits.guardRetentionRatio : 0
			);
	}

	// A rejected cell initially shortens every incident displacement. Recover bank
	// motion one node at a time where the neighboring cells can now accommodate it.
	const incident = new Map<string, ReturnType<typeof cellBounds>[]>();
	for (const cell of bounds) {
		for (const { id } of cell.corners) {
			if (!anchors.has(id) || !scale.has(id)) continue;
			const list = incident.get(id) ?? [];
			list.push(cell);
			incident.set(id, list);
		}
	}
	for (const id of [...incident.keys()].sort()) {
		const local = required(incident.get(id), 'anchor incident cells');
		let low = required(scale.get(id), 'shortened anchor scale');
		let high = 1;
		for (let pass = 0; pass < limits.anchorRecoveryPassCount; pass++) {
			const proposal = pass === 0 ? high : (low + high) / 2;
			scale.set(id, proposal);
			if (local.every((cell) => fitsCell(cell, point, inside))) low = proposal;
			else high = proposal;
			if (low === 1) break;
		}
		scale.set(id, low);
	}
	return point;
}

/** Moves the same topological carrier toward its flowing and standing shorelines. */
export function alignShore(
	cells: readonly Candidate[],
	clearance: Clearance,
	inside: (ring: readonly Vec2[]) => boolean
): readonly Candidate[] {
	const vertices = network(cells, clearance);
	const fixed = anchors(vertices, clearance);
	const field = relax(vertices, fixed);
	const point = limitDisplacement(cells, inside, field, fixed);
	const nodes = new Map([...vertices].map(([id, { node }]) => [id, { id, xy: point(node) }]));
	return cells.map(({ id, corners }) => ({
		id,
		corners: corners.map((node) => required(nodes.get(node.id), 'morphed corner'))
	}));
}
