/**
 * Terrain of the sandbox: a river valley as a declared form rule, plus the interventions
 * the player digs into it. The terrain comes first; grids, houses and lines follow it.
 *
 * The form rule lives in valley coordinates: `along` runs down the valley, `across` from the
 * far river bank over floodplain and terraces up to the ridge. Cross profile after the
 * Cologne section K3: lower terrace about 135 m, a 145 m rise of 6 m, then the upper
 * terrace. Terrace edges sway, a ridge with spurs and coves closes the high ground, a creek
 * cuts through. Every contour line is a single curve along the valley, so grid rows can
 * follow the contours.
 *
 * Heights in meters above the river's mean water level. Headless, deterministic per seed
 * and edit list; the terrain itself is plain immutable data.
 */
import { hash } from '../hash-random';
import type { Point2 } from '../parametrik/vocab';
import { valueNoise } from './noise';

/** Any rule change that changes heights increments this version (PD-11). */
const TERRAIN_VERSION = 'terrain/2';

export type TerrainZone =
	'water' | 'floodplain' | 'lower-terrace' | 'scarp' | 'upper-terrace' | 'ridge';

/**
 * A deliberate intervention in the ground. `basin`: a harbor basin dug to below the water
 * level around a world point, with a sloped bank outside the radius.
 */
export type TerrainEdit = Readonly<{ kind: 'basin'; center: Point2; radius: number }>;

/** Extent of the valley frame along and across, meters. */
const ALONG = 760;
const ACROSS = 620;
/** Radius of the valley axis; the center of curvature lies on the river side. */
const AXIS_RADIUS = 1500;
/** Plateau heights of the cross profile, meters above mean water. */
const LEVEL = { farBank: 1.6, bed: -2.5, floodplain: 1.6, lower: 6, upper: 12 };
/** Band widths across the valley, meters; each varies by ±WIDTH_VARIATION per seed. */
const WIDTH = { farBank: 38, river: 70, floodplain: 68, lower: 135, scarp: 145 };
const WIDTH_VARIATION = 0.12;
/** Horizontal run of the riser between floodplain and lower terrace, and of the banks. */
const RISER_RUN = 18;
const BANK_RUN = 16;
/** Sway of the band edges along the valley: amplitude and wavelength, meters. */
const SWAY = { bank: 6, riser: 15, scarp: 20, wavelength: 230 };
/** Ridge behind the upper terrace: where its toe lies, how it sways, how it rises. */
const RIDGE = { setback: 62, sway: 46, wavelength: 190, run: 150, height: 30 };
/**
 * Creek notch: half width, slope of its bed inland, sway of its course, share of the cut and
 * height of its mouth above mean water.
 */
const CREEK = { halfWidth: 20, grade: 0.02, sway: 16, depth: 0.9, mouth: 0.5 };
/** Fine relief on top of the form rule; never decides a zone or a grid line. */
const DETAIL = { amplitude: 0.3, wavelength: 46 };
/** Basin: floor below mean water and run of its bank outside the radius, meters. */
const BASIN = { floor: -2.6, bank: 7 };
/** Ground below this height above mean water floods. */
export const FLOOD_LINE = 2.9;

const CHANNEL = { width: 1, creek: 3, detail: 6, creekSway: 7, sway: 9, ridge: 10 };

/** Edges of the profile bands, meters across the valley, ascending. */
type Bands = Readonly<{
	riverStart: number;
	riverEnd: number;
	terraceEdge: number;
	scarpStart: number;
	scarpEnd: number;
}>;

export type Terrain = Readonly<{
	version: string;
	seed: number;
	/** Extent of the valley frame, meters: along ∈ [0, along], across ∈ [0, across]. */
	along: number;
	across: number;
	/** Mean water level of the river; the datum 0. */
	waterLevel: number;
	bands: Bands;
	/** Position along the valley where the creek meets the river. */
	creekAlong: number;
	/** Interventions in the order they were made. */
	edits: readonly TerrainEdit[];
}>;

