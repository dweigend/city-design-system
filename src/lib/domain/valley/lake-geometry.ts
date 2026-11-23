import type { Vec2 } from '../../core/geometry';
import { position, side } from './catchment-grid';
import type { solveDrainage } from './drainage';

/** A lake at its lowest sill, with world XY shoreline rings and triangles in meters. */
export type DrainageLake = Readonly<{
	id: number;
	level: number;
	sillElevation: number;
	area: number;
	depth: number;
	outlet: Vec2;
	downstream: number | null;
	rings: readonly (readonly Vec2[])[];
	vertices: readonly Vec2[];
	indices: readonly number[];
}>;

type Outline = ReturnType<typeof outline>;

function outline() {
	const vertices: Vec2[] = [];
	const ids = new Map<number, number>();
	const edges = new Map<number, number>();
	const indices: number[] = [];
	return {
		vertex(key: number, create: () => Vec2) {
			const found = ids.get(key);
			if (found !== undefined) return found;
			const i = vertices.length;
			vertices.push(Object.freeze(create()));
			ids.set(key, i);
			return i;
		},
		face(polygon: number[], shore: number[]) {
			for (let i = 1; i + 1 < polygon.length; i++)
				indices.push(polygon[0], polygon[i], polygon[i + 1]);
			if (shore.length === 2 && shore[0] !== shore[1]) edges.set(shore[0], shore[1]);
		},
		finish() {
			const rings: (readonly Vec2[])[] = [];
			for (const start of edges.keys()) {
				const ring = [];
				for (let i: number | undefined = start; i !== undefined;) {
					const next = edges.get(i);
					if (next === undefined) break;
					ring.push(vertices[i]);
					edges.delete(i);
					if (next === start) break;
					i = next;
				}
				if (ring.length > 2) rings.push(Object.freeze(ring));
			}
			return {
				vertices: Object.freeze(vertices),
				indices: Object.freeze(indices),
				rings: Object.freeze(rings)
			};
		}
	};
}

function clipTriangle(
	outline: Outline,
	triangle: readonly number[],
	bed: Int32Array,
	level: number
) {
	const polygon: number[] = [];
	const shore: number[] = [];
	for (let i = 0; i < triangle.length; i++) {
		const a = triangle[i];
		const b = triangle[(i + 1) % triangle.length];
		const wet = bed[a] < level;
		if (wet) polygon.push(outline.vertex(a, () => position(a)));
		if (wet === bed[b] < level) continue;
		const key =
			bed[a] === level
				? a
				: bed[b] === level
					? b
					: bed.length + Math.min(a, b) * bed.length + Math.max(a, b);
		const vertex = outline.vertex(key, () => {
			const [x, y] = position(a);
			const [u, v] = position(b);
			const t = (level - bed[a]) / (bed[b] - bed[a]);
			return [x + (u - x) * t, y + (v - y) * t];
		});
		polygon.push(vertex);
		if (wet) shore.unshift(vertex);
		else shore.push(vertex);
	}
	outline.face(polygon, shore);
}

export function lakeGeometry(
	{ bed, basins, membership, area }: ReturnType<typeof solveDrainage>,
	threshold: number
) {
	const outlines = basins.map(outline);
	const clip = (a: number, b: number, c: number) => {
		const id = Math.max(membership[a], membership[b], membership[c]);
		if (id >= 0) clipTriangle(outlines[id], [a, b, c], bed, basins[id].level);
	};
	for (let row = 0; row < side - 1; row++) {
		for (let a = row * side; a < row * side + side - 1; a++) {
			const c = a + side + 1;
			clip(a, a + 1, c);
			clip(a, c, c - 1);
		}
	}
	return Object.freeze(
		basins.map((basin, i): DrainageLake =>
			Object.freeze({
				id: -1 - i,
				level: basin.level / 1000,
				sillElevation: bed[basin.outlet] / 1000,
				area: basin.area,
				depth: basin.depth / 1000,
				outlet: Object.freeze(position(basin.outlet)),
				downstream: area[basin.outlet] >= threshold ? basin.outlet : null,
				...outlines[i].finish()
			})
		)
	);
}
