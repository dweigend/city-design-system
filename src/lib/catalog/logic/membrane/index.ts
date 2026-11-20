/** Uniform gauge pressure in kPa, in-plane tension in kN/m, and the lines restraining the cloth. */
export type Membrane = {
	pressure: number;
	tension: number;
	restraint: 'straps' | 'net' | 'hoops';
};

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
/** Resolves normal deflection in metres and gravitational sag for a uniformly loaded, biaxially tensioned bay. */
export function membraneResponse(
	fabric: Membrane,
	width: number,
	span: number,
	u: number,
	v: number,
	clearance: number
) {
	const horizontal = cableSpan(u, v, width, fabric);
	const vertical = span * span * parabola(v);
	const shareOfBay = Math.min(horizontal / (width * width), parabola(v));
	// Dead load of fabric per square metre in kN. The small-slope sag is bounded inside its tie interval.
	const sag =
		(Math.min(span * 0.18, (0.025 * width * width) / (8 * fabric.tension)) * shareOfBay) /
		(1 + fabric.pressure);
	const compliance = horizontal > 0 && vertical > 0 ? 1 / (1 / horizontal + 1 / vertical) : 0;
	const free = (fabric.pressure * compliance) / (8 * fabric.tension);
	const fraction = clearance > 1e-8 ? -Math.expm1(-free / clearance) : 0;
	return { fraction, sag };
}
