import type { Vec3 } from '../parametrik/types';
import { inside, onSegment } from '../parametrik/raster/universal/kern';
import { supportedNodes } from './graph';
import type { Access, Grip, HouseStructure, Parcel, Platform, StructureNode, XY } from './contract';

/**
 * Height in metres within which a bearer, an access foot or an access head meets its datum.
 * Datums are built by adding storey heights below 1e3 m, so 1e-6 m covers their rounding.
 */
const LEVEL_TOLERANCE = 1e-6;

export type StructureRule =
	| 'duplicate-id'
	| 'unknown-reference'
	| 'degenerate-rod'
	| 'no-load-path'
	| 'open-skin'
	| 'loose-grip'
	| 'unborne-platform'
	| 'unreached-platform'
	| 'access-off-datum'
	| 'outside-parcel';

/** One broken invariant and the id of the element that breaks it. */
export type StructureFinding = { rule: StructureRule; subject: string };

type Report = (rule: StructureRule, subject: string) => void;
type Index = {
	nodes: Map<string, StructureNode>;
	supported: Set<string>;
	platforms: Map<string, Platform>;
};

function within(parcel: Parcel, [x, y]: XY | Vec3) {
	const p: XY = [x, y];
	const onRing = (ring: XY[]) => ring.some((a, i) => onSegment(p, a, ring[(i + 1) % ring.length]));
	if (onRing(parcel.polygon)) return true;
	return (
		inside(p, parcel.polygon) && parcel.holes.every((hole) => onRing(hole) || !inside(p, hole))
	);
}

function checkIds(s: HouseStructure, report: Report) {
	const seen = new Set<string>();
	for (const { id } of [...s.nodes, ...s.rods, ...s.platforms, ...s.skins, ...s.access]) {
		if (seen.has(id)) report('duplicate-id', id);
		seen.add(id);
	}
}

function checkFrame(s: HouseStructure, index: Index, report: Report) {
	for (const node of s.nodes) {
		if (!index.supported.has(node.id)) report('no-load-path', node.id);
		if (!within(s.parcel, node.position)) report('outside-parcel', node.id);
	}
	for (const rod of s.rods) {
		const from = index.nodes.get(rod.from),
			to = index.nodes.get(rod.to);
		if (!from || !to) report('unknown-reference', rod.id);
		else if (!(rod.radius > 0) || from.position.every((v, k) => v === to.position[k]))
			report('degenerate-rod', rod.id);
	}
}

function gripState(s: HouseStructure, index: Index, grip: Grip) {
	if ('node' in grip) {
		if (!index.nodes.has(grip.node)) return 'unknown';
		return index.supported.has(grip.node) ? 'held' : 'loose';
	}
	const rod = s.rods.find((r) => r.id === grip.rod);
	if (!rod || !(grip.at >= 0 && grip.at <= 1)) return 'unknown';
	return index.supported.has(rod.from) && index.supported.has(rod.to) ? 'held' : 'loose';
}

function checkSkins(s: HouseStructure, index: Index, report: Report) {
	for (const skin of s.skins) {
		if (skin.boundary.length < 3 || (skin.edges && skin.edges.length !== skin.boundary.length))
			report('open-skin', skin.id);
		for (const grip of [...skin.boundary, ...(skin.interior ?? [])]) {
			const state = gripState(s, index, grip);
			if (state === 'unknown') report('unknown-reference', skin.id);
			if (state === 'loose') report('loose-grip', skin.id);
		}
	}
}

function isBorne(platform: Platform, node: StructureNode | undefined, index: Index) {
	if (!node || !index.supported.has(node.id)) return false;
	const depth = platform.datum - node.position[2];
	return depth >= -LEVEL_TOLERANCE && depth <= platform.thickness + LEVEL_TOLERANCE;
}

function checkPlatforms(s: HouseStructure, index: Index, report: Report) {
	for (const platform of s.platforms) {
		const bearers = platform.bearers.map((id) => index.nodes.get(id));
		if (bearers.some((node) => !node)) report('unknown-reference', platform.id);
		if (!bearers.some((node) => isBorne(platform, node, index)))
			report('unborne-platform', platform.id);
		const rings = [platform.outline, ...(platform.holes ?? [])];
		if (platform.outline.length < 3 || !rings.flat().every((p) => within(s.parcel, p)))
			report('outside-parcel', platform.id);
	}
}

function reached(s: HouseStructure) {
	const visited = new Set<string>();
	for (let grown = true; grown;) {
		grown = false;
		for (const way of s.access) {
			if (visited.has(way.to) || (way.from !== undefined && !visited.has(way.from))) continue;
			visited.add(way.to);
			grown = true;
		}
	}
	return visited;
}

function meets(point: Vec3, level: number) {
	return Math.abs(point[2] - level) <= LEVEL_TOLERANCE;
}

function checkRun(s: HouseStructure, index: Index, way: Access, report: Report) {
	const start = way.from === undefined ? { datum: s.ground } : index.platforms.get(way.from),
		end = index.platforms.get(way.to);
	if (!start || !end) return report('unknown-reference', way.id);
	if (!meets(way.foot, start.datum) || !meets(way.head, end.datum))
		report('access-off-datum', way.id);
	if (![way.foot, way.head].every((point) => within(s.parcel, point)))
		report('outside-parcel', way.id);
}

function checkAccess(s: HouseStructure, index: Index, report: Report) {
	for (const way of s.access) checkRun(s, index, way, report);
	const visited = reached(s);
	for (const platform of s.platforms)
		if (!visited.has(platform.id)) report('unreached-platform', platform.id);
}

function checkRoof(s: HouseStructure, index: Index, report: Report) {
	if (!s.roof) return;
	const known =
		s.roof.kind === 'skin'
			? s.roof.patches.every((id) => s.skins.some((skin) => skin.id === id))
			: index.platforms.has(s.roof.platform);
	if (!known) report('unknown-reference', s.id + '/roof');
}

/**
 * Checks one house against the shared invariants and returns every breach in a stable order:
 * ids, frame, skins, platforms, access, roof. An empty list means the house is buildable.
 *
 * - Every node has a load path to a founded node; a tie carries only a node hanging below it.
 * - Every skin is a closed loop of at least three grips, each on supported structure.
 * - Every platform rests on a supported bearer within its plate depth and is reached from the
 *   ground through an access chain whose feet and heads meet their datums.
 * - Nodes, platform outlines and access ends lie inside the parcel or on its boundary, clear of
 *   its courts.
 *
 * Does not mutate the input and does not throw on malformed references; it reports them.
 */
export function checkHouseStructure(structure: HouseStructure): StructureFinding[] {
	const findings: StructureFinding[] = [];
	const report: Report = (rule, subject) => findings.push({ rule, subject });
	const index: Index = {
		nodes: new Map(structure.nodes.map((node) => [node.id, node])),
		supported: supportedNodes(structure),
		platforms: new Map(structure.platforms.map((platform) => [platform.id, platform]))
	};
	checkIds(structure, report);
	checkFrame(structure, index, report);
	checkSkins(structure, index, report);
	checkPlatforms(structure, index, report);
	checkAccess(structure, index, report);
	checkRoof(structure, index, report);
	return findings;
}
