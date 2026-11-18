import { townDefaults } from '../../data/sandbox';
import { hashUnit } from '../parzelle';
import type { QuadCell } from '../quad-grid';
import type { Terrain, TerrainZone } from '../terrain';
import { BLOCK, MODULE } from './contour-rows';
import type { Pattern } from './patterns';

import { defaultAlleyPlan } from './alley-profile';
type Profile = typeof defaultAlleyPlan;
type Site = { corners: QuadCell['corners']; zone: TerrainZone; pattern: Pattern; incision: number };

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
	const along = row === bank || row % (steep ? profile.terraceRows : BLOCK.rows) === 0;
	const phase = row % BLOCK.rows;
	const across = column % BLOCK.columns === 0;
	const square = nodeSquare(site, column, phase, profile);
	const open =
		site.zone === 'water' || grade(b) > profile.ravineGrade || site.incision > profile.ravineDepth;
	const extent = settlementExtent(terrain, column, row, profile);
	const direction =
		footbridge || (!open && extent > 0) ? directionAt(along, across || footbridge) : null;
	const kind = routeKind(
		direction,
		footbridge,
		row === bank,
		along,
		steep && across && column % (2 * BLOCK.columns) === 0
	);
	const widths = {
		riversidePromenade: profile.promenadeWidth,
		mainAlley: profile.mainAlleyWidth,
		alley: profile.alleyWidth,
		stairAlley: profile.stairAlleyWidth,
		footbridge: profile.footbridgeWidth
	};
	return {
		direction,
		kind,
		width: kind ? widths[kind] : 0,
		extent,
		footbridge,
		square: square && !open && extent > 0,
		open,
		stairAlley: kind === 'stairAlley'
	};
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
