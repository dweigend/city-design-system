/**
 * Primal form: a single body with eight continuous dimensions. Box, cylinder, cone, dome,
 * sphere, capsule, cushion and pyramid are points in this space, not separate code.
 * So between any two forms there is always another valid form: morphing means blending.
 *
 * half dimensions hx, hy, hz · rounding in plan rxy · edge rounding at top rt and bottom rb
 * · taper toward the top tx, ty (1 = straight, 0 = apex or ridge).
 */
import { lerp } from './hash';

export type Form = {
	hx: number;
	hy: number;
	hz: number;
	rxy: number;
	rt: number;
	rb: number;
	tx: number;
	ty: number;
};

export const kiste = (hx: number, hy: number, hz: number, rund = 0, kante = 0): Form => {
	const rxy = rund * Math.min(hx, hy);
	const r = kante * Math.min(rxy, hz);
	return { hx, hy, hz, rxy, rt: r, rb: r, tx: 1, ty: 1 };
};
export const zylinder = (r: number, hz: number, kante = 0): Form => {
	const k = kante * Math.min(r, hz);
	return { hx: r, hy: r, hz, rxy: r, rt: k, rb: k, tx: 1, ty: 1 };
};
export const kegel = (r: number, hz: number, spitze = 0.04): Form => ({
	...zylinder(r, hz),
	tx: spitze,
	ty: spitze
});
export const kugel = (r: number): Form => ({
	hx: r,
	hy: r,
	hz: r,
	rxy: r,
	rt: r,
	rb: r,
	tx: 1,
	ty: 1
});
/** Hemisphere on its base; rise < 1 makes it flatter. */
export const kuppel = (r: number, rise = 1): Form => ({
	hx: r,
	hy: r,
	hz: (r * rise) / 2,
	rxy: r,
	rt: r * rise,
	rb: 0,
	tx: 1,
	ty: 1
});
/** Horizontal capsule along y (radial on the tower): Archigram plug-in. */
export const kapsel = (r: number, halbLang: number): Form => ({
	hx: r,
	hy: Math.max(r, halbLang),
	hz: r,
	rxy: r,
	rt: r,
	rb: r,
	tx: 1,
	ty: 1
});
/** Gable roof: a box whose top edge converges in y to a ridge. */
export const dach = (hx: number, hy: number, hz: number): Form => ({
	...kiste(hx, hy, hz),
	ty: 0.02
});
/** Rod or pipe along the vertical axis (before rotation). */
export const stab = (dick: number, halbLang: number, rund = 0): Form => ({
	hx: dick,
	hy: dick,
	hz: halbLang,
	rxy: rund * dick,
	rt: 0,
	rb: 0,
	tx: 1,
	ty: 1
});

export function mische(a: Form, b: Form, t: number): Form {
	return {
		hx: lerp(a.hx, b.hx, t),
		hy: lerp(a.hy, b.hy, t),
		hz: lerp(a.hz, b.hz, t),
		rxy: lerp(a.rxy, b.rxy, t),
		rt: lerp(a.rt, b.rt, t),
		rb: lerp(a.rb, b.rb, t),
		tx: lerp(a.tx, b.tx, t),
		ty: lerp(a.ty, b.ty, t)
	};
}

/**
 * Form vocabulary as intervals on [0, 1): each family occupies a segment as long as its
 * weight. A slot has a fixed random number u and reads which segment it falls in.
 * The boundaries are soft: near a boundary the slot blends both neighbors. When the
 * weights change, the boundaries shift, and the slot's form flows along continuously.
 * Returns: share per family, summing to 1.
 */
export function anteile(u: number, gewichte: number[], weich = 0.07): number[] {
	const sum = gewichte.reduce((a, b) => a + Math.max(0, b), 0);
	if (sum <= 1e-9) return gewichte.map((_, i) => (i === 0 ? 1 : 0));
	// Window [u − weich, u + weich] ∩ [0, 1]: share = length of the segment inside the window.
	// Empty segments contribute nothing, narrow ones little: continuous in u and in every weight.
	const lo = Math.max(0, u - weich),
		hi = Math.min(1, u + weich),
		breite = hi - lo;
	let grenze = 0;
	return gewichte.map((g) => {
		const von = grenze;
		grenze += Math.max(0, g) / sum;
		return Math.max(0, Math.min(hi, grenze) - Math.max(lo, von)) / breite;
	});
}

/** Blends forms by shares. */
export function summe(formen: Form[], teile: number[]): Form {
	const f: Form = { hx: 0, hy: 0, hz: 0, rxy: 0, rt: 0, rb: 0, tx: 0, ty: 0 };
	for (let i = 0; i < formen.length; i++) {
		const t = teile[i];
		if (!t) continue;
		const g = formen[i];
		f.hx += g.hx * t;
		f.hy += g.hy * t;
		f.hz += g.hz * t;
		f.rxy += g.rxy * t;
		f.rt += g.rt * t;
		f.rb += g.rb * t;
		f.tx += g.tx * t;
		f.ty += g.ty * t;
	}
	return f;
}
