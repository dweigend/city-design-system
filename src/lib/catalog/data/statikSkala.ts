/**
 * Classes of the analysis view (124 A-01 to A-07). The analysis is the only exception to
 * "color only for use" and applies only while it is switched on. Only token names and fixed class
 * boundaries live here; the color values belong to `src/app.css` (DS-10, DS-13).
 *
 * Tension is teal, compression is violet: two tones outside the flow colors. No rainbow: it is
 * not perceptually even, it clashes with the flows and it flips in dark mode. Stepped classes with
 * fixed boundaries are easy to read and stay comparable across seeds.
 */
export type SkalaKlasse = { von: number; bis: number; token: string };
const UNENDLICH = Number.POSITIVE_INFINITY;

/** Axial force in newtons, tension positive: symmetric and roughly logarithmic. */
export const klassenNormalkraft: SkalaKlasse[] = [
	{ von: -UNENDLICH, bis: -200e3, token: '--ana-druck' },
	{ von: -200e3, bis: -100e3, token: '--ana-druck-3' },
	{ von: -100e3, bis: -25e3, token: '--ana-druck-2' },
	{ von: -25e3, bis: 25e3, token: '--ana-null' },
	{ von: 25e3, bis: 100e3, token: '--ana-zug-2' },
	{ von: 100e3, bis: 200e3, token: '--ana-zug-3' },
	{ von: 200e3, bis: UNENDLICH, token: '--ana-zug' }
];

/** Single-hue ladder from low to high; five classes of equal width. */
export const leiter = [
	'--ana-null',
	'--ana-druck-2',
	'--ana-druck-3',
	'--ana-druck',
	'--ana-druck-5'
];

/** Utilization as a fraction: five classes up to the limit of 1, the hazard color above it. */
export const klassenAusnutzung: SkalaKlasse[] = [
	...leiter.map((token, i) => ({ von: i / 5, bis: (i + 1) / 5, token })),
	{ von: 1, bis: UNENDLICH, token: '--cat-hazard' }
];

/** Step size of the deformation classes as a fraction of the allowable deflection: one eighth. */
export const VERFORMUNG_SCHRITT_ANTEIL = 1 / 8;

/**
 * Displacement magnitude in meters, measured against the allowable deflection of the span: five
 * classes in eighths of `zulaessigM`, the step rounded to whole millimeters (at least 1 mm). The
 * last class is open-ended and starts at half the allowable value. That way a short building uses
 * the same classes as a long one: same color means same fraction. Eighths instead of fifths,
 * because the buildings are sized for strength and reach only 35 to 65 % of the allowable
 * deflection (78 seed classes measured, 123).
 */
export function klassenVerformungFuer(zulaessigM: number): SkalaKlasse[] {
	const schritt = Math.max(1, Math.round(zulaessigM * 1000 * VERFORMUNG_SCHRITT_ANTEIL)) / 1000;
	return leiter.map((token, i) => ({
		von: i * schritt,
		bis: i === leiter.length - 1 ? UNENDLICH : (i + 1) * schritt,
		token
	}));
}

/** Reference scale without a structure: 120 mm allowable (36 m span at L/300), so 15 mm steps. */
export const klassenVerformung: SkalaKlasse[] = klassenVerformungFuer(0.12);

/** Analysis views with legend title and unit. */
export const analyseArten = [
	{ value: 'aus', label: 'Construction type', titel: '', einheit: '' },
	{ value: 'kraft', label: 'Forces', titel: 'Axial force', einheit: 'kN' },
	{ value: 'ausnutzung', label: 'Utilization', titel: 'Utilization', einheit: '%' },
	{ value: 'verformung', label: 'Deformation', titel: 'Deformation', einheit: 'mm' }
] as const;
