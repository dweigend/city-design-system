import { hash } from '../hash-random';
import { BLOCK, MODULE, MAX_LEAN, smoothWeight as smooth, type Lattice } from './contour-rows';

export type Pattern = 'orthogonal' | 'contour' | 'irregular' | 'fan';

// Two civic squares along the lower terrace, separated by at least four blocks.
function focalColumn(seed: number, column: number) {
	const district = Math.floor(column / (7 * BLOCK.columns));
	return (district * 7 + 2 + Math.floor(hash(seed, district, 31) * 3) + 0.5) * BLOCK.columns;
}
function squareRow(lattice: Lattice) {
	return (
		(Math.floor((lattice.terrain.bands.terraceEdge + 48) / (MODULE * BLOCK.rows)) + 0.5) *
		BLOCK.rows
	);
}

/** Pattern of the block, classified at its nominal center before excavation. */
export function patternAt(lattice: Lattice, column: number, row: number): Pattern {
	const c = column - (column % BLOCK.columns) + BLOCK.columns / 2,
		r = row - (row % BLOCK.rows) + BLOCK.rows / 2;
	const bands = lattice.terrain.bands;
	if (
		Math.abs(c - focalColumn(lattice.terrain.seed, c)) <= BLOCK.columns &&
		r === squareRow(lattice)
	)
		return 'fan';
	if (r * MODULE < bands.terraceEdge) return 'irregular';
	if (
		r * MODULE < bands.scarpStart - 20 ||
		(r * MODULE > bands.scarpEnd + 18 && r * MODULE < bands.scarpEnd + 55)
	)
		return 'orthogonal';
	return 'contour';
}

// Displacements are in valley-frame meters. Waves bend whole floodplain lanes;
// the shorter, bounded jitter breaks up their individual parcels.
function irregular(seed: number, c: number, r: number) {
	const phase = hash(seed, 0, 32) * 2 * Math.PI,
		id = r * 65536 + c;
	return [
		5 * Math.sin(r * 0.29 + phase + c * 0.065) + 2 * (hash(seed, id, 33) - 0.5),
		4 * Math.sin(c * 0.34 + phase + r * 0.07) + 1.6 * (hash(seed, id, 34) - 0.5)
	];
}

/** Valley-frame displacement at a shared vertex, including the smooth district transitions. */
export function patternOffsets(
	lattice: Lattice,
	c: number,
	r: number,
	lean: number,
	shift: number
) {
	const { seed, bands } = lattice.terrain,
		y = r * MODULE;
	const contour = smooth((y - bands.scarpStart + 50) / 30);
	const flood = smooth((bands.terraceEdge + 12 - y) / 32);
	const rim = smooth(Math.min(c, lattice.columns - c, r, lattice.rows - r) / 4);
	const [jx, jy] = flood > 0 ? irregular(seed, c, r) : [0, 0];
	const x = (c - focalColumn(seed, c)) * MODULE,
		dy = (r - squareRow(lattice)) * MODULE;
	const weight =
		rim * (1 - smooth((Math.abs(x) - 28) / 48)) * (1 - smooth((Math.abs(dy) - 10) / 32));
	const phase = r % BLOCK.rows;
	const bend =
		(Math.min(phase, BLOCK.rows - phase) / (BLOCK.rows / 2)) *
		MODULE *
		lattice.profile.switchbackColumns;
	const displacement =
		contour * lean +
		rim * flood * jx +
		rim *
			bend *
			Math.sin((Math.PI * c) / (2 * BLOCK.columns)) ** 2 *
			smooth((y - bands.scarpStart) / lattice.profile.transitionWidth) *
			(1 - smooth((y - bands.scarpEnd) / lattice.profile.transitionWidth));
	const lateral = flood ? displacement : Math.max(-MAX_LEAN, Math.min(MAX_LEAN, displacement));
	// On flat terraces a contour alone gives a straight line. Offset adjoining
	// crossings together, fading the transverse bend where the scarp sets the grade.
	const phaseAngle = hash(seed, 0, 35) * 2 * Math.PI;
	const strength = rim * (1 - flood) * (1 - weight) * lattice.profile.alleyBend;
	const curvedX = lateral + strength * Math.sin(r * Math.PI / BLOCK.rows + c / BLOCK.columns + phaseAngle) * (1 - contour);
	const curvedY = shift + rim * flood * jy + strength * (1 - contour) * Math.sin(c * Math.PI / BLOCK.columns + r / BLOCK.rows + phaseAngle);
	if (weight === 0) return [curvedX, curvedY];
	const radius = 76 + dy,
		angle = x / 76;
	return [
		curvedX + weight * (radius * Math.sin(angle) - x),
		curvedY + weight * radius * (Math.cos(angle) - 1)
	];
}
