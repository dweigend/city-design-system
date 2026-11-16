/**
 * Demo "Universal grid": real grid generators and the real `toPatch` (iterations 0).
 * Every n-gon is split into n quads; result and quality come unchanged from the core.
 */
import { defaults, gridGenerators } from '../parametrik/raster';
import { organicGrid, toPatch, type UniversalGrid } from '../parametrik/raster/universal';
import { pfad } from './eck';

export const universalArten = [
	{ value: 'square', label: 'Square' },
	{ value: 'triangle', label: 'Triangle' },
	{ value: 'hex', label: 'Hexagon' },
	{ value: 'quad-irregular', label: 'Free quad' },
	{ value: 'polar', label: 'Polar' },
	{ value: 'voronoi', label: 'Voronoi' },
	{ value: 'organic', label: 'Organic' }
] as const;
export type UniversalArt = (typeof universalArten)[number]['value'];

export type UniversalBild = {
	zellen: string;
	quads: string;
	anzahlZellen: number;
	anzahlQuads: number;
	minWinkel: number;
	maxSeiten: number;
	ms: number;
	fehler?: string;
	box: [number, number, number, number];
};

export function rasterFuer(art: UniversalArt, saat: number): UniversalGrid {
	if (art === 'organic') return organicGrid({}, saat);
	const g = gridGenerators.find((x) => x.kind === art)!;
	return g.generate(defaults(g), saat);
}

export function universalBild(
	art: UniversalArt,
	saat: number,
	jetzt = () => performance.now()
): UniversalBild {
	const raster = rasterFuer(art, saat);
	const zellen = raster.cells.filter((c) => c.level === 0);
	const xs = zellen.flatMap((c) => c.polygon.map((p) => p[0])),
		ys = zellen.flatMap((c) => c.polygon.map((p) => p[1]));
	const box: [number, number, number, number] = [
		Math.min(...xs),
		Math.min(...ys),
		Math.max(...xs) - Math.min(...xs),
		Math.max(...ys) - Math.min(...ys)
	];
	const basis = {
		zellen: zellen.map((c) => pfad(c.polygon)).join(''),
		anzahlZellen: zellen.length,
		box
	};
	const t0 = jetzt();
	try {
		const patch = toPatch({ ...raster, cells: zellen }, { iterations: 0 });
		const ms = jetzt() - t0;
		const punkt = new Map(patch.vertices.map((v) => [v.id, v.point]));
		return {
			...basis,
			quads: patch.faces.map((f) => pfad(f.vertices.map((id) => punkt.get(id)!))).join(''),
			anzahlQuads: patch.faces.length,
			minWinkel: patch.quality.minAngle,
			maxSeiten: patch.quality.maxAspect,
			ms
		};
	} catch (cause) {
		return {
			...basis,
			quads: '',
			anzahlQuads: 0,
			minWinkel: 0,
			maxSeiten: 0,
			ms: jetzt() - t0,
			fehler: cause instanceof Error ? cause.message : String(cause)
		};
	}
}
