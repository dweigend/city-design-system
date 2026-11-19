import { required } from '../required';
import { kern } from '../parametrik/raster/universal';
type Source = { id: string; ring: string[] };
type Joined = { id: string; ring: string[]; shared: string; chunk: kern.Chunk };

/** Remove the alley separating two triangular pockets when their union has a reentrant corner. */
export function concaveBlocks(sources: Iterable<Source>, intent: kern.Intent) {
	const result = new Map<string, Joined>(),
		sides = new Map<string, Source>();
	for (const face of sources) {
		if (face.ring.length !== 3) continue;
		for (let i = 0; i < 3; i++) {
			const a = face.ring[i],
				b = face.ring[(i + 1) % 3],
				key = kern.edgeId(a, b);
			const other = sides.get(key);
			sides.set(key, face);
			if (!other || result.has(other.id)) continue;
			const ring = [a, other.ring[(other.ring.indexOf(a) + 1) % 3], b, face.ring[(i + 2) % 3]];
			const points = ring.map((v) => required(intent.positions.get(v), 'alley junction'));
			if (!points.some((v, j) => kern.orient(v, points[(j + 1) % 4], points[(j + 2) % 4]) < 0))
				continue;
			const id = other.id + '+' + face.id;
			const chunk = kern.deriveChunk(intent, { id, ring, level: 0 });
			const block = { id, ring, chunk, shared: 'mid:' + key };
			result.set(face.id, block);
			result.set(other.id, block);
			break;
		}
	}
	return result;
}