const smoothstep = (t: number) => {
	const c = Math.max(0, Math.min(1, t));
	return c * c * (3 - 2 * c);
};
const ramp = (value: number, from: number, to: number) => smoothstep((value - from) / (to - from));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function bandsFor(seed: number): Bands {
	const width = (base: number, id: number) =>
		base * (1 + (hash(seed, id, CHANNEL.width) * 2 - 1) * WIDTH_VARIATION);
	const riverStart = width(WIDTH.farBank, 0);
	const riverEnd = riverStart + width(WIDTH.river, 1);
	const terraceEdge = riverEnd + width(WIDTH.floodplain, 2);
	const scarpStart = terraceEdge + width(WIDTH.lower, 3);
	const scarpEnd = scarpStart + width(WIDTH.scarp, 4);
	return { riverStart, riverEnd, terraceEdge, scarpStart, scarpEnd };
}

/**
 * Creates the terrain description for a seed and a list of interventions. Pure and
 * detached: the result is plain data.
 * @param options.seed integer, normalized to u32; default 7
 * @param options.edits interventions in order; default none
 */
export function createTerrain(
	options: { seed?: number; edits?: readonly TerrainEdit[] } = {}
): Terrain {
	const raw = options.seed;
	const seed = Math.floor(raw !== undefined && Number.isFinite(raw) ? raw : 7) >>> 0;
	return {
		version: TERRAIN_VERSION,
		seed,
		along: ALONG,
		across: ACROSS,
		waterLevel: 0,
		bands: bandsFor(seed),
		creekAlong: ALONG * (0.2 + hash(seed, 0, CHANNEL.creek) * 0.6),
		edits: options.edits ?? []
	};
}

/** Valley frame → world: position in the ground plane, meters. The frame center maps to the origin. */
export function valleyPoint(terrain: Terrain, along: number, across: number): Point2 {
	const radius = AXIS_RADIUS + across - terrain.across / 2;
	const angle = (along - terrain.along / 2) / AXIS_RADIUS;
	return [radius * Math.sin(angle), radius * Math.cos(angle) - AXIS_RADIUS];
}

/** World → valley frame: the exact inverse of {@link valleyPoint}. */
export function valleyCoords(terrain: Terrain, x: number, y: number): Point2 {
	const radius = Math.hypot(x, y + AXIS_RADIUS);
	const angle = Math.atan2(x, y + AXIS_RADIUS);
	return [terrain.along / 2 + angle * AXIS_RADIUS, radius - AXIS_RADIUS + terrain.across / 2];
}

/** Sway of a band edge at a position along the valley, meters, in [-amplitude, amplitude]. */
function sway(terrain: Terrain, along: number, amplitude: number, id: number): number {
	return (
		(valueNoise(terrain.seed, along / SWAY.wavelength, id + 0.5, CHANNEL.sway) * 2 - 1) * amplitude
	);
}

/** Signed distance across the valley from its meandering near bank, in meters. */
export function bankDistance(terrain: Terrain, x: number, y: number) {
	const [along, across] = valleyCoords(terrain, x, y);
	return across - (terrain.bands.riverEnd + sway(terrain, along, SWAY.bank, 0));
}

function crossProfile(terrain: Terrain, along: number, across: number): number {
	const { bands } = terrain;
	const bank = sway(terrain, along, SWAY.bank, 0);
	const riser = bands.terraceEdge + sway(terrain, along, SWAY.riser, 1);
	const scarp = sway(terrain, along, SWAY.scarp, 2);
	let height = LEVEL.farBank;
	const riverStart = bands.riverStart + bank;
	const riverEnd = bands.riverEnd + bank;
	height = mix(height, LEVEL.bed, ramp(across, riverStart - BANK_RUN / 2, riverStart + BANK_RUN));
	height = mix(
		height,
		LEVEL.floodplain,
		ramp(across, riverEnd - BANK_RUN, riverEnd + BANK_RUN / 2)
	);
	height = mix(height, LEVEL.lower, ramp(across, riser, riser + RISER_RUN));
	return mix(height, LEVEL.upper, ramp(across, bands.scarpStart + scarp, bands.scarpEnd + scarp));
}

