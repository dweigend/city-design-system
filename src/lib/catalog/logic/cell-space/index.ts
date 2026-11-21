import { validateRing } from './geometry';
import { orientCell } from './shell';
import type { CellSpace, CellSpaceInput, FaceRing, FaceUse } from './types';

export type { CellFace, CellPoint, CellSpace, CellSpaceInput } from './types';

function byId<T extends { id: string }>(items: readonly T[]) {
	const indexed = new Map<string, T>();
	for (const item of items) {
		if (!item.id || indexed.has(item.id))
			throw new RangeError('Invalid or duplicate ID ' + item.id);
		indexed.set(item.id, item);
	}
	return indexed;
}

function read<T>(items: ReadonlyMap<string, T>, id: string): T {
	const item = items.get(id);
	if (item === undefined) throw new RangeError('Unknown ID ' + id);
	return item;
}

function validateFaces(
	faces: readonly FaceRing[],
	ring: (face: FaceRing) => Parameters<typeof validateRing>[0]
) {
	const rings = new Set<string>();
	for (const face of faces) {
		if (face.nodeIds.length < 3 || new Set(face.nodeIds).size !== face.nodeIds.length)
			throw new RangeError('Invalid face ring ' + face.id);
		const key = JSON.stringify([...face.nodeIds].sort());
		if (rings.has(key)) throw new RangeError('Duplicate face ring ' + face.id);
		rings.add(key);
		validateRing(ring(face), face.id);
	}
}

function compareId(a: { id: string }, b: { id: string }) {
	return a.id < b.id ? -1 : Number(a.id > b.id);
}

/**
 * Creates a detached cell space in world metres (XY ground, Z up).
 * IDs are emitted in lexical order and rings keep their supplied winding.
 * Throws RangeError for invalid rings, incidence, open shells or degenerate volumes.
 */
export function createCellSpace(input: CellSpaceInput): CellSpace {
	const nodes = [...input.nodes].sort(compareId);
	const faces = [...input.faces].sort(compareId);
	const shells = [...input.cells].sort(compareId);
	const nodesById = byId(nodes);
	const facesById = byId(faces);
	byId(shells);
	for (const node of nodes) {
		if (node.position.length !== 3 || !node.position.every(Number.isFinite))
			throw new RangeError('Invalid node position ' + node.id);
	}
	const ring = (face: FaceRing) => face.nodeIds.map((id) => read(nodesById, id).position);
	validateFaces(faces, ring);
	const usesByFace = new Map<string, FaceUse[]>(faces.map(({ id }) => [id, []]));
	const cells = shells.map((cell) => {
		const faceIds = [...cell.faceIds].sort();
		if (faceIds.length < 4 || new Set(faceIds).size !== faceIds.length)
			throw new RangeError('Invalid cell shell ' + cell.id);
		const { uses, volumeM3 } = orientCell(
			cell,
			faceIds.map((id) => read(facesById, id)),
			ring
		);
		for (const { faceId, use } of uses) read(usesByFace, faceId).push(use);
		return { id: cell.id, faceIds, volumeM3 };
	});
	return {
		nodes: nodes.map(({ id, position }) => ({ id, position: [...position] })),
		faces: faces.map(({ id, nodeIds }) => {
			const uses = read(usesByFace, id);
			if (!uses.length || uses.length > 2 || uses[0].direction === uses[1]?.direction)
				throw new RangeError('Invalid face incidence ' + id);
			return { id, nodeIds: [...nodeIds], uses };
		}),
		cells
	};
}
