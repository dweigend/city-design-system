import type { QuadCell } from '../quad-grid';
import type { Terrain, TerrainZone } from '../terrain';
import { BLOCK, MODULE } from './contour-rows';
import type { Pattern } from './patterns';

import { defaultStreetPlan } from './street-profile';
type Profile = typeof defaultStreetPlan;
type Site = { corners: QuadCell['corners']; zone: TerrainZone; pattern: Pattern; incision: number };

/** Classifies the circulation and reserved ground at a stable lattice address. */
export function streetPlan(
	terrain: Terrain,
	column: number,
	row: number,
	site: Site,
	profile = defaultStreetPlan
) {
	const [a, b, , d] = site.corners;
	const grade = (p: typeof a) => Math.abs(p[2] - a[2]) / Math.hypot(p[0] - a[0], p[1] - a[1]);
	const bank = Math.round((terrain.bands.riverEnd + profile.bankSetback) / MODULE);
	const bridge = riverCrossing(terrain, column, row, bank, profile);
	const steep = grade(d) >= profile.steepGrade;
	const along = row === bank || row % (steep ? profile.terraceRows : BLOCK.rows) === 0;
	const phase = row % BLOCK.rows;
	const across = column % BLOCK.columns === 0;
	const square = nodeSquare(site, column, phase, profile);
	const open =
		site.zone === 'water' || grade(b) > profile.ravineGrade || site.incision > profile.ravineDepth;
	const direction = bridge || !open ? directionAt(along, across || bridge) : null;
	const width = streetWidth(row === bank, along, steep, profile);
	return {
		direction,
		width: direction ? width : 0,
		bridge,
		square: square && !open,
		open,
		stairs: !!direction && steep && across && column % (2 * BLOCK.columns) === 0
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
function streetWidth(bank: boolean, along: boolean, steep: boolean, profile: Profile) {
	return bank
		? profile.riverWidth
		: along
			? profile.mainWidth
			: steep
				? profile.stairWidth
				: profile.alleyWidth;
}
