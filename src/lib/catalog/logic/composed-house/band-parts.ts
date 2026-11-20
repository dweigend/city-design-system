import { envelopeScreen } from './envelope-screen';
import { blockSkin } from '../house-typology';
import type { Body } from '../house-typology';
import { houseObject } from './house-object';
import { place } from './asset-fit';
import {
	shellSurface,
	roleSurface,
	type BandAccent,
	type HouseSurfaces,
	type Surface
} from './surfaces';

type XY = [number, number];
function kitCourses(b: Body, counts: Body['size'], paint: Surface, glass: Surface, trim: Surface) {
	const [nx, ny, nz] = counts;
	const [w, d, h] = b.nativeSize.map((v) => v * b.scale);
	const [x, y, z] = b.position,
		s = b.scale;
	return Array.from({ length: nx * ny * nz }, (_, i) => {
		const column = i % nx,
			row = Math.floor(i / nx) % ny,
			level = Math.floor(i / (nx * ny));
		const variants = ['plain', 'porthole-row', 'corner-window'];
		const variant =
			variants[(variants.indexOf(b.variant) + column + row + level) % variants.length];
		const stock = houseObject(b.objectId, variant, b.seed, {
			instanceId: b.id + '/' + b.objectId + '/' + i,
			slots: { body: paint, glass, trim }
		});
		return place(
			stock.parts,
			b.nativeCenter,
			[x + (column - (nx - 1) / 2) * w, y + (row - (ny - 1) / 2) * d, z + level * h],
			[s, s, s],
			0
		);
	}).flat();
}
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
export function bandParts(body: Body, surfaces: HouseSurfaces, accent: BandAccent) {
	const { id, objectId, variant, seed, band } = body;
	const [x, y, z] = body.position,
		[w, d, h] = body.size;
	const panel = surfaces[body.use];
	const wall = shellSurface(surfaces.shell, panel);
	const glass = surfaces.pane;
	const trim = roleSurface(panel, accent === 'none' ? 'frame' : 'fitting');
	const sill = trim;
	if (band?.modules) return kitCourses(body, band.modules, wall, glass, trim);
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
			polygon:
				band?.lining ?? band?.footprint?.polygon ?? ring(x, y, w - inset * 2, d - inset * 2, 0.45),
			holes: band?.footprint?.holes ?? holes
		};
	}
	if (band?.wellX !== undefined)
		return blockSkin(body, z).map((p) => {
			if (p.kind !== 'prism') throw Error('Expected a closed block');
			return {
				...course(
					p.id.slice(body.id.length + 1),
					0,
					p.height,
					0,
					p.id.includes('/window-')
						? glass
						: p.id.endsWith('/door')
							? trim
							: p.z === z
								? sill
								: wall
				),
				z: p.z,
				polygon: p.polygon,
				holes: p.holes
			};
		});
	const screen = envelopeScreen(body, roleSurface(wall, 'screen'));
	if (d < 1.6 || h < 1.5) return [...screen, course('body', 0, h, 0, wall)];
	const cuts = [0, h];
	for (let sill = 1; sill < h; sill += 4) {
		cuts.push(sill);
		if (sill + 1 < h) cuts.push(sill + 1);
	}
	cuts.sort((a, b) => a - b);
	return [
		...screen,
		...cuts.slice(1).map((end, i) => {
			const at = cuts[i],
				phase = ((at + end) / 2) % 4,
				window = phase >= 1 && phase < 2;
			return course(
				(window ? 'window' : i ? 'lintel' : 'sill') + '-' + i,
				at,
				end - at,
				window ? 0.35 : 0,
				window ? glass : wall
			);
		})
	];
}
