import type { RoofCell } from '../index';

/** A rectangular roof in the search fixture, in world meters. */
export function rect(id: string, x: number, y: number, w: number, h: number): RoofCell {
	return {
		id,
		height: 4,
		polygon: [
			[x, y],
			[x + w, y],
			[x + w, y + h],
			[x, y + h]
		]
	};
}
/** Asymmetric row with conflicting bridge bearings. */
export function reviewRow(n: number) {
	return [
		rect('a', 0, 0, 4, 12),
		rect('b', 0, -12.5, 4, 12),
		rect('c', 0, 12.5, 4, 12),
		...Array.from({ length: n - 3 }, (_, i) =>
			rect(String(i).padStart(2, '0'), -6.5 - 2.5 * i, 4, 2, 4)
		)
	];
}
/** Connected row of equally spaced roofs. */
export function connectedRow(n: number) {
	return Array.from({ length: n }, (_, i) => rect(String(i).padStart(2, '0'), i * 5, 0, 2, 4));
}
