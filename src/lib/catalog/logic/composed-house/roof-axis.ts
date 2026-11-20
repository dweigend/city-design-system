type XY = [number, number];

/** Returns the longest directed edge of a convex roof footprint in world metres. */
export function roofAxis(ring: XY[]) {
	const edges = ring.map((p, i) => {
		const next = ring[(i + 1) % ring.length];
		return [next[0] - p[0], next[1] - p[1]] as XY;
	});
	return edges.reduce((a, b) => (Math.hypot(...a) > Math.hypot(...b) ? a : b));
}

function mean(points: XY[]): XY {
	return points.reduce(
		([x, y], p): XY => [x + p[0] / points.length, y + p[1] / points.length],
		[0, 0]
	);
}

// The ridge joins points inside the two ends of the convex deck, keeping every rib inside the parcel.
/** Maps deck corners to a short interior ridge along the long roof edge. */
export function ridge(ring: XY[], form: 'taper' | 'capsule') {
	const [dx, dy] = roofAxis(ring);
	const along = ([x, y]: XY) => x * dx + y * dy;
	const order = [...ring].sort((a, b) => along(a) - along(b));
	const start = along(order[0]),
		end = along(order[order.length - 1]),
		span = end - start;
	const left = mean(order.filter((p) => along(p) - start < span * 0.05));
	const right = mean(order.filter((p) => end - along(p) < span * 0.05));
	const fraction = { taper: 0.18, capsule: 0.38 }[form];
	return (p: XY): XY => {
		const u = 0.5 + fraction * ((along(p) - start) / span - 0.5);
		return [left[0] + u * (right[0] - left[0]), left[1] + u * (right[1] - left[1])];
	};
}
