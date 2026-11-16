import type { FlowId } from '../../data/focus';
export type Vec3 = readonly [number, number, number];
export type BestandBlock = { min: Vec3; max: Vec3 };
export type Stab = { a: Vec3; b: Vec3; durchmesser: number; art: 'zug' | 'druck' | 'null' };
export type Koerper = {
	polygon?: readonly (readonly [number, number])[];
	rolle: 'huelle' | 'raum' | 'kontext';
	min: Vec3;
	max: Vec3;
	strom?: FlowId;
	teil?: 'boden' | 'rueckwand' | 'kern' | 'tuer' | 'nutzflaeche';
};
export type WegBand = { punkte: readonly Vec3[]; breite: number };
export type LeitstilSzene = {
	blickziel?: Vec3;
	lager?: readonly BestandBlock[];
	bestand: readonly BestandBlock[];
	staebe: readonly Stab[];
	koerper: readonly Koerper[];
	wege: readonly WegBand[];
	figuren: readonly Vec3[];
	insel: BestandBlock;
	geplant?: readonly Koerper[];
	auswahl?: readonly Segment[];
	gefahr?: readonly Segment[];
	anker?: Vec3;
	baustelle?: readonly (readonly Vec3[])[];
};
export type Segment = { a: Vec3; b: Vec3; art?: 'kante' | 'fenster' | 'bogen' | 'gesims' };
