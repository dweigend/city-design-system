type Insets = [west: number, east: number, south: number, north: number];
type SectionRule = (rise: number, floor: number) => Insets;
const ring = (d: number): Insets => [d, d, d, d];
const wave = (t: number) => (1 - Math.cos(2 * Math.PI * t)) / 2;
const sectionsByName = {
	'terrace-fan': (t) => [0.02, 0.02 + t * 0.55, 0.02, 0.02],
	'lantern-neck': (t) => ring(t >= 0.75 ? 0.04 : 0.27),
	'cross-stack': (_, i) => (i % 2 ? [0.29, 0.29, 0.04, 0.04] : [0.04, 0.04, 0.29, 0.29]),
	lightwell: () => ring(0.025),
	gable: (t) => [0.42 * t, 0.42 * t, 0.02, 0.02],
	vessel: (t) => ring(0.08 + 0.24 * Math.abs(2 * t - 1)),
	// Broad paired chambers and a pinched connector on a common vertical core.
	'orbital-nodes': (_, floor) => ring(floor % 3 === 1 ? 0.31 : 0.035),
	// A broad crown projects beyond a narrow stem in every direction.
	'canopy-cap': (t) => ring(t < 0.7 ? 0.35 : 0.04 + 0.12 * (t - 0.7)),
	// The cantilever switches sides once, keeping a continuous bearing strip.
	counterweight: (t) => (t < 0.65 ? [0.05, 0.48, 0.12, 0.12] : [0.48, 0.05, 0.12, 0.12]),
	// Retreat advances around the core with elevation.
	'spiral-terrace': (t) => [
		0.34 * wave(t),
		0.34 * wave(t + 0.5),
		0.34 * wave(t + 0.25),
		0.34 * wave(t + 0.75)
	],
	'buttressed-spire': (t) => ring(0.04 + 0.39 * Math.sqrt(t)),
	// Two faces retreat while their opposite corner keeps a vertical edge.
	'diagonal-sail': (t) => [0.03, 0.52 * t, 0.04, 0.44 * t * t],
	saddle: (t) => [0.33 * t, 0.33 * t, 0.33 * (1 - t), 0.33 * (1 - t)],
	'folded-fan': (t) => [0.03, 0.47 * wave(t), 0.36 * (1 - wave(t)), 0.03],
	'table-house': (t) => (t < 0.82 ? [0.32, 0.32, 0.05, 0.05] : [0.02, 0.02, 0.18, 0.18]),
	outcrop: (t) => [0.29 * (1 - t), 0.05, 0.06, t > 0.6 ? 0.44 : 0.15],
	'tiered-ziggurat': (t) => ring(0.04 + 0.12 * Math.floor(3 * t)),
	'waisted-shell': (t) => ring(0.04 + 0.3 * wave(t)),
	'corbelled-bowl': (t) => ring(0.38 * (1 - t * t)),
	longhouse: (t) => [0.03, 0.03, 0.08 + 0.36 * t, 0.08 + 0.36 * t],
	'quarry-cut': (t) => [0.03, t < 0.52 ? 0.06 : 0.49, 0.04, 0.32 * t],
	'wind-scoop': (t) => [0.48 * Math.sin(Math.PI * t), 0.02, 0.07, 0.31 * t * t],
	'silo-crown': (t) => ring(t > 0.68 ? 0.06 : 0.26 * Math.sin(Math.PI * t))
} satisfies Record<string, SectionRule>;

export const sections = Object.keys(sectionsByName) as (keyof typeof sectionsByName)[];

/** Insets from the surveyed bay sides, as fractions of the bay span at a given floor. */
export function sectionInsets(
	profile: keyof typeof sectionsByName,
	rise: number,
	floor: number
): Insets {
	return sectionsByName[profile](rise, floor);
}
