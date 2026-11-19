import type { Body } from '../house-typology';
import { houseObject } from './house-object';
import type { HouseSurfaces, Surface } from './surfaces';

type XY = [number, number];
function ring(x: number, y: number, w: number, d: number, r: number): XY[] {
	return Array.from({ length: 20 }, (_, i) => {
		const quadrant = Math.floor(i / 5),
			angle = ((quadrant + (i % 5) / 4) * Math.PI) / 2;
		return [
			x + (quadrant === 0 || quadrant === 3 ? 1 : -1) * (w / 2 - r) + r * Math.cos(angle),
			y + (quadrant < 2 ? 1 : -1) * (d / 2 - r) + r * Math.sin(angle)
		];
	});
}

/** Extrudes the band in closed courses around a recessed glazing strip and the surveyed court. */
export function bandParts(body: Body, surfaces: HouseSurfaces) {
	const { id, objectId, variant, seed, band } = body;
	const [x, y, z] = body.position,
		[w, d, h] = body.size;
	const finish = surfaces[band?.shell ? 'shell' : body.use];
	const court = band?.court;
	const holes = court
		? [ring(court.center[0], court.center[1], court.width, court.width, 0.15).reverse()]
		: undefined;
	function course(name: string, base: number, height: number, inset: number, surface: Surface) {
		const stock = houseObject(objectId, variant, seed, {
			instanceId: id + '/' + objectId + '/' + name,
			slots: { body: surface }
		}).parts[0];
		if (stock.kind !== 'prism') throw new Error('Expected a closed storey section');
		return {
			...stock,
			z: z + base,
			height,
			polygon: ring(x, y, w - inset * 2, d - inset * 2, 0.45),
			holes
		};
	}
	return [
		course('sill', 0, h - 1.35, 0, finish),
		course('window', h - 1.35, 0.6, 0.15, surfaces.pane),
		course('lintel', h - 0.75, 0.75, 0, surfaces[body.use])
	];
}
