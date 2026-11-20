import type { Point } from './types';

type XY = [number, number];

/** Chamfers a block footprint and optionally opens its rear edge to the shared ladder recess. */
export function blockOutline(
	center: Point,
	width: number,
	depth: number,
	sign: number,
	entry?: { x: number; halfWidth: number; depth: number },
	rounded = false
): XY[] {
	const left = center[0] - width / 2,
		right = left + width;
	const rear = center[1] + (sign * depth) / 2;
	const r = Math.min(rounded ? 0.45 : 0.15, width / 5, depth / 5);
	const cut = entry
		? [
				[entry.x - entry.halfWidth, 0],
				[entry.x - entry.halfWidth, entry.depth],
				[entry.x + entry.halfWidth, entry.depth],
				[entry.x + entry.halfWidth, 0]
			]
		: [];
	const corner = (x: number, y: number, angle: number) => {
		const steps = rounded ? 4 : 1;
		return Array.from({ length: steps + 1 }, (_, i) => {
			const t = angle + (i * Math.PI) / (2 * steps);
			return [x + r * Math.cos(t), y + r * Math.sin(t)];
		});
	};
	return [
		[left + r, 0],
		...cut,
		...corner(right - r, r, -Math.PI / 2),
		...corner(right - r, depth - r, 0),
		...corner(left + r, depth - r, Math.PI / 2),
		...corner(left + r, r, Math.PI).slice(0, -1)
	].map(([x, v]) => [x, rear - sign * v]);
}
