/**
 * Genome: all dimensions of a tower as continuous numbers. A type is a point in this space,
 * a morph is the path between two points. There is no type switch in the code.
 */
import { clampMorph, lerp } from './hash';

export type Genom = {
	/* Carrier */
	geschosse: number;
	breite: number;
	/* Position layer: deformation of the whole tower (uniforms only) */
	rund: number;
	verjuengung: number;
	bauch: number;
	drall: number;
	biegung: number;
	/* Stack */
	versatz: number;
	auskragung: number;
	dichte: number;
	groesse: number;
	rundung: number;
	/* Form vocabulary: weights of the families */
	kiste: number;
	zylinder: number;
	kegel: number;
	kuppel: number;
	kugel: number;
	kapsel: number;
	/* Layers */
	rahmen: number;
	kern: number;
	huelle: number;
	gitter: number;
	treppe: number;
	leitung: number;
	farbe: number;
	muster: number;
	/** Continuous index into the crown vocabulary (koepfe). */
	kopf: number;
};

export type GenomKey = keyof Genom;

export const koepfe = ['Dome', 'Sphere', 'Cone', 'Tank', 'Garden', 'Frame crown'] as const;

export type Regler = {
	key: GenomKey;
	name: string;
	gruppe: 'lage' | 'stapel' | 'schicht';
	min: number;
	max: number;
	step: number;
	text: string;
};

/** Adjustable dimensions. The vocabulary weights come from the type. */
export const regler: Regler[] = [
	{
		key: 'rund',
		name: 'Round',
		gruppe: 'lage',
		min: 0,
		max: 1,
		step: 0.01,
		text: 'square becomes circle'
	},
	{
		key: 'verjuengung',
		name: 'Taper',
		gruppe: 'lage',
		min: -0.7,
		max: 0.75,
		step: 0.01,
		text: 'negative cantilevers outward'
	},
	{
		key: 'bauch',
		name: 'Inflate',
		gruppe: 'lage',
		min: -0.5,
		max: 0.8,
		step: 0.01,
		text: 'negative pinches into a waist'
	},
	{
		key: 'drall',
		name: 'Twist',
		gruppe: 'lage',
		min: -3.2,
		max: 3.2,
		step: 0.01,
		text: 'radians at the top'
	},
	{
		key: 'biegung',
		name: 'Bend',
		gruppe: 'lage',
		min: -1,
		max: 1,
		step: 0.01,
		text: 'axis becomes an arc'
	},
	{
		key: 'geschosse',
		name: 'Floors',
		gruppe: 'stapel',
		min: 4,
		max: 15,
		step: 0.1,
		text: 'continuous: the top grows in'
	},
	{
		key: 'breite',
		name: 'Width',
		gruppe: 'stapel',
		min: 5,
		max: 11,
		step: 0.1,
		text: 'half edge in m'
	},
	{
		key: 'versatz',
		name: 'Offset',
		gruppe: 'stapel',
		min: 0,
		max: 1,
		step: 0.01,
		text: 'microcosms shift outward'
	},
	{
		key: 'auskragung',
		name: 'Cantilever',
		gruppe: 'stapel',
		min: 0,
		max: 1,
		step: 0.01,
		text: 'modules push outward'
	},
	{
		key: 'dichte',
		name: 'Density',
		gruppe: 'stapel',
		min: 0,
		max: 1,
		step: 0.01,
		text: 'share of occupied bays'
	},
	{
		key: 'groesse',
		name: 'Size',
		gruppe: 'stapel',
		min: 0.6,
		max: 1.6,
		step: 0.01,
		text: 'scale of the modules'
	},
	{
		key: 'rundung',
		name: 'Edges',
		gruppe: 'stapel',
		min: 0,
		max: 1,
		step: 0.01,
		text: 'sharp to soft'
	},
	{
		key: 'rahmen',
		name: 'Frame',
		gruppe: 'schicht',
		min: 0,
		max: 1,
		step: 0.01,
		text: 'second shell from 0.55'
	},
	{
		key: 'huelle',
		name: 'Envelope',
		gruppe: 'schicht',
		min: 0,
		max: 1,
		step: 0.01,
		text: 'frosted around the microcosm'
	},
	{
		key: 'gitter',
		name: 'Lattice',
		gruppe: 'schicht',
		min: 0,
		max: 1,
		step: 0.01,
		text: 'gyroid cuts the envelope'
	},
	{
		key: 'leitung',
		name: 'Pipes',
		gruppe: 'schicht',
		min: 0,
		max: 1,
		step: 0.01,
		text: 'wind around the tower'
	},
	{
		key: 'farbe',
		name: 'Color',
		gruppe: 'schicht',
		min: 0,
		max: 1,
		step: 0.01,
		text: 'white architectural model to full flow color'
	},
	{
		key: 'muster',
		name: 'Pattern',
		gruppe: 'schicht',
		min: 0,
		max: 1,
		step: 0.01,
		text: 'Memphis surfaces'
	},
	{
		key: 'kopf',
		name: 'Crown',
		gruppe: 'schicht',
		min: 0,
		max: koepfe.length - 1,
		step: 0.01,
		text: koepfe.join(' · ')
	}
];

