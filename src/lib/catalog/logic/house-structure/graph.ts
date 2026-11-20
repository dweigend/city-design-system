import type { Vec3 } from '../parametrik/types';
import { required } from '../required';
import type { Grip, HouseStructure, Rod, SkinEdge, StructureNode } from './contract';

/** Resolved input of a skin solver: world points of one patch and the rods behind them. */
export type SkinFrame = {
	boundary: Vec3[];
	edges: SkinEdge[];
	interior: Vec3[];
	/** Mean of the interior grips, or of the boundary without any: where gores meet. */
	peak: Vec3;
	/** Unit direction in which the structure leaves boundary grip i. Zero without a rod. */
	pull: Vec3[];
};

function nodesById(structure: HouseStructure) {
	return new Map(structure.nodes.map((node) => [node.id, node]));
}

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function mean(points: Vec3[]): Vec3 {
	const sum: Vec3 = [0, 0, 0];
	for (const p of points) for (const k of [0, 1, 2]) sum[k] += p[k] / points.length;
	return sum;
}

function unit(v: Vec3): Vec3 {
	const length = Math.hypot(...v);
	return length ? [v[0] / length, v[1] / length, v[2] / length] : [0, 0, 0];
}

function rodEnds(structure: HouseStructure, rod: Rod, nodes = nodesById(structure)) {
	return [
		required(nodes.get(rod.from), 'rod start ' + rod.from).position,
		required(nodes.get(rod.to), 'rod end ' + rod.to).position
	] as const;
}

/**
 * World position of a grip in metres. Throws when the grip names an unknown node or rod; run
 * `checkHouseStructure` first on untrusted input. The result is detached.
 */
function gripPoint(structure: HouseStructure, grip: Grip): Vec3 {
	if ('node' in grip) {
		const node = structure.nodes.find((n) => n.id === grip.node);
		return [...required(node, 'grip node ' + grip.node).position];
	}
	const rod = required(
		structure.rods.find((r) => r.id === grip.rod),
		'grip rod ' + grip.rod
	);
	const [from, to] = rodEnds(structure, rod);
	return mix(from, to, grip.at);
}

function pullAt(structure: HouseStructure, grip: Grip, nodes: Map<string, StructureNode>): Vec3 {
	if ('rod' in grip) {
		const rod = required(
			structure.rods.find((r) => r.id === grip.rod),
			'grip rod ' + grip.rod
		);
		const [from, to] = rodEnds(structure, rod, nodes);
		return unit([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
	}
	const here = required(nodes.get(grip.node), 'grip node ' + grip.node).position;
	const sum: Vec3 = [0, 0, 0];
	for (const rod of structure.rods) {
		if (rod.from !== grip.node && rod.to !== grip.node) continue;
		const far = required(nodes.get(rod.from === grip.node ? rod.to : rod.from), 'rod end');
		const away = unit([
			far.position[0] - here[0],
			far.position[1] - here[1],
			far.position[2] - here[2]
		]);
		for (const k of [0, 1, 2]) sum[k] += away[k];
	}
	return unit(sum);
}

/**
 * Resolves one skin patch to the world points a solver tensions cloth between. Boundary order
 * and edge order follow the patch. Throws on an unknown patch or grip. The result is detached.
 */
export function skinFrame(structure: HouseStructure, patchId: string): SkinFrame {
	const patch = required(
		structure.skins.find((s) => s.id === patchId),
		'skin patch ' + patchId
	);
	const nodes = nodesById(structure);
	const boundary = patch.boundary.map((grip) => gripPoint(structure, grip)),
		interior = (patch.interior ?? []).map((grip) => gripPoint(structure, grip));
	return {
		boundary,
		edges: patch.boundary.map((_, i) => patch.edges?.[i] ?? 'seam'),
		interior,
		peak: mean(interior.length ? interior : boundary),
		pull: patch.boundary.map((grip) => pullAt(structure, grip, nodes))
	};
}

function carries(rod: Rod, held: StructureNode, other: StructureNode) {
	// A tie only pulls: it holds a node that hangs below its supported end.
	return rod.action === 'strut' || other.position[2] > held.position[2];
}

/**
 * Ids of all nodes with a load path to the ground: founded nodes, nodes joined to a supported
 * node by struts, and nodes hung by a tie from a higher supported node.
 */
export function supportedNodes(structure: HouseStructure): Set<string> {
	const nodes = nodesById(structure);
	const supported = new Set(structure.nodes.filter((n) => n.founded).map((n) => n.id));
	for (let grown = true; grown;) {
		grown = false;
		for (const rod of structure.rods) {
			const from = nodes.get(rod.from),
				to = nodes.get(rod.to);
			if (!from || !to || supported.has(from.id) === supported.has(to.id)) continue;
			const [held, other] = supported.has(from.id) ? [to, from] : [from, to];
			if (!carries(rod, held, other)) continue;
			supported.add(held.id);
			grown = true;
		}
	}
	return supported;
}
