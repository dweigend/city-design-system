import { createCellSpace, type CellPoint, type CellSpaceInput } from '../cell-space';
import type { Column, Vertex } from './envelope';
import { edgeId, type Subgrids } from './subgrid';

type Level = 'ground' | 'clearance' | 'half' | 'canopy';
export type Binding = Readonly<{
	groundId: string;
	coarseId: string;
	leafId: string;
	layer: 'lower' | 'upper';
}>;

export function volumeSpace(
	namespace: string,
	columns: Column[],
	clearance: number,
	subgrids?: Subgrids
) {
	const nodes = new Map<string, CellSpaceInput['nodes'][number]>();
	const faces = new Map<string, CellSpaceInput['faces'][number]>();
	const cells: CellSpaceInput['cells'][number][] = [];
	const bindings: Binding[] = [];

	function node(v: Vertex, level: Level) {
		const id = namespace + '/node/' + level + '/' + v.id;
		if (!nodes.has(id)) {
			const middle = v.ground + clearance;
			const z = {
				ground: v.ground,
				clearance: middle,
				half: (middle + v.canopy) / 2,
				canopy: v.canopy
			};
			const position: CellPoint = [v.x, v.y, z[level]];
			nodes.set(id, { id, position });
		}
		return id;
	}
	function face(key: string, nodeIds: string[]) {
		const id = namespace + '/face/' + key;
		if (!faces.has(id)) faces.set(id, { id, nodeIds });
		return id;
	}
	// Insert the same hanging edge vertices in every incident ring, including unrefined caps.
	function perimeter(ring: Vertex[]) {
		return ring.flatMap((a, i) => {
			const mid = subgrids?.midpoints.get(edgeId(a, ring[(i + 1) % ring.length]));
			return mid ? [a, mid] : [a];
		});
	}
	function cap(ring: Vertex[], level: Level) {
		return face(
			'cap/' +
				level +
				'/' +
				ring
					.map((v) => v.id)
					.sort()
					.join('|'),
			perimeter(ring).map((v) => node(v, level))
		);
	}
	function wall(a: Vertex, b: Vertex, bottom: Level, top: Level) {
		const fullUpper = bottom === 'clearance' && top === 'canopy';
		const ring = [node(a, bottom), node(b, bottom)];
		if (fullUpper && subgrids?.halfVertices.has(b.id)) ring.push(node(b, 'half'));
		ring.push(node(b, top), node(a, top));
		if (fullUpper && subgrids?.halfVertices.has(a.id)) ring.push(node(a, 'half'));
		return face('wall/' + bottom + '/' + top + '/' + edgeId(a, b), ring);
	}
	function walls(ring: Vertex[], bottom: Level, top: Level) {
		const boundary = perimeter(ring);
		return boundary.flatMap((a, i) => {
			const b = boundary[(i + 1) % boundary.length];
			if (bottom === 'clearance' && top === 'canopy' && subgrids?.halfEdges.has(edgeId(a, b)))
				return [wall(a, b, bottom, 'half'), wall(a, b, 'half', top)];
			return [wall(a, b, bottom, top)];
		});
	}
	for (const { id, groundId, ring } of columns) {
		const tiles = subgrids?.tiles.get(id);
		const lower = id + '/lower',
			upper = id + '/upper';
		const ceiling = tiles?.map((tile) => cap(tile.ring, 'clearance')) ?? [cap(ring, 'clearance')];
		cells.push({
			id: lower,
			faceIds: [cap(ring, 'ground'), ...ceiling, ...walls(ring, 'ground', 'clearance')]
		});
		bindings.push({ groundId, coarseId: lower, leafId: lower, layer: 'lower' });
		for (const tile of tiles ?? [{ ring, slot: '' }]) {
			const spans: [Level, Level][] = tiles
				? [
						['clearance', 'half'],
						['half', 'canopy']
					]
				: [['clearance', 'canopy']];
			for (const [bottom, top] of spans) {
				const leafId = tiles ? upper + '/corner-half/' + tile.slot + '/' + bottom : upper;
				cells.push({
					id: leafId,
					faceIds: [cap(tile.ring, bottom), cap(tile.ring, top), ...walls(tile.ring, bottom, top)]
				});
				bindings.push({ groundId, coarseId: upper, leafId, layer: 'upper' });
			}
		}
	}
	const space = createCellSpace({ nodes: [...nodes.values()], faces: [...faces.values()], cells });
	return { space, bindings };
}
