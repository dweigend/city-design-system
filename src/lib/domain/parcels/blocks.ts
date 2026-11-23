import { measurePolygon, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { planEdgeId } from '../terrain-grid';
import { frontageContacts, frontageFrame, reserveLanes } from './reserve';
import type { LaneInput, ParcelBlock, ParcelPlanInput } from './types';

function ringSides(ring: readonly string[]) {
	return ring.map((from, i) => {
		const to = ring[(i + 1) % ring.length];
		return { from, to, edgeId: planEdgeId(from, to) };
	});
}

function outerBoundary(
	rings: readonly (readonly string[])[],
	lanes: ReadonlyMap<string, LaneInput>
) {
	const edges = new Map<string, ReturnType<typeof ringSides>[number]>();
	let seams = 0;
	for (const ring of rings) {
		for (const side of ringSides(ring)) {
			const other = edges.get(side.edgeId);
			if (!other) edges.set(side.edgeId, side);
			else {
				if (other.from !== side.to || lanes.get(side.edgeId)?.protectedFromMerge) return;
				edges.delete(side.edgeId);
				seams++;
			}
		}
	}
	if (seams !== rings.length - 1) return;
	const from = new Map([...edges.values()].map((side) => [side.from, side]));
	if (from.size !== edges.size) return;
	const start = required([...from.keys()].sort()[0], 'block corner');
	const boundary = [];
	let node = start;
	while (boundary.length < from.size) {
		const side = from.get(node);
		if (!side) return;
		boundary.push(side);
		node = side.to;
		if (node === start) break;
	}
	return boundary.length === from.size && node === start ? boundary : undefined;
}

export function prepareBlocks(input: ParcelPlanInput, lanes: ReadonlyMap<string, LaneInput>) {
	const vertices = new Map(
		input.grid.vertices.map(({ id, position: [x, y] }) => [id, Object.freeze([x, y] as const)])
	);
	const point = (id: string): Vec2 => required(vertices.get(id), 'block corner');
	const cells = new Map(
		input.grid.cells.map(({ id, vertexIds }) => [
			id,
			measurePolygon(vertexIds.map(point)).area >= 0 ? vertexIds : [...vertexIds].reverse()
		])
	);
	const byCell = new Map<string, BlockSeed>();

	function prepare(members: readonly string[], plannedKind: string) {
		const rings = members.map((id) => required(cells.get(id), 'block member'));
		const boundary = outerBoundary(rings, lanes);
		if (!boundary) return;
		const nodeIds = Object.freeze(boundary.map(({ from }) => from));
		const outline = Object.freeze(nodeIds.map(point));
		const frontage = boundary.flatMap(({ edgeId, from, to }) => {
			const lane = lanes.get(edgeId);
			return lane ? [frontageFrame(lane, point(from), point(to))] : [];
		});
		return {
			id: JSON.stringify(members),
			memberCellIds: Object.freeze(members),
			plannedKind,
			nodeIds,
			outline,
			laneIds: Object.freeze(frontage.map(({ laneId }) => laneId)),
			frontage
		};
	}

	type BlockSeed = NonNullable<ReturnType<typeof prepare>>;
	const mergedUnits: BlockSeed[] = [];
	const reserves = new Map<string, ParcelBlock>();
	for (const { memberCellIds, plannedKind } of input.merges ?? []) {
		const members = [...memberCellIds].sort();
		if (members[0] === members[1] || members.some((id) => byCell.has(id))) continue;
		const block = prepare(members, plannedKind);
		if (!block) continue;
		const reserve = reserveLanes(block.outline, block.frontage, input.tolerance.linearToleranceM);
		const [net] = reserve.netGround;
		const { minimumFrontageM } = required(input.holdingRules[plannedKind], 'holding rule');
		if (reserve.netGround.length !== 1 || net.length !== 1) continue;
		if (
			!frontageContacts(net[0], block.frontage, input.tolerance.linearToleranceM).some(
				({ lengthM }) => lengthM >= minimumFrontageM
			)
		)
			continue;
		for (const id of members) byCell.set(id, block);
		mergedUnits.push(block);
		reserves.set(block.id, createBlock(block, reserve));
	}

	for (const id of [...cells.keys()].sort()) {
		if (byCell.has(id)) continue;
		const kind = required(input.plannedKinds[id], 'planned holding kind');
		byCell.set(id, required(prepare([id], kind), 'simple block boundary'));
	}

	function createBlock(
		{ id, memberCellIds, plannedKind, nodeIds, outline, laneIds }: BlockSeed,
		reserve: ReturnType<typeof reserveLanes>
	) {
		return Object.freeze({ id, memberCellIds, plannedKind, nodeIds, outline, laneIds, ...reserve });
	}

	function realize(block: BlockSeed) {
		const cached = reserves.get(block.id);
		if (cached) return cached;
		const value = createBlock(
			block,
			reserveLanes(block.outline, block.frontage, input.tolerance.linearToleranceM)
		);
		reserves.set(block.id, value);
		return value;
	}

	return { byCell, mergedUnits, point, realize };
}
