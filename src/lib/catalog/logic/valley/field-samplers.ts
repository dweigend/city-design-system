import type { ValleyField } from './field';

/** Tests whether a finite world XY coordinate in meters lies in the closed field window. */
export function contains(field: ValleyField, x: number, y: number): boolean {
	const half = field.windowM / 2;
	return Math.abs(x) <= half && Math.abs(y) <= half;
}

function sample(field: ValleyField, mm: Int32Array, x: number, y: number): number {
	if (!contains(field, x, y)) {
		throw Object.assign(new RangeError('outside-window'), { code: 'outside-window' });
	}
	const half = field.windowM / 2;
	const column = (x + half) / field.spacingM;
	const row = (half - y) / field.spacingM;
	const x0 = Math.floor(column);
	const y0 = Math.floor(row);
	const stride = field.windowM / field.spacingM + 1;
	const i = y0 * stride + x0;
	const dx = column - x0;
	const dy = row - y0;
	const east = dx ? 1 : 0;
	const south = dy ? stride : 0;
	const northMm = mm[i] + (mm[i + east] - mm[i]) * dx;
	const southMm = mm[i + south] + (mm[i + south + east] - mm[i + south]) * dx;
	return (northMm + (southMm - northMm) * dy) / 1000;
}

/** Returns bilinearly interpolated bed height in meters or throws outside-window. */
export function groundAt(field: ValleyField, x: number, y: number): number {
	return sample(field, field.bedMm, x, y);
}

/** Returns bilinearly interpolated mean water height in meters or throws outside-window. */
export function meanWaterAt(field: ValleyField, x: number, y: number): number {
	return sample(field, field.meanWaterMm, x, y);
}
