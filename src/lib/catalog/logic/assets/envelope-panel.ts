import type { Vec3 } from '../parametrik/types';
import { mount, type AssetRecipe } from './definition';
import { surface } from './parts';
type Mesh = { points: Vec3[]; triangles: number[]; lines: number[][] };
type Vertex = (along: number, up: number, relief?: number) => Vec3;
function face(mesh: Mesh, points: Vec3[]) {
	const start = mesh.points.length;
	mesh.points.push(...points);
	for (let i = 1; i < points.length - 1; i++) mesh.triangles.push(start, start + i, start + i + 1);
}
function strip(mesh: Mesh, at: Vertex, lo: number, hi: number, thickness: number) {
	face(mesh, [at(lo, 0), at(lo + thickness, 0), at(hi + thickness, 1), at(hi, 1)]);
}
function frame(mesh: Mesh, at: Vertex, width: number) {
	strip(mesh, at, 0, 0, width);
	strip(mesh, at, 1 - width, 1 - width, width);
	for (const v of [0.12, 0.85]) face(mesh, [at(0, v), at(1, v), at(1, v + 0.04), at(0, v + 0.04)]);
}
function cushion(mesh: Mesh, at: Vertex) {
	const rim = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)];
	const peak = at(0.5, 0.5, 0.09);
	for (let i = 0; i < 4; i++) face(mesh, [rim[i], rim[(i + 1) % 4], peak]);
}

export const envelopePanel: AssetRecipe = {
	id: 'envelope-panel',
	category: 'facades',
	slotNames: ['body'],
	variants: ['woven', 'framed', 'cushioned'],
	anchors: [mount('facade')],
	footprint: [0.1, 3],
	draw(variant) {
		const mesh: Mesh = { points: [], triangles: [], lines: [] };
		const at: Vertex = (u, v, depth = 0.025) => [depth, (u - 0.5) * 3, v * 3];
		if (variant === 0) {
			strip(mesh, at, 0, 0.96, 0.04);
			strip(mesh, at, 0.96, 0, 0.04);
		} else if (variant === 1) frame(mesh, at, 0.04);
		else cushion(mesh, at);
		return [{ ...surface(), kind: 'mesh', ...mesh, glass: variant === 2, edges: false }];
	}
};
