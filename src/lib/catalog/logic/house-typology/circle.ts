type XY = [number, number];
type Circle = { position: [number, number, number]; radius: number };
/** Minimum separating translation for two upright circular cylinders in plan. */
export function circleDepth(a: Circle, b: Circle) {
	return (
		a.radius + b.radius - Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1])
	);
}
/** Separating axes of a disc and a convex polygon, including the nearest corner axis. */
export function discDepth(disc: Circle, face: XY[]) {
	const [x, y] = disc.position;
	let depth = Infinity;
	const axis = (u: number, v: number) => {
		const n = Math.hypot(u, v);
		if (n < 1e-10) return;
		const s = u / n,
			t = v / n,
			c = x * s + y * t,
			values = face.map(([a, b]) => a * s + b * t);
		depth = Math.min(
			depth,
			c + disc.radius - Math.min(...values),
			Math.max(...values) - c + disc.radius
		);
	};
	let closest = face[0];
	face.forEach((p, i) => {
		const q = face[(i + 1) % face.length];
		axis(q[1] - p[1], p[0] - q[0]);
		if (Math.hypot(p[0] - x, p[1] - y) < Math.hypot(closest[0] - x, closest[1] - y)) closest = p;
	});
	axis(closest[0] - x, closest[1] - y);
	return depth;
}
