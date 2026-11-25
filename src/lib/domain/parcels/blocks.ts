import { encodeKey } from '../../core/ref';
import { isSimpleRing, measurePolygon, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { readFaceUnionBoundary } from '../../core/topology';
import { planEdgeId } from '../terrain-grid';
import { realizeHoldings } from './holdings';
import { frontageContacts, frontageFrame, reserveLanes } from './reserve';
import type { LaneInput, ParcelPlanInput } from './types';

export function prepareBlocks(input: ParcelPlanInput, lanes: ReadonlyMap<string, LaneInput>) {
	const vertices = new Map(
		input.grid.vertices.map(({ id, position: [x, y] }) => [id, Object.freeze([x, y] as const)])
	);
	const point = (id: string): Vec2 => required(vertices.get(id), 'block corner');
	const cells = new Map(
		input.grid.cells.map(({ id, vertexIds }) => {
			const outline = vertexIds.map(point);
			if (!isSimpleRing(outline)) throw new RangeError('Block ' + id + ' must form a simple ring');
			return [id, measurePolygon(outline).area >= 0 ? vertexIds : [...vertexIds].reverse()];
		})
	);
	const byCell = new Map<string, BlockSeed>();

	const canJoin = (from: string, to: string) =>
		!lanes.get(planEdgeId(from, to))?.protectedFromMerge;

	function prepare(members: readonly string[], plannedKind: string) {
		const faces = members.map((id) => ({ id, vertexIds: required(cells.get(id), 'block member') }));
		const nodeIds = readFaceUnionBoundary(faces, canJoin);
		if (!nodeIds) return;
		const outline = Object.freeze(nodeIds.map(point));
		if (members.length > 1 && !isSimpleRing(outline)) return;
		const frontage = nodeIds.flatMap((from, sideIndex) => {
			const to = nodeIds[(sideIndex + 1) % nodeIds.length];
			const lane = lanes.get(planEdgeId(from, to));
			return lane ? [frontageFrame(lane, point(from), point(to), sideIndex)] : [];
		});
		return {
			id: encodeKey(members),
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
	const reserves = new Map<string, ReturnType<typeof createBlock>>();
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
		{ id, memberCellIds, plannedKind, nodeIds, outline, laneIds, frontage }: BlockSeed,
		reserve: ReturnType<typeof reserveLanes>
	) {
		const reserved = { id, memberCellIds, plannedKind, nodeIds, outline, laneIds, ...reserve };
		const rule = required(input.holdingRules[plannedKind], 'holding rule');
		const { block, parcels, portals } = realizeHoldings(reserved, frontage, rule, input.tolerance);
		return { block: Object.freeze({ ...reserved, ...block }), parcels, portals };
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
