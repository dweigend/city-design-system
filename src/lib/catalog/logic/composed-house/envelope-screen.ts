import { footprint as planFootprint, plotCovers } from './parcel-footprint';
import type { Vec3 } from '../parametrik/types';
import type { Body } from '../house-typology';
import { houseObject, type StockPart } from './house-object';
import type { Surface } from './surfaces';

type XY = [number, number];
type Mesh = Extract<StockPart, { kind: 'mesh' }>;
function panelEdges(stock: Mesh) {
	const edges = new Map<string, [number, number]>();
	for (let i = 0; i < stock.triangles.length; i += 3) {
		const face = stock.triangles.slice(i, i + 3);
		for (const [k, a] of face.entries()) {
			const b = face[(k + 1) % 3];
			const key = [Math.min(a, b), Math.max(a, b)].join('/');
			if (!edges.delete(key)) edges.set(key, [a, b]);
		}
	}
	return [...edges.values()];
}
function panel(mesh: Mesh, a: XY, b: XY, body: Body, stock: Mesh) {
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		length = Math.hypot(dx, dy);
	if (length < 0.4) return;
	const edges = panelEdges(stock);
	const bays = Math.ceil(length / 4);
	for (let i = 0; i < bays; i++) {
		const start = mesh.points.length;
		for (const outer of [true, false])
			mesh.points.push(
				...stock.points.map(([relief, along, up]): Vec3 => {
					const distance = (i + along / 3 + 0.5) / bays;
					return [
						a[0] + dx * distance + (dy * (outer ? relief : 0)) / length,
						a[1] + dy * distance - (dx * (outer ? relief : 0)) / length,
						body.position[2] + 0.18 + (up / 3) * (body.size[2] - 0.36)
					];
				})
			);
		const n = stock.points.length;
		for (const [u, v] of edges)
			mesh.triangles.push(
				start + u,
				start + u + n,
				start + v + n,
				start + u,
				start + v + n,
				start + v
			);
		mesh.triangles.push(...stock.triangles.map((index) => start + index));
	}
}

/** Fits the catalogued facade panel to each surveyed edge above the podium. */
export function envelopeScreen(body: Body, surface: Surface): StockPart[] {
	const { skin, footprint } = body.band ?? {};
	if (!footprint || !skin || skin === 'plain') return [];
	const id = body.id + '/screen';
	const stock = houseObject('envelope-panel', skin, body.seed, {
		instanceId: id,
		slots: { body: surface }
	}).parts[0];
	if (stock.kind !== 'mesh') throw new Error('Expected an envelope panel mesh');
	return (body.band?.lining ?? footprint.polygon).flatMap((a, i, ring) => {
		const mesh: Mesh = {
			...stock,
			id: body.id + '/face/' + i + '/screen',
			points: [],
			triangles: []
		};
		panel(mesh, a, ring[(i + 1) % ring.length], body, stock);
		if (!mesh.points.length) return [];
		const cells = body.band?.cells;
		return !cells || plotCovers(cells, planFootprint(mesh), 0) ? [mesh] : [];
	});
}
