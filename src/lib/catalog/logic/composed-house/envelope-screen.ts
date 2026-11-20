import type { Vec3 } from '../parametrik/types';
import { finishMaterial } from '../material/surface';
import type { Body } from '../house-typology';
import type { StockPart } from './house-object';
import type { Surface } from './surfaces';

type XY = [number, number];
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
function panel(mesh: Mesh, a: XY, b: XY, body: Body, mode: string) {
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		length = Math.hypot(dx, dy);
	if (length < 0.4) return;
	const bays = Math.max(1, Math.ceil(length / 4));
	for (let i = 0; i < bays; i++) {
		const at: Vertex = (u, v, relief = 0.025) => [
			a[0] + (dx * (i + u)) / bays + (dy * relief) / length,
			a[1] + (dy * (i + u)) / bays - (dx * relief) / length,
			body.position[2] + 0.18 + v * (body.size[2] - 0.36)
		];
		const width = Math.min(0.12, (0.13 * bays) / length);
		if (mode === 'woven') {
			strip(mesh, at, 0, 1 - width, width);
			strip(mesh, at, 1 - width, 0, width);
		} else if (mode === 'framed') frame(mesh, at, width);
		else cushion(mesh, at);
	}
}

/** Builds a continuous outer screen from the surveyed ring, leaving the stair and courts open. */
export function envelopeScreen(body: Body, stock: StockPart, surface: Surface): StockPart[] {
	const { skin, footprint } = body.band ?? {};
	if (!footprint || !skin || skin === 'plain') return [];
	const mesh: Mesh = { points: [], triangles: [], lines: [] };
	footprint.polygon.forEach((a, i, ring) =>
		panel(mesh, a, ring[(i + 1) % ring.length], body, skin)
	);
	return mesh.points.length
		? [
				{
					id: body.id + '/screen',
					kind: 'mesh',
					...mesh,
					source: stock.source,
					role: stock.role,
					...surface,
					material: finishMaterial(surface.finish),
					glass: skin === 'cushioned',
					edges: false
				}
			]
		: [];
}
