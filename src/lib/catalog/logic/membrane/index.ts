import { clothIntervals, simulateCloth, type Membrane } from './cloth';

const parabola = (u: number) => 4 * u * (1 - u);

function cableSpan(u: number, z: number, width: number, fabric: Membrane) {
	if (fabric.restraint === 'hoops') return width * width * parabola(u);
	const ribs = Math.max(1, Math.round(width / (fabric.restraint === 'net' ? 6 : 9)));
	// Diagonal ties cross between hoop levels. Boundary seams always remain pinned.
	const phase = fabric.restraint === 'net' ? 0.5 * z : 0;
	const wave = (u * ribs + phase) % 1;
	const crossing = (u * ribs - phase + 1) % 1;
	return (width / ribs) ** 2 * Math.min(parabola(wave), parabola(crossing), parabola(u) * ribs);
}
/** Number of horizontal cloth intervals across one surveyed panel. */
export function clothColumns(width: number, restraint: Membrane['restraint']) {
	return clothIntervals * Math.max(1, Math.round(width / (restraint === 'net' ? 6 : 9)));
}

function sampleDisplacement(fabric: Membrane, width: number, span: number, u: number, v: number) {
	const cols = clothColumns(width, fabric.restraint);
	const field = simulateCloth(fabric, cols, width, span);
	const x = u * cols,
		y = v * clothIntervals;
	const i = Math.min(cols - 1, Math.floor(x)),
		j = Math.min(clothIntervals - 1, Math.floor(y));
	const row = (r: number) => {
		const a = r * (cols + 1) + i;
		return field[a] + (field[a + 1] - field[a]) * (x - i);
	};
	return row(j) + (row(j + 1) - row(j)) * (y - j);
}

/** Resolves normal deflection in metres and gravitational sag for a uniformly loaded, biaxially tensioned bay. */
export function membraneResponse(
	fabric: Membrane,
	width: number,
	span: number,
	u: number,
	v: number,
	clearance: number,
	free = sampleDisplacement(fabric, width, span, u, v)
) {
	const horizontal = cableSpan(u, v, width, fabric);
	const shareOfBay = Math.min(horizontal / (width * width), parabola(v));
	// Dead load of fabric per square metre in kN. The small-slope sag is bounded inside its tie interval.
	const sag =
		(Math.min(span * 0.18, (0.025 * width * width) / (8 * fabric.tension)) * shareOfBay) /
		(1 + fabric.pressure);
	const fraction = clearance > 1e-8 ? -Math.expm1(-free / clearance) : 0;
	return { fraction, sag };
}

export { clothIntervals, clothOpening, simulateCloth } from './cloth';

export type { Membrane } from './cloth';

export { hangingCloth } from './drape';

export { tensionPatch } from './tension-patch';
