/**
 * L11 · World, round 3 "District on existing stock": the world is an occupancy on a
 * quad patch from one of nine grid systems; all volumes, frames and paths come from the corner modules of L10.
 * Types and defaults only. Scale: docs/research/03-form-language.md.
 */
import type { Primitive, Vec3 } from '../types';
import type { Point2 } from '../vocab';
import type { RasterId } from './netze';

export type FarbcodeId = 'strom' | '45' | '36' | '43';
export type FokusId = 'alle' | 'netze' | 'volumen';

export type KernTeile = { netz: boolean; wege: boolean; zugang: boolean; feld: boolean };
export const KERN_AUS: KernTeile = Object.freeze({
	netz: false,
	wege: false,
	zugang: false,
	feld: false
});
export const KERN_AN: KernTeile = Object.freeze({
	netz: true,
	wege: true,
	zugang: true,
	feld: true
});
export type WeltParams = {
	kern: KernTeile;
	seed: number;
	/** Blocks per side (3–6); a block measures 4–6 build cells of 5 m each. */
	groesse: number;
	/** Share of interventions: gap towers, plug-in modules, rooftop extensions (0–1). */
	dichte: number;
	/** Floors of the towers and rooftop extensions (0–1). */
	hoehe: number;
	/** Sponge city: basins, gardens, farm floors (0–1). */
	schwamm: number;
	farbcode: FarbcodeId;
	fokus: FokusId;
	/** Grid system of the blocks, from strict to freely organic. */
	raster: RasterId;
	/** Block size as a factor (0.8–1.3). */
	mass: number;
	/** Distortion of the mesh (0–1): flow field over all block edges. */
	verzug: number;
	/** Relaxation of the mesh in steps (0–6). */
	relax: number;
};

export const weltDefaults: WeltParams = {
	kern: KERN_AUS,
	seed: 45,
	groesse: 4,
	dichte: 0.5,
	hoehe: 0.5,
	schwamm: 0.5,
	farbcode: 'strom',
	fokus: 'alle',
	raster: 'quadrat',
	mass: 1,
	verzug: 0,
	relax: 2
};

/** Coverage of the four cycles (0–1): supply in the district divided by the residents' demand. */
export type Bilanz = { wasser: number; energie: number; nahrung: number; material: number };

export type Welt = {
	primitives: Primitive[];
	/** Walkthrough at eye level: from the ground via flights and elevated walkways back to the ground. */
	tour: Vec3[];
	/** Standpoint on the ground (square) and view target (nearest intervention). */
	stand: { von: Point2; nach: Point2 };
	/** Footprints that cannot be entered at ground level. */
	blockers: Point2[][];
	/** Half the edge length of the district in meters. */
	extent: number;
	bilanz: Bilanz;
	zahlen: {
		bloecke: number;
		bestand: number;
		eingriffe: number;
		/** Length of the paths above the ground in meters. */
		hochweg: number;
		/** Levels on which paths lie (without the ground). */
		ebenen: number[];
		laeufe: number;
		schleifen: number;
		/** Path pieces that lie on a roof. */
		dachwege: number;
		bewohner: number;
		/** Build cells and quality of the mesh (smallest angle in degrees, largest aspect ratio). */
		zellen: number;
		winkel: number;
		seiten: number;
	};
};

/** Eye level when walking. */
export const AUGE = 1.7;
