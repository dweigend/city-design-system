/**
 * Grids of the Bible, headless: the same seed on all nine block grids (welt/netze.ts, read only).
 * `rasterVorschau` returns the plan views of the grid strip, `rasterSchichten` the five layers
 * of the main simulation (blocks → cells → quads → corners; the city comes from `welt`).
 * Units: meters in the plane, y to the north. Pure functions of seed and sliders.
 */
import { netz, rasterarten, type RasterId } from '../parametrik/welt/netze';
import { lage, type LageParams } from '../parametrik/welt/lage';
import type { Point2 } from '../parametrik/vocab';
import { muss } from './muss';

export type RasterVorschau = {
	id: RasterId;
	name: string;
	regel: string;
	viewBox: string;
	/** SVG path of all pre-cells (hairline). */
	zellen: string;
	/** SVG path of all blocks (block edge). */
	bloecke: string;
};

const pfad = (polygone: Point2[][]) =>
	polygone
		.map(
			(p) =>
				p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${(-y).toFixed(2)}`).join('') + 'Z'
		)
		.join('');

/** Plan view of a grid: a small district (3 blocks per side), without distortion. */
export function rasterBild(id: RasterId, seed = 45): RasterVorschau {
	const art = muss(
		rasterarten.find((r) => r.id === id),
		`Grid ${id}`
	);
	const n = netz({ raster: id, seed, groesse: 3, mass: 1, verzug: 0 });
	const punkte = n.makros.flatMap((m) => m.polygon);
	const xs = punkte.map((p) => p[0]),
		ys = punkte.map((p) => -p[1]);
	const w = Math.max(...xs) - Math.min(...xs),
		h = Math.max(...ys) - Math.min(...ys),
		rand = Math.max(w, h) * 0.06,
		s = Math.max(w, h) + 2 * rand;
	// Square crop around the center: all previews the same size.
	const x0 = (Math.min(...xs) + Math.max(...xs)) / 2 - s / 2,
		y0 = (Math.min(...ys) + Math.max(...ys)) / 2 - s / 2;
	return {
		id,
		name: art.name,
		regel: art.regel,
		viewBox: `${x0.toFixed(1)} ${y0.toFixed(1)} ${s.toFixed(1)} ${s.toFixed(1)}`,
		zellen: pfad(n.grid.cells.map((c) => c.polygon)),
		bloecke: pfad(n.makros.map((m) => m.polygon))
	};
}

/** All nine grids in order from strict to organic. */
export const rasterReihe = (seed = 45): RasterVorschau[] =>
	rasterarten.map((r) => rasterBild(r.id, seed));

export type RasterSchichten = {
	/** Block outlines: their edges are the alleys. */
	bloecke: Point2[][];
	/** Pre-cells: equal division per block edge. */
	zellen: Point2[][];
	/** Quads of the patch (after relaxation). */
	vierecke: Point2[][];
	/** Corners where building is possible (inside a block). */
	bauecken: Point2[];
	/** Remaining corners: alleys and boundary. */
	gassenecken: Point2[];
	/** Half the edge length of the district in meters. */
	extent: number;
};

/** The four grid layers of a district; the same positions on which `welt` builds the city. */
export function rasterSchichten(p: LageParams): RasterSchichten {
	const n = netz(p),
		l = lage(p);
	const punkt = (id: string) => muss(l.point.get(id), `corner ${id}`);
	const bauecken: Point2[] = [],
		gassenecken: Point2[] = [];
	for (const v of l.patch.vertices) (l.blockOf.has(v.id) ? bauecken : gassenecken).push(v.point);
	return {
		bloecke: n.makros.map((m) => m.polygon),
		zellen: n.grid.cells.map((c) => c.polygon),
		vierecke: l.patch.faces.map((f) => f.vertices.map(punkt)),
		bauecken,
		gassenecken,
		extent: l.extent
	};
}
