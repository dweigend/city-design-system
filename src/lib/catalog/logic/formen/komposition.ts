/**
 * Composition for the Forms page: rules place forms on a grid. Four rules from
 * logic/parametrik/komposition, plus "structural frame and plug-in module": every cell receives
 * a plug-in frame, the occupancy fills its bays. Headless, deterministic per seed.
 */
import { compose, compositionRules, placeholder } from '../parametrik/komposition';
import { formFamilies, formFamily } from '../parametrik/formen';
import { gridGenerators } from '../parametrik/raster';
import type { CompositionRule, FormFamily, FormGroup, Grid } from '../parametrik/vocab';
import type { Primitive } from '../parametrik/types';

export type RegelId = 'hof' | 'netz' | 'landmarke' | 'aufstockung' | 'geruest';
export const REGELN: RegelId[] = ['hof', 'aufstockung', 'netz', 'landmarke', 'geruest'];

const geruest: CompositionRule = {
	id: 'geruest',
	name: 'Structural frame and plug-in module',
	refs: [],
	pick: () => ({ form: 'rahmen-plugin' })
};

/** The free quad grid has 240 cells by default; with radius 1 it has 90, enough for a district. */
const RASTER_MASS: Record<string, Record<string, number>> = { 'quad-irregular': { count: 1 } };

/** Grids of the demo; "floors" is no ground plan, so it is left out. */
export const kompositionsRaster = gridGenerators.filter((g) => g.kind !== 'vertical');

export type KompositionWahl = {
	regel: RegelId;
	raster: string;
	/** Form group for the rules that choose freely; the structural frame brings its own form. */
	gruppe: FormGroup;
	/** Share of occupied bays in the structural frame, 0 … 1. */
	belegung: number;
	saat: number;
};

export const startKomposition: KompositionWahl = {
	regel: 'hof',
	raster: 'square',
	gruppe: 'klotz',
	belegung: 0.55,
	saat: 42
};

/** Groups that can stand on a cell as a building volume. */
export const KOERPER: FormGroup[] = ['klotz', 'zylinder', 'kapsel', 'bogen', 'ring', 'huelle'];

/** Forms and heights by rule; a pure function of the choice. */
export function komposition(w: KompositionWahl): Primitive[] {
	const raster = kompositionsRaster.find((g) => g.kind === w.raster) ?? kompositionsRaster[0];
	const grid = raster.generate(RASTER_MASS[raster.kind] ?? {}, w.saat);
	if (w.regel === 'geruest') {
		const plugin = formFamily('rahmen-plugin');
		if (!plugin) return [];
		const mitBelegung: FormFamily = {
			...plugin,
			params: plugin.params.map((p) => (p.key === 'belegung' ? { ...p, default: w.belegung } : p))
		};
		return compose(grid, [geruest], [mitBelegung], w.saat);
	}
	const regel = compositionRules.filter((r) => r.id === w.regel);
	const formen = formFamilies.filter((f) => f.group === w.gruppe);
	const landmarke = regel[0];
	if (w.regel === 'hof' && regel[0]) return mitHofgarten(grid, regel[0], formen, w.saat);
	if (w.regel !== 'landmarke' || !landmarke) return compose(grid, regel, formen, w.saat);
	// A landmark needs surroundings: all other cells stay low prisms.
	const umgebung: CompositionRule = {
		id: 'umgebung',
		name: 'Surroundings',
		refs: [],
		pick: (c, g, seed) => (landmarke.pick(c, g, seed) ? null : { form: '*', params: { height: 3 } })
	};
	return [
		...compose(grid, [umgebung], [placeholder], w.saat),
		...compose(grid, [landmarke], formen, w.saat)
	];
}

/** Courtyard: the edge is built up, every inner cell becomes garden (context rule courtyard garden). */
function mitHofgarten(
	grid: Grid,
	hof: CompositionRule,
	formen: FormFamily[],
	saat: number
): Primitive[] {
	const baum = formFamily('vegetation-kugelbaum');
	const garten: CompositionRule = {
		id: 'hofgarten',
		name: 'Courtyard garden',
		refs: [],
		pick: (c, g, seed) => (hof.pick(c, g, seed) ? null : { form: '*' })
	};
	return [
		...compose(grid, [hof], formen, saat),
		...(baum ? compose(grid, [garten], [baum], saat) : [])
	];
}
