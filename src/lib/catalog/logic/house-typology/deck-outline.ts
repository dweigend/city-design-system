type XY = [number, number];
function inside(x: number, y: number, ring: XY[]) {
	let value = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const a = ring[i],
			b = ring[j];
		if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
			value = !value;
	}
	return value;
}

/** Fits a centred rectangular reservation in a deck polygon and clears every opening, in metres. */
export function roomOnDeck(ring: XY[], holes: XY[][], x: number, y: number, w: number, d: number) {
	if (!inside(x, y, ring) || holes.some((h) => inside(x, y, h))) return false;
	return [ring, ...holes].every((r) =>
		r.every(([a, b], i) => {
			const [u, v] = r[(i + 1) % r.length];
			if (
				Math.max(a, u) <= x - w ||
				Math.min(a, u) >= x + w ||
				Math.max(b, v) <= y - d ||
				Math.min(b, v) >= y + d
			)
				return true;
			const dx = u - a,
				dy = v - b;
			return Math.abs(dx * (y - b) - dy * (x - a)) > Math.abs(dx) * d + Math.abs(dy) * w;
		})
	);
}