/** Position across the valley where the ridge starts to rise. */
function ridgeToe(terrain: Terrain, along: number): number {
	const spur = valueNoise(terrain.seed, along / RIDGE.wavelength, 0.5, CHANNEL.ridge) * 2 - 1;
	return terrain.bands.scarpEnd + RIDGE.setback + spur * RIDGE.sway;
}

function ridge(terrain: Terrain, along: number, across: number): number {
	const climb = Math.max(0, across - ridgeToe(terrain, along)) / RIDGE.run;
	return RIDGE.height * climb * climb;
}

/** Depth of the creek notch below the uncut ground `height`, meters. */
function creekCut(terrain: Terrain, along: number, across: number, height: number): number {
	const inland = across - terrain.bands.riverEnd;
	if (inland <= 0) return 0;
	const course =
		(valueNoise(terrain.seed, across / 120, 0.5, CHANNEL.creekSway) * 2 - 1) * CREEK.sway;
	const offset = (along - terrain.creekAlong - course) / CREEK.halfWidth;
	const bed = terrain.waterLevel + CREEK.mouth + CREEK.grade * inland;
	return Math.exp(-offset * offset) * Math.max(0, height - bed) * CREEK.depth;
}

/** Incision of the tributary below the undisturbed valley profile, in meters. */
export function ravineDepth(terrain: Terrain, x: number, y: number): number {
	const [along, across] = valleyCoords(terrain, x, y);
	const uncut = crossProfile(terrain, along, across) + ridge(terrain, along, across);
	return Math.max(0, uncut - groundLevel(terrain, x, y));
}

/** Ground of the form rule alone, in valley coordinates. */
function ruleLevel(terrain: Terrain, along: number, across: number): number {
	const uncut = crossProfile(terrain, along, across) + ridge(terrain, along, across);
	return uncut - creekCut(terrain, along, across, uncut);
}

/** Lowers `height` where a basin was dug. */
function dig(edit: TerrainEdit, x: number, y: number, height: number): number {
	const distance = Math.hypot(x - edit.center[0], y - edit.center[1]);
	if (distance >= edit.radius + BASIN.bank) return height;
	const floor = Math.min(height, BASIN.floor);
	return mix(floor, height, ramp(distance, edit.radius, edit.radius + BASIN.bank));
}

/**
 * Ground height without fine relief at a world point, meters above mean water: the form
 * rule with every intervention applied. Level datums and grid lines read this value.
 */
export function groundLevel(terrain: Terrain, x: number, y: number): number {
	const [along, across] = valleyCoords(terrain, x, y);
	let height = ruleLevel(terrain, along, across);
	for (const edit of terrain.edits) height = dig(edit, x, y, height);
	return height;
}

/** Ground height including fine relief at a world point, meters above mean water. */
export function terrainHeight(terrain: Terrain, x: number, y: number): number {
	const detail =
		valueNoise(terrain.seed, x / DETAIL.wavelength, y / DETAIL.wavelength, CHANNEL.detail) * 2 - 1;
	return groundLevel(terrain, x, y) + detail * DETAIL.amplitude;
}

/**
 * Typology of a world point. Water and floodplain follow the actual ground, so a dug basin
 * is water; the dry zones follow the bands of the form rule.
 */
export function terrainZone(terrain: Terrain, x: number, y: number): TerrainZone {
	const level = groundLevel(terrain, x, y);
	if (level < terrain.waterLevel) return 'water';
	if (level < FLOOD_LINE) return 'floodplain';
	const [along, across] = valleyCoords(terrain, x, y);
	if (across > ridgeToe(terrain, along)) return 'ridge';
	const scarp = sway(terrain, along, SWAY.scarp, 2);
	if (across < terrain.bands.scarpStart + scarp) return 'lower-terrace';
	return across < terrain.bands.scarpEnd + scarp ? 'scarp' : 'upper-terrace';
}

/** Reach of an intervention around its center, meters: beyond it the ground is untouched. */
export const editReach = (edit: TerrainEdit) => edit.radius + BASIN.bank;
