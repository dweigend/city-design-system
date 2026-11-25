import type { Vec3 } from '../../core/geometry';
import { columnRoof, type CityColumn } from '../../domain/city-volume';
import { createMovementNetwork, type MovementNode } from '../../domain/movement-network';
import type { columnClearance } from './clearance';
import { defaults } from '../../../config/city-movement';
import type { groundLanes } from './ground';
import type { CitySite } from '../city-site';
import type { stairSurvey } from './stairs';
import { link, raised, support, type Link } from './links';

type Ground = ReturnType<typeof groundLanes>;

function distance(a: Vec3, b: Vec3) {
	return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function roofsByVertex(columns: readonly CityColumn[], datumZ: number, levelHeightM: number) {
	const roofs = new Map<string, number>();
	for (const column of columns) {
		const top = columnRoof(column, datumZ, levelHeightM);
		for (const { id } of column.corners) roofs.set(id, Math.max(top, roofs.get(id) ?? -Infinity));
	}
	return roofs;
}

export function walkways(
	site: CitySite,
	ground: Ground,
	columns: readonly CityColumn[],
	datumZ: number,
	levelHeightM: number,
	offset: number,
	centers: readonly string[],
	stair: ReturnType<typeof stairSurvey>,
	clearColumns: ReturnType<typeof columnClearance>
) {
	const heads = centers.filter((id) => ground.nodes.has(id));
	const roofs = heads.length ? roofsByVertex(columns, datumZ, levelHeightM) : undefined;
	const roofAt = (id: string) => roofs?.get(id) ?? ground.node(id).position[2];
	const clearance = defaults.walkwayRoofClearanceM;
	const highEave = Math.max(datumZ, ...heads.map(roofAt));
	const level = Math.ceil((highEave + clearance - datumZ) / levelHeightM) + offset;
	const z = datumZ + level * levelHeightM;
	const nodes = new Map<string, MovementNode>();
	const links: Link[] = [];
	if (!heads.length) return { nodes, links, level, z };
	const segmentClear = clearColumns(z, clearance, defaults.walkwaySideClearanceM);
	const higher = (id: string) => raised(ground.node(id), level, z);
	const near = (id: string) =>
		heads.some(
			(head) =>
				distance(ground.node(id).position, ground.node(head).position) <= defaults.walkwayCatchmentM
		);
	const clear = (id: string) => {
		const [x, y] = ground.node(id).position;
		return (
			roofAt(id) + clearance <= z &&
			ground.clear.point([x, y]) &&
			site.sampleGround(x, y).waterKind === null
		);
	};
	function add(id: string, first: string, last: string, via?: readonly Vec3[]) {
		if (!clear(first) || !clear(last)) return;
		const a = higher(first);
		const b = higher(last);
		const points = [a.position, ...(via ?? []), b.position];
		if (points.slice(1).some((point, i) => !segmentClear(points[i], point))) return;
		nodes.set(first, a);
		nodes.set(last, b);
		links.push(
			link(id, 'walkway', a, b, via, [
				support(ground.node(first), a),
				support(ground.node(last), b)
			])
		);
	}
	for (const {
		id,
		nodeIds: [a, b],
		cellIds
	} of ground.edges) {
		if (cellIds.length > 1 && near(a) && near(b)) add('walkway/' + id, a, b);
	}
	for (const { first, last, bridge } of ground.crossings) {
		if (near(first) && near(last))
			add(
				'upper/' + bridge.id,
				first,
				last,
				bridge.via?.map(([x, y]) => [x, y, z])
			);
	}
	const islands = createMovementNetwork([...nodes.values()], links).readComponents();
	const accesses = new Set<string>();
	for (const id of new Set([...heads, ...nodes.keys()])) {
		const top = nodes.get(id);
		const component = top && islands.get(top.id);
		if (!top || !component || (accesses.has(component) && !heads.includes(id))) continue;
		const access = stair('stair/' + id, ground.node(id), top);
		if (!access) continue;
		links.push(access);
		accesses.add(component);
	}
	for (const [id, node] of nodes) {
		const component = islands.get(node.id);
		if (!component || !accesses.has(component)) nodes.delete(id);
	}
	const accessible = new Set([...nodes.values()].map(({ id }) => id));
	return {
		nodes,
		links: links.filter(({ nodeIds }) => nodeIds.some((id) => accessible.has(id))),
		level,
		z
	};
}
