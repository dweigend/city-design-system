import { Body, Spring, Vec3 } from 'cannon-es';

/** Uniform gauge pressure in kPa, in-plane tension in kN/m, and the lines restraining the cloth. */
export type Membrane = {
	pressure: number;
	tension: number;
	restraint: 'straps' | 'net' | 'hoops';
};

// Eight intervals put both crossed ties and the cut opening on mesh vertices.
export const yarnIntervals = 8;
const dt = 1 / 60;
const iterations = 64;
const cache = new Map<string, Float64Array>();

function fixed(i: number, j: number, cols: number, restraint: Membrane['restraint']) {
	if (!i || i === cols || !j || j === yarnIntervals) return true;
	if (restraint === 'straps') return i % yarnIntervals === 0;
	return restraint === 'net' && ((2 * i + j) % 16 === 0 || (2 * i - j) % 16 === 0);
}

/** A welded slit removes these quads from both the pressure load and the visible cloth. */
export function yarnOpening(i: number, j: number) {
	return i % yarnIntervals === 3 && j % yarnIntervals >= 2 && j % yarnIntervals <= 5;
}

function lattice(fabric: Membrane, cols: number, dx: number, dy: number) {
	const bodies: Body[] = [];
	// Relaxation mass bounds acceleration along the stiffest yarn for the fixed time step.
	const mass = 8 * dt ** 2 * fabric.tension * (dx / dy + dy / dx);
	for (let j = 0; j <= yarnIntervals; j++)
		for (let i = 0; i <= cols; i++)
			bodies.push(
				new Body({
					mass: fixed(i, j, cols, fabric.restraint) ? 0 : mass,
					position: new Vec3(i * dx, j * dy, 0),
					linearFactor: new Vec3(0, 0, 1)
				})
			);
	return bodies;
}

function patch(fabric: Membrane, cols: number, dx: number, dy: number, bodies: Body[]) {
	const springs: Spring[] = [],
		loads = new Float64Array(bodies.length);
	function yarn(a: number, b: number, stiffness: number) {
		const length = bodies[a].position.distanceTo(bodies[b].position);
		const spring = new Spring(bodies[a], bodies[b], { restLength: length * 0.5, stiffness });
		spring.damping = 0;
		springs.push(spring);
	}
	for (let j = 0; j < yarnIntervals; j++)
		for (let i = 0; i < cols; i++) {
			if (yarnOpening(i, j)) continue;
			const a = j * (cols + 1) + i,
				b = a + cols + 1;
			// Adjacent quads each supply half the yarn across a shared edge.
			yarn(a, a + 1, (fabric.tension * dy) / dx);
			yarn(b, b + 1, (fabric.tension * dy) / dx);
			yarn(a, b, (fabric.tension * dx) / dy);
			yarn(a + 1, b + 1, (fabric.tension * dx) / dy);
			// Each triangle contributes a third of its normal pressure force to each vertex.
			const force = (fabric.pressure * dx * dy) / 6;
			for (const k of [a, a + 1, b + 1, a, b + 1, b]) loads[k] += force;
		}
	return { springs, loads };
}

/** Bakes the pressure-loaded yarn network in metres at one course between pinned seam rows. */
export function solveYarns(fabric: Membrane, cols: number, width: number, height: number) {
	const key = [fabric.restraint, fabric.pressure, fabric.tension, cols, width, height].join('/');
	const saved = cache.get(key);
	if (saved) return saved;
	const dx = width / cols,
		dy = height / yarnIntervals;
	const bodies = lattice(fabric, cols, dx, dy);
	const { springs, loads } = patch(fabric, cols, dx, dy, bodies);
	for (let step = 0; step < iterations; step++) {
		for (const spring of springs) spring.applyForce();
		for (const [i, body] of bodies.entries()) {
			body.force.z += loads[i];
			body.velocity.z *= 0.76;
			body.integrate(dt, false, false);
			body.force.setZero();
		}
	}
	const result = Float64Array.from(bodies, (b) => Math.max(0, b.position.z));
	if (cache.size >= 128) cache.clear();
	cache.set(key, result);
	return result;
}
