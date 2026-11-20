import { footprint as planFootprint, plotCovers } from './parcel-footprint';
import type { Vec3 } from '../parametrik/types';
import type { Body } from '../house-typology';
import { houseObject, type StockPart } from './house-object';
import type { Surface } from './surfaces';

type XY = [number, number];
type Mesh = Extract<StockPart, { kind: 'mesh' }>;
function panel(mesh: Mesh, a: XY, b: XY, body: Body, stock: Mesh) {
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		length = Math.hypot(dx, dy);
	if (length < 0.4) return;
	const bays = Math.ceil(length / 4);
	for (let i = 0; i < bays; i++) {
		const start = mesh.points.length;
		mesh.points.push(
			...stock.points.map(([relief, along, up]): Vec3 => {
				const distance = (i + along / 3 + 0.5) / bays;
				return [
					a[0] + dx * distance + (dy * relief) / length,
					a[1] + dy * distance - (dx * relief) / length,
					body.position[2] + 0.18 + (up / 3) * (body.size[2] - 0.36)
				];
			})
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
	return footprint.polygon.flatMap((a, i, ring) => {
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
