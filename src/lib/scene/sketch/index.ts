/** Module: Draws drawables as a small isometric sketch of flat polygons for interface specimens. */
import type { Vec3 } from '../../core/geometry';
import { shapeArrays } from '../stage';
import type { Drawable } from '../surface';

/** One sketched polygon: SVG points, the drawable's colour token and which side it faces. */
export type SketchFace = Readonly<{
	points: string;
	tone: `--${string}`;
	shade: 'top' | 'lit' | 'shadow';
}>;

/** A sketch fitted to its own view box. */
export type Sketch = Readonly<{ viewBox: string; faces: readonly SketchFace[] }>;

// Exact arithmetic: the isometric axes, cos 30° and sin 30°, and the view direction (1, 1, 1).
const cos30 = Math.sqrt(/* Exact arithmetic: cosine of thirty degrees. */ 3) / 2;
const sin30 = 1 / 2;

function screen([x, y, z]: Vec3): [number, number] {
	return [(x - y) * cos30, (x + y) * sin30 - z];
}

function facing([nx, ny, nz]: Vec3): SketchFace['shade'] | undefined {
	if (nx + ny + nz <= 0) return undefined;
	if (nz > Math.abs(nx) && nz > Math.abs(ny)) return 'top';
	return nx >= ny ? 'lit' : 'shadow';
}

function normal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
	const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
	const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
	return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}

/** How a sketch is fitted and written: the margin as a share of the drawing's larger side and the
 * decimals kept in SVG coordinates. */
export type SketchOptions = Readonly<{ marginRatio: number; decimals: number }>;

/** Sketches the filled drawables seen from the isometric viewpoint (1, 1, 1): back faces are
 * dropped and the rest are painted far to near. Line-only drawables are skipped. The view box
 * fits the drawing with the given margin. */
export function projectSketch(
	drawables: readonly Drawable[],
	{ marginRatio, decimals }: SketchOptions
): Sketch {
	const triangles: { depth: number; face: SketchFace; xy: [number, number][] }[] = [];
	for (const { shape, color, finish, fillVisible } of drawables) {
		if (finish === 'line' || fillVisible === false) continue;
		const { positions, indices } = shapeArrays(shape);
		const point = (index: number): Vec3 => [
			positions[3 * index],
			positions[3 * index + 1],
			positions[3 * index + 2]
		];
		for (let i = 0; i < indices.length; i += 3) {
			const corners = [point(indices[i]), point(indices[i + 1]), point(indices[i + 2])];
			const shade = facing(normal(corners[0], corners[1], corners[2]));
			if (!shade) continue;
			const xy = corners.map(screen);
			const depth = corners.reduce((sum, [x, y, z]) => sum + x + y + z, 0);
			triangles.push({ depth, xy, face: { points: '', tone: color, shade } });
		}
	}
	triangles.sort((a, b) => a.depth - b.depth);
	const all = triangles.flatMap(({ xy }) => xy);
	if (!all.length) return { viewBox: '0 0 1 1', faces: [] };
	const xs = all.map(([x]) => x);
	const ys = all.map(([, y]) => y);
	const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
	const [width, height] = [Math.max(...xs) - minX, Math.max(...ys) - minY];
	const margin = Math.max(width, height) * marginRatio;
	const fixed = (value: number) => value.toFixed(decimals);
	return {
		viewBox: [minX - margin, minY - margin, width + 2 * margin, height + 2 * margin]
			.map(fixed)
			.join(' '),
		faces: triangles.map(({ xy, face }) => ({
			...face,
			points: xy.map(([x, y]) => `${fixed(x)},${fixed(y)}`).join(' ')
		}))
	};
}
