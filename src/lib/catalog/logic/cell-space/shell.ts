import { signedFaceVolume, volumeTolerance } from './geometry';
import type { CellPoint, CellShell, FaceRing, FaceUse } from './types';

type Direction = FaceUse['direction'];
type EdgeUse = { faceId: string; direction: Direction };
type Ring = (face: FaceRing) => readonly CellPoint[];

function shellEdges(faces: readonly FaceRing[]) {
	const edges = new Map<string, EdgeUse[]>();
	for (const face of faces) {
		face.nodeIds.forEach((a, index) => {
			const b = face.nodeIds[(index + 1) % face.nodeIds.length];
			const key = JSON.stringify(a < b ? [a, b] : [b, a]);
			const use: EdgeUse = { faceId: face.id, direction: a < b ? 1 : -1 };
			const current = edges.get(key);
			if (current) current.push(use);
			else edges.set(key, [use]);
		});
	}
	return edges;
}

function neighbors(faces: readonly FaceRing[], cellId: string) {
	const byFace = new Map<string, EdgeUse[]>(faces.map(({ id }) => [id, []]));
	for (const [first, second, ...others] of shellEdges(faces).values()) {
		if (!second || others.length) throw new RangeError('Open or nonmanifold cell ' + cellId);
		const direction = first.direction === second.direction ? -1 : 1;
		byFace.get(first.faceId)?.push({ faceId: second.faceId, direction });
		byFace.get(second.faceId)?.push({ faceId: first.faceId, direction });
	}
	return byFace;
}

function shellDirections(faces: readonly FaceRing[], cellId: string) {
	const adjacency = neighbors(faces, cellId);
	const directions = new Map<string, Direction>([[faces[0].id, 1]]);
	// Map iteration visits appended neighbors and stops when the connected component is exhausted.
	for (const [id, sign] of directions) {
		for (const edge of adjacency.get(id) ?? []) {
			const direction = sign === edge.direction ? 1 : -1;
			const known = directions.get(edge.faceId);
			if (known === undefined) directions.set(edge.faceId, direction);
			else if (known !== direction) throw new RangeError('Nonorientable cell ' + cellId);
		}
	}
	if (directions.size !== faces.length) throw new RangeError('Disconnected cell ' + cellId);
	return directions;
}

export function orientCell(cell: CellShell, faces: readonly FaceRing[], ring: Ring) {
	const signs = shellDirections(faces, cell.id);
	const points = faces.flatMap(ring);
	const signedVolume = faces.reduce(
		(sum, face) => sum + (signs.get(face.id) ?? 1) * signedFaceVolume(ring(face), points[0]),
		0
	);
	const volumeM3 = Math.abs(signedVolume);
	if (!Number.isFinite(volumeM3) || volumeM3 <= volumeTolerance(points))
		throw new RangeError('Degenerate cell ' + cell.id);
	return {
		volumeM3,
		uses: faces.map(({ id }) => {
			const direction: Direction = (signs.get(id) === 1) === signedVolume > 0 ? 1 : -1;
			return { faceId: id, use: { cellId: cell.id, direction } };
		})
	};
}
