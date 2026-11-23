import type { Random } from '../../core/random';
import { sampleBand } from './parameters';

/** Mountain flank defaults in meters above the valley water, except for unitless shares. */
export const RELIEF_DEFAULTS = {
	/** Tallest summit at relief 1. Summit height grows as relief^peakExponent. */
	peakM: 720,
	peakExponent: 1.3,
	/** Share of the apron setback the flank foot moves inward at relief 1. */
	footNarrowing: 0.7,
	footRunM: 140,
	/** Distance from the foot to the ridge crest, and its slow sideways wander. */
	crestDistanceM: [560, 860],
	crestWanderM: 110,
	crestWanderWavelengthM: 1700,
	/** Height share the far side keeps behind the crest. */
	backSlopeShare: 0.7,
	/** Crest share between summits, summit spacing along the valley and summit half-width. */
	saddleShare: 0.42,
	summitPitchM: [1300, 2300],
	summitHalfWidthM: [550, 1000],
	summitHeight: [0.6, 1],
	/** Side valleys cut the flank between summits: half-width and depth share. */
	sideValleyHalfWidthM: [420, 720],
	sideValleyDepth: [0.4, 0.7],
	stationSpanM: 5400,
	/** Ridged detail as a share of local mountain height, at three wavelengths. */
	detailShare: 0.12,
	detailWavelengthsM: [700, 320, 180]
} as const;

type Feature = Readonly<{ station: number; halfWidth: number; share: number }>;

function hash(ix: number, iy: number, seed: number): number {
	let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ seed;
	h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

function fade(t: number): number {
	return t * t * t * (t * (t * 6 - 15) + 10);
}

function valueNoise(x: number, y: number, seed: number): number {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	const u = fade(x - ix);
	const v = fade(y - iy);
	const a = hash(ix, iy, seed);
	const b = hash(ix + 1, iy, seed);
	const c = hash(ix, iy + 1, seed);
	const d = hash(ix + 1, iy + 1, seed);
	return a + (b - a) * u + (c - a + (a - b + d - c) * u) * v;
}

/** Ridged fractal detail in [0, 1]: crests where the noise crosses its midline. */
function ridged(station: number, lateral: number, seed: number): number {
	let sum = 0;
	let weight = 0;
	for (const [octave, wavelength] of RELIEF_DEFAULTS.detailWavelengthsM.entries()) {
		const amplitude = 1 / (octave + 1);
		const n = valueNoise(station / wavelength, lateral / wavelength, seed + octave * 7919);
		sum += amplitude * (1 - Math.abs(2 * n - 1));
		weight += amplitude;
	}
	return sum / weight;
}

function smoothstep(value: number): number {
	const t = Math.max(0, Math.min(1, value));
	return t * t * (3 - 2 * t);
}

function tent(feature: Feature, station: number): number {
	return Math.max(0, 1 - Math.abs(station - feature.station) / feature.halfWidth);
}

/** Summits at seeded pitch along one crest, with a side valley halfway between neighbours. */
function drawSide(random: Random) {
	const d = RELIEF_DEFAULTS;
	const summits: Feature[] = [];
	const valleys: Feature[] = [];
	let station = -d.stationSpanM - random.derive('start').number() * d.summitPitchM[1];
	for (let index = 0; station < d.stationSpanM + d.summitPitchM[1]; index++) {
		const draw = random.derive(String(index));
		summits.push({
			station,
			halfWidth: sampleBand(d.summitHalfWidthM, draw.number()),
			share: sampleBand(d.summitHeight, draw.number())
		});
		const pitch = sampleBand(d.summitPitchM, draw.number());
		valleys.push({
			station: station + pitch * sampleBand([0.4, 0.6], draw.number()),
			halfWidth: sampleBand(d.sideValleyHalfWidthM, draw.number()),
			share: sampleBand(d.sideValleyDepth, draw.number())
		});
		station += pitch;
	}
	return {
		crestDistance: sampleBand(d.crestDistanceM, random.derive('crest').number()),
		wanderPhase: random.derive('wander').number() * 2 * Math.PI,
		summits,
		valleys
	};
}

/** Height share across the flank: an S-shaped rise from foot to crest, then a gentle back slope. */
function crossProfile(u: number): number {
	if (u <= 1) return 0.5 - 0.5 * Math.cos(Math.PI * u);
	return 1 - (1 - RELIEF_DEFAULTS.backSlopeShare) * smoothstep(u - 1);
}

/** Summit height in meters for a relief ratio in [0, 1]. */
export function peakHeightM(relief: number): number {
	return RELIEF_DEFAULTS.peakM * relief ** RELIEF_DEFAULTS.peakExponent;
}

/** Builds the seeded mountain flanks: one ridge per side, summits along each crest and side
 * valleys cut between them. The sampler reads a valley-axis station, a signed lateral distance
 * from the axis and the distance beyond the flank foot (negative on the valley floor), and
 * returns meters to add above the valley ground. Inward of each crest the height grows with the
 * distance from the foot, also inside side valleys, so every slope drains toward the river.
 * Zero relief returns zero everywhere. */
export function mountainFlanks(random: Random, relief: number) {
	const peak = peakHeightM(relief);
	const sides = [drawSide(random.derive('right')), drawSide(random.derive('left'))];
	const seed = Math.floor(random.derive('detail').number() * 0x100000000);
	const d = RELIEF_DEFAULTS;
	return {
		footNarrowing: d.footNarrowing * relief,
		heightM(station: number, lateral: number, beyondFootM: number): number {
			if (peak === 0 || beyondFootM <= 0) return 0;
			const side = sides[lateral < 0 ? 1 : 0];
			let crest: number = d.saddleShare;
			for (const summit of side.summits)
				crest = Math.max(crest, summit.share * tent(summit, station) ** 1.3);
			let cut = 0;
			for (const valley of side.valleys)
				cut = Math.max(cut, valley.share * smoothstep(tent(valley, station)));
			const wander =
				d.crestWanderM *
				Math.sin((2 * Math.PI * station) / d.crestWanderWavelengthM + side.wanderPhase);
			const share = crossProfile(beyondFootM / (side.crestDistance + wander));
			const detail = 1 + d.detailShare * (2 * ridged(station, lateral, seed) - 1);
			return peak * crest * share * (1 - cut) * detail * smoothstep(beyondFootM / d.footRunM);
		}
	};
}

export type MountainFlanks = ReturnType<typeof mountainFlanks>;
