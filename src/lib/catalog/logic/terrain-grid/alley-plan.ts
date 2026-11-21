import { townDefaults } from '../../data/sandbox';
import { hashUnit } from '../parzelle';
import type { QuadCell } from '../quad-grid';
import { bankDistance, ravineDepth, terrainZone, type Terrain, type TerrainZone } from '../terrain';
import { BLOCK, MODULE } from './contour-rows';
import { patternAt, type Pattern } from './patterns';
import type { Lattice } from './contour-rows';

import { defaultAlleyPlan } from './alley-profile';
import type { TerrainCell } from './types';
type Profile = typeof defaultAlleyPlan;
type Site = { corners: QuadCell['corners']; zone: TerrainZone; pattern: Pattern; incision: number };

/** Circulation at the projected carrier, shared by parcel planning and the published cell. */
export function carrierSite(
	lattice: Lattice,
	column: number,
	row: number,
	corners: Site['corners']
) {
	const x = (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4;
	const y = (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4;
	const zone = terrainZone(lattice.terrain, x, y);
	const pattern = patternAt(lattice, column, row);
	const plan = alleyPlan(
		lattice.terrain,
		column,
		row,
		{ corners, zone, pattern, incision: ravineDepth(lattice.terrain, x, y) },
		lattice.profile
	);
	return { x, y, zone, pattern, plan };
}

/** Fraction of the seeded settlement envelope at a chart address. */
export function settlementExtent(terrain: Terrain, column: number, row: number, profile: Profile) {
	const center = townDefaults.centerMin + townDefaults.centerRange * hashUnit(terrain.seed, 'town');
	const dx = ((column * MODULE) / terrain.along - center) / profile.settlementWidth;
	const dy =
		(row * MODULE - (terrain.bands.riverEnd + terrain.bands.scarpEnd) / 2) /
		(terrain.across * profile.settlementReach);
	return Math.max(0, Math.min(1, (1 - Math.hypot(dx, dy)) * BLOCK.rows));
}

/** Classifies the circulation and reserved ground at a stable lattice address. */
export function alleyPlan(
	terrain: Terrain,
	column: number,
	row: number,
	site: Site,
	profile = defaultAlleyPlan
) {
	const [a, b, , d] = site.corners;
	const grade = (p: typeof a) => Math.abs(p[2] - a[2]) / Math.hypot(p[0] - a[0], p[1] - a[1]);
	const bank = Math.round((terrain.bands.riverEnd + profile.bankSetback) / MODULE);
	const footbridge = riverCrossing(terrain, column, row, bank, profile);
	const steep = grade(d) >= profile.steepGrade;
	const promenade = row <= bank + BLOCK.rows && onPromenade(terrain, site, profile);
	const { along, across, flight, landing, phase } = terracePassages(
		column,
		row,
		bank,
		grade(d),
		site,
		steep,
		promenade,
		profile
	);
	const square = nodeSquare(site, column, phase, profile);
	const open = openGround(site, grade(b), profile);
	const extent = settlementExtent(terrain, column, row, profile);
	const occupied = !open && extent > 0;
	const direction = footbridge || occupied ? directionAt(along, across || footbridge) : null;
	const kind = routeKind(
		direction,
		footbridge,
		promenade,
		along,
		isStairRoute(flight, steep, across, column)
	);

	return {
		direction,
		kind,
		width: alleyWidth(kind, square || landing, profile),
		edgePassage: kind === 'mainAlley' && sidePassage(square, landing, across),
		extent,
		footbridge,
		square: square && occupied,
		open,
		stairAlley: kind === 'stairAlley'
	};
}

function stairFlight(
	zone: TerrainZone,
	row: number,
	bank: number,
	lane: number,
	slope: number,
	phase: number,
	profile: Profile
) {
	return (
		zone !== 'water' &&
		row > bank &&
		(slope >= profile.landingGrade || (zone === 'lower-terrace' && phase <= 2)) &&
		lane === (Math.floor(row / BLOCK.rows) % 2 ? BLOCK.columns / 3 : (2 * BLOCK.columns) / 3) &&
		phase > 0 &&
		phase <= profile.terraceRows
	);
}

function landingAt(lane: number, phase: number, promenade: boolean) {
	const offset = lane >= BLOCK.columns / 3 && lane < (2 * BLOCK.columns) / 3 ? 1 : 0;
	const landing = lane === BLOCK.columns / 3 || lane === (2 * BLOCK.columns) / 3;

	const along = promenade || phase === offset || (landing && phase <= 1);
	return { along, landing };
}

function terracePassages(
	column: number,
	row: number,
	bank: number,
	slope: number,
	site: Site,
	steep: boolean,
	promenade: boolean,
	profile: Profile
) {
	const span = steep ? profile.terraceRows : BLOCK.rows;
	const lane = column % BLOCK.columns;
	const { along, landing } = landingAt(lane, row % span, promenade);
	const phase = row % BLOCK.rows;
	const flight = stairFlight(site.zone, row, bank, lane, slope, phase, profile);
	// A transverse passage meets the next terrace at a different frontage.
	const crossLane = row > bank ? (Math.floor(row / BLOCK.rows) % 3) * 2 : 0;
	const across = lane === crossLane || flight;
	return { along, across, flight, landing, phase };
}

function onPromenade(terrain: Terrain, site: Site, profile: Profile) {
	const offsets = site.corners.map(([x, y]) => bankDistance(terrain, x, y) - profile.bankSetback);
	return (
		Math.min(...offsets) <= profile.promenadeWidth / 2 &&
		Math.max(...offsets) >= -profile.promenadeWidth / 2
	);
}

function directionAt(along: boolean, across: boolean): 'along' | 'across' | 'both' | null {
	if (along) return across ? 'both' : 'along';
	return across ? 'across' : null;
}

function riverCrossing(
	terrain: Terrain,
	column: number,
	row: number,
	bank: number,
	profile: Profile
) {
	const crossing = Math.round(terrain.creekAlong / (MODULE * BLOCK.columns)) * BLOCK.columns;
	return (
		column === crossing &&
		row * MODULE <= bank * MODULE &&
		row * MODULE >= terrain.bands.riverStart - profile.bankSetback
	);
}
function nodeSquare(site: Site, column: number, phase: number, profile: Profile) {
	return (
		site.pattern === 'fan' &&
		Math.min(column % BLOCK.columns, BLOCK.columns - (column % BLOCK.columns)) <=
			profile.squareRadius &&
		Math.min(phase, BLOCK.rows - phase) <= profile.squareRadius
	);
}
function routeKind(
	direction: ReturnType<typeof directionAt>,
	footbridge: boolean,
	bank: boolean,
	along: boolean,
	stair: boolean
) {
	if (!direction) return null;
	if (footbridge) return 'footbridge';
	if (stair) return 'stairAlley';
	if (bank) return 'riversidePromenade';
	return along ? 'mainAlley' : 'alley';
}

function openGround(site: Site, slope: number, profile: Profile) {
	return (
		site.zone === 'water' || slope > profile.ravineGrade || site.incision > profile.ravineDepth
	);
}

function isStairRoute(flight: boolean, steep: boolean, across: boolean, column: number) {
	return flight || (steep && across && column % (2 * BLOCK.columns) === 0);
}

function sidePassage(square: boolean, landing: boolean, across: boolean) {
	return !square && !landing && !across;
}

function alleyWidth(kind: ReturnType<typeof routeKind>, landing: boolean, profile: Profile) {
	if (!kind) return 0;
	return {
		riversidePromenade: profile.promenadeWidth,
		mainAlley: landing ? profile.mainAlleyWidth : profile.passageWidth,
		alley: profile.alleyWidth,
		stairAlley: profile.stairAlleyWidth,
		footbridge: profile.footbridgeWidth
	}[kind];
}

/** Cost in adjusted meters for following or joining the carrier's circulation survey.
 * The arterial avoids stairs and prefers main-alley frontage. Local links admit stair alleys. */
export function corridorCost(
	from: TerrainCell,
	to: TerrainCell,
	side: number,
	kind: 'arterial' | 'street' | 'alley',
	profile: Profile
) {
	const [x, y, z] = from.center;
	const distance = Math.hypot(to.center[0] - x, to.center[1] - y);
	const grade = Math.abs(to.center[2] - z) / distance;
	const reciprocal = to.neighbors.indexOf(from.id);
	const surveyed = followsAlley(from, side, kind) || followsAlley(to, reciprocal, kind);
	const contour = from.pattern === 'contour' || to.pattern === 'contour';
	const penalty = kind === 'arterial' ? 4 : 2;
	const climb = contour && side % 2 === 0 ? Math.min(1, grade / profile.steepGrade) : 0;
	const stair = kind === 'arterial' && grade >= profile.steepGrade;
	return distance * ((surveyed ? 0.72 : 1) + penalty * grade + climb + Number(stair));
}

function followsAlley(cell: TerrainCell, side: number, kind: 'arterial' | 'street' | 'alley') {
	if (side < 0 || !(cell.alleyEdges & (1 << side))) return false;
	const { direction, stairAlley } = cell.plan;
	if (stairAlley && kind === 'arterial') return false;
	return direction === 'both' || direction === (side % 2 ? 'along' : 'across');
}

/** Nominal corridor width in meters, using the carrier's circulation profile. */
export function groundRouteWidth(kind: 'arterial' | 'street' | 'alley', profile: Profile) {
	return {
		arterial: profile.mainAlleyWidth,
		street: profile.passageWidth,
		alley: profile.alleyWidth
	}[kind];
}