export type Typ = { id: string; name: string; text: string; ref: string; genom: Genom };

const basis: Genom = {
	geschosse: 9,
	breite: 7,
	rund: 0,
	verjuengung: 0,
	bauch: 0,
	drall: 0,
	biegung: 0,
	versatz: 0,
	auskragung: 0.3,
	dichte: 0.6,
	groesse: 1,
	rundung: 0.1,
	kiste: 1,
	zylinder: 0,
	kegel: 0,
	kuppel: 0,
	kugel: 0,
	kapsel: 0,
	rahmen: 0.3,
	kern: 0.4,
	huelle: 0,
	gitter: 0,
	treppe: 1,
	leitung: 0.4,
	farbe: 0.8,
	muster: 0.4,
	kopf: 2
};

/** Eight types as stations of the morph path. Order = slider travel. */
export const typen: Typ[] = [
	{
		id: 'bauklotz',
		name: 'Building Block',
		text: 'Offset blocks, stairs outside, a cone as the crown.',
		ref: '18, 103',
		genom: {
			...basis,
			geschosse: 8,
			breite: 7,
			verjuengung: 0.18,
			versatz: 0.95,
			auskragung: 0.4,
			dichte: 0.62,
			groesse: 1.3,
			rundung: 0.04,
			zylinder: 0.15,
			kegel: 0.1,
			rahmen: 0.15,
			kern: 0.44,
			leitung: 0.2,
			farbe: 0.6,
			muster: 0.5,
			kopf: 2
		}
	},
	{
		id: 'memphis',
		name: 'Memphis',
		text: 'Primary forms, full color, pattern on every surface.',
		ref: '22, 13, 19',
		genom: {
			...basis,
			geschosse: 9,
			breite: 6.5,
			rund: 0.22,
			verjuengung: 0.1,
			bauch: 0.12,
			drall: 0.35,
			versatz: 0.55,
			auskragung: 0.5,
			dichte: 0.72,
			groesse: 1.4,
			rundung: 0.35,
			kiste: 0.5,
			zylinder: 0.5,
			kegel: 0.45,
			kuppel: 0.35,
			kugel: 0.45,
			kapsel: 0.2,
			rahmen: 0.25,
			huelle: 0.1,
			treppe: 0.8,
			leitung: 0.5,
			farbe: 1,
			muster: 1,
			kopf: 1
		}
	},
	{
		id: 'kapsel',
		name: 'Capsule',
		text: 'Round core, capsules plugged radially into the structural frame, pipes winding around.',
		ref: '26, 27 · Archigram',
		genom: {
			...basis,
			geschosse: 13,
			breite: 5.5,
			rund: 1,
			bauch: 0.06,
			drall: 1.3,
			versatz: 0.15,
			auskragung: 0.9,
			dichte: 0.86,
			groesse: 1,
			rundung: 0.8,
			kiste: 0.1,
			kugel: 0.12,
			kapsel: 1,
			rahmen: 0.45,
			kern: 0.5,
			huelle: 0.15,
			treppe: 0.6,
			leitung: 1,
			farbe: 0.9,
			muster: 0.5,
			kopf: 3
		}
	},
	{
		id: 'kuppelberg',
		name: 'Dome Mountain',
		text: 'Broad foot, domes and bubbles, geodesic crown.',
		ref: '140, 32 · Fuller',
		genom: {
			...basis,
			geschosse: 6.5,
			breite: 10.5,
			rund: 0.9,
			verjuengung: 0.5,
			bauch: 0.32,
			versatz: 0.25,
			auskragung: 0.3,
			dichte: 0.66,
			groesse: 1.3,
			rundung: 0.7,
			kiste: 0.15,
			zylinder: 0.2,
			kuppel: 1,
			kugel: 0.5,
			rahmen: 0.3,
			kern: 0.3,
			huelle: 0.9,
			treppe: 0.7,
			leitung: 0.5,
			farbe: 0.75,
			muster: 0.6,
			kopf: 0
		}
	},
	{
		id: 'megastruktur',
		name: 'Megastructure',
		text: 'The structural frame is the architecture; plug-in modules hang inside it.',
		ref: '134, 136 · Superstudio',
		genom: {
			...basis,
			geschosse: 12,
			breite: 8,
			versatz: 0.1,
			auskragung: 0.6,
			dichte: 0.4,
			groesse: 0.9,
			rundung: 0.1,
			zylinder: 0.2,
			kapsel: 0.15,
			rahmen: 1,
			kern: 0.3,
			huelle: 0.25,
			leitung: 0.7,
			farbe: 0.85,
			muster: 0.6,
			kopf: 5
		}
	},
	{
		id: 'brutalist',
		name: 'Brutalist',
		text: 'Shafts carry the load; heavy volumes cantilever outward toward the top.',
		ref: '06, 42',
		genom: {
			...basis,
			geschosse: 10,
			breite: 6,
			rund: 0.35,
			verjuengung: -0.5,
			bauch: -0.15,
			versatz: 0.6,
			auskragung: 1,
			dichte: 0.5,
			groesse: 1.45,
			rundung: 0.15,
			kiste: 0.8,
			zylinder: 0.7,
			rahmen: 0.12,
			kern: 0.55,
			treppe: 0.6,
			leitung: 0.3,
			farbe: 0.3,
			muster: 0.5,
			kopf: 4
		}
	},
	{
		id: 'seilnetz',
		name: 'Cable Net',
		text: 'Waist and twist: a hyperboloid; the envelope is a lattice.',
		ref: '47 · Frei Otto',
		genom: {
			...basis,
			geschosse: 14,
			breite: 7.5,
			rund: 1,
			verjuengung: 0.15,
			bauch: -0.45,
			drall: 2.4,
			auskragung: 0.2,
			dichte: 0.45,
			groesse: 0.9,
			rundung: 1,
			kiste: 0,
			kuppel: 0.2,
			kugel: 0.6,
			kapsel: 0.4,
			rahmen: 0.7,
			kern: 0.22,
			huelle: 1,
			gitter: 1,
			treppe: 0.8,
			leitung: 0.8,
			farbe: 0.9,
			muster: 0.3,
			kopf: 1
		}
	},
	{
		id: 'pneu',
		name: 'Pneu',
		text: 'Inflated: spheres in frosted skins.',
		ref: '140, 142, 27',
		genom: {
			...basis,
			geschosse: 7,
			breite: 8,
			rund: 0.9,
			verjuengung: 0.3,
			bauch: 0.6,
			drall: 0.5,
			versatz: 0.4,
			auskragung: 0.5,
			dichte: 0.55,
			groesse: 1.5,
			rundung: 1,
			kiste: 0,
			kuppel: 0.5,
			kugel: 1,
			kapsel: 0.3,
			rahmen: 0.2,
			kern: 0.3,
			huelle: 0.8,
			treppe: 0.5,
			leitung: 0.6,
			farbe: 0.65,
			muster: 0.25,
			kopf: 0
		}
	}
];

const keys = Object.keys(basis) as GenomKey[];

function mischeGenom(a: Genom, b: Genom, t: number): Genom {
	const g = { ...a };
	for (const k of keys) g[k] = lerp(a[k], b[k], t);
	return g;
}

/** Point on the morph path: t = 0 … typen.length − 1, piecewise linear. */
export function strecke(t: number): Genom {
	const max = typen.length - 1,
		c = clampMorph(t, 0, max),
		i = Math.min(max - 1, Math.floor(c));
	return mischeGenom(typen[i].genom, typen[i + 1].genom, c - i);
}

/** Distance between two genomes, each dimension normalized to its range (for tests and displays). */
export function abstand(a: Genom, b: Genom): number {
	let d = 0;
	for (const k of keys) d = Math.max(d, Math.abs(a[k] - b[k]));
	return d;
}
