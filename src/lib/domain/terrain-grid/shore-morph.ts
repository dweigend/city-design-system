import { distance, measurePolygon, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { readVertexAdjacency, type PlanarVertex } from '../../core/topology';
import { ringMean, type Candidate, type Node } from './carrier';
import { shorelineMorphLimits as limits } from '../../../config/terrain-grid';

type Clearance = (x: number, y: number) => number;
type Vertex = PlanarVertex & { node: Node; fade: number };

function shoreVertices(cells: readonly Candidate[], clearance: Clearance) {
	const nodes = new Map<string, { node: Node; fade: number }>();
	const dry = new Map<string, boolean>();
	const faces = cells.map(({ id, corners }) => {
		dry.set(id, clearance(...ringMean(corners)) >= 0);
		const vertexIds = corners.map((node) => {
			if (!nodes.has(node.id)) {
				const t = Math.max(0, 1 - Math.abs(clearance(...node.xy)) / limits.bandM);
				const fade =
					t * t * /* Exact arithmetic: cubic Hermite interpolation coefficient. */ (3 - 2 * t);
				nodes.set(node.id, { node, fade });
			}
			return node.id;
		});
		return { id, vertexIds };
	});
	const adjacency = readVertexAdjacency(
		faces,
		(first, second) => second !== null && dry.get(first) !== dry.get(second)
	);
	return new Map(
		adjacency.map((vertex) => [
			vertex.id,
			{ ...vertex, ...required(nodes.get(vertex.id), 'shore node') }
		])
	);
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

function anchors(
	vertices: ReadonlyMap<string, Vertex>,
	clearance: Clearance,
	waterClearance: Clearance
) {
	const result = new Map<string, Vec2>();
	for (const {
		node: { id, xy },
		boundary,
		fade
	} of vertices.values()) {
		if (
			!boundary.length ||
			boundary.length >
				/* Exact arithmetic: a chain node has at most two boundary neighbors. */ 2 ||
			!fade
		)
			continue;
		const n = normal(xy, clearance);
		if (!n) continue;
		// Redistribute the rail tangentially before projecting. A stair turn otherwise
		// sends neighboring nodes to almost the same point on the shore.
		const tangent =
			[...boundary].sort().reduce((sum, key) => {
				const [x, y] = required(vertices.get(key), 'shore rail neighbor').node.xy;
				return sum - (x - xy[0]) * n[1] + (y - xy[1]) * n[0];
			}, 0) / boundary.length;
		const offset = limits.tangentRelaxationRatio * tangent;
		const target = onShore([xy[0] - offset * n[1], xy[1] + offset * n[0]], clearance);
		if (
			!target ||
			distance(xy, target) > limits.maximumMoveM ||
			!wideEnough(target, waterClearance)
		)
			continue;
		result.set(id, [target[0] - xy[0], target[1] - xy[1]]);
	}
	return result;
}

function wideEnough(point: Vec2, clearance: Clearance) {
	const n = normal(point, clearance);
	if (!n) return false;
	const bankDistance = clearance(...point);
	const reach = limits.minimumWaterWidthM;
	const probe = (depth: number) =>
		clearance(point[0] - (bankDistance + depth) * n[0], point[1] - (bankDistance + depth) * n[1]);
	if (!(probe(reach * 0.5) <= -reach * limits.widthProbeDepthRatio && probe(reach) < 0))
		return false;
	const steps = Math.ceil(reach / limits.clearanceSampleStepM);
	for (let step = 1; step < steps; step++) {
		if (probe((reach * step) / steps) >= 0) return false;
	}
	return true;
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
	inside: (ring: readonly Vec2[]) => boolean,
	waterClearance = clearance
): readonly Candidate[] {
	const vertices = shoreVertices(cells, clearance);
	const fixed = anchors(vertices, clearance, waterClearance);
	const field = relax(vertices, fixed);
	const point = limitDisplacement(cells, inside, field, fixed);
	const nodes = new Map([...vertices].map(([id, { node }]) => [id, { id, xy: point(node) }]));
	return cells.map(({ id, corners }) => ({
		id,
		corners: corners.map((node) => required(nodes.get(node.id), 'morphed corner'))
	}));
}
