export type Point = { x: number; y: number };

export function pointAt(xy: ArrayLike<number>, index: number): Point {
	return { x: xy[index], y: xy[index + 1] };
}

export function distance(from: Point, to: Point): number {
	return Math.hypot(to.x - from.x, to.y - from.y);
}

export function polylineLength(xy: ArrayLike<number>): number {
	if (!Number.isInteger(xy.length) || xy.length < 4 || xy.length % 2 !== 0) {
		throw new RangeError('invalid-polyline');
	}

	let from = pointAt(xy, 0);
	let length = 0;
	for (let index = 2; index < xy.length; index += 2) {
		const to = pointAt(xy, index);
		const edgeLength = distance(from, to);
		if (edgeLength === 0 || !Number.isFinite(edgeLength)) {
			throw new RangeError('invalid-polyline');
		}
		length += edgeLength;
		from = to;
	}
	if (!Number.isFinite(length)) throw new RangeError('invalid-polyline');
	return length;
}
