import { millimetersPerMeter } from './millimeters';
import { defaults } from './settings';
import type { Vec2 } from '../../core/geometry';

const { catchmentCellSizeM, catchmentGridSideNodes, catchmentSlopeCapMmPerM } = defaults;

export const spacing = catchmentCellSizeM;
export const side = catchmentGridSideNodes;
export const radius = (spacing * (side - 1)) / 2;

export function position(index: number): Vec2 {
	return [(index % side) * spacing - radius, Math.floor(index / side) * spacing - radius];
}

export function vertex(x: number, y: number) {
	return (
		Math.max(0, Math.min(side - 1, Math.round((x + radius) / spacing))) +
		side * Math.max(0, Math.min(side - 1, Math.round((y + radius) / spacing)))
	);
}

/** Interpolates along the same diagonal used by the receiver graph. */
export function triangle(x: number, y: number) {
	const u = (x + radius) / spacing;
	const v = (y + radius) / spacing;
	const i = Math.min(side - 2, Math.floor(u));
	const j = Math.min(side - 2, Math.floor(v));
	const a = j * side + i;
	const c = a + side + 1;
	const s = u - i;
	const t = v - j;
	return s >= t
		? { a, b: a + 1, c, wa: 1 - s, wb: s - t, wc: t }
		: { a, b: a + side, c, wa: 1 - t, wb: t - s, wc: s };
}

export function interpolate(bed: Int32Array, { a, b, c, wa, wb, wc }: ReturnType<typeof triangle>) {
	return (bed[a] * wa + bed[b] * wb + bed[c] * wc) / millimetersPerMeter;
}

export function limitSlopes(bed: Int32Array) {
	const rise = spacing * catchmentSlopeCapMmPerM;
	for (let y = 0; y < side; y++) {
		const start = y * side;
		for (let x = 1; x < side; x++) {
			const i = start + x;
			bed[i] = Math.min(bed[i], bed[i - 1] + rise);
		}
		for (let x = side - 2; x >= 0; x--) {
			const i = start + x;
			bed[i] = Math.min(bed[i], bed[i + 1] + rise);
		}
	}
	for (let i = side; i < bed.length; i++) bed[i] = Math.min(bed[i], bed[i - side] + rise);
	for (let i = bed.length - side - 1; i >= 0; i--) bed[i] = Math.min(bed[i], bed[i + side] + rise);
}
