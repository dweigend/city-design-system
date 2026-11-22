import type { TerrainField } from '../surface';

function slopeAt(field: TerrainField, x: number, y: number) {
	const { columns, rows, width, depth, samples } = field;
	const u = (x / width + 0.5) * (columns - 1);
	const v = (y / depth + 0.5) * (rows - 1);
	const col = Math.max(0, Math.min(columns - 2, Math.floor(u)));
	const row = Math.max(0, Math.min(rows - 2, Math.floor(v)));
	const a = (row * columns + col) * 4;
	const b = a + columns * 4;
	const gradient = (channel: number) => {
		const low =
			samples[a + channel] + (samples[a + channel + 4] - samples[a + channel]) * (u - col);
		const high =
			samples[b + channel] + (samples[b + channel + 4] - samples[b + channel]) * (u - col);
		return low + (high - low) * (v - row);
	};
	return Math.hypot(gradient(1), gradient(2));
}

/** Redistributes a fixed number of cross-section vertices towards the terrace risers. */
export function slopeSpacing(
	field: TerrainField,
	x: number,
	from: number,
	to: number,
	count: number
) {
	const steps = Math.max(1, Math.ceil((to - from) / 10));
	const width = (to - from) / steps;
	const mass = [0];
	for (let i = 0; i < steps; i++) {
		const slope = slopeAt(field, x, from + (i + 0.5) * width);
		const density = 1 + 7 * Math.max(0, Math.min(1, (slope - 0.023) / 0.079));
		mass.push(mass[i] + density);
	}
	const positions = [];
	let cell = 0;
	for (let i = 1; i < count; i++) {
		const target = (mass[steps] * i) / count;
		while (mass[cell + 1] < target) cell++;
		const fraction = (target - mass[cell]) / (mass[cell + 1] - mass[cell]);
		positions.push(from + (cell + fraction) * width);
	}
	return [...positions, to];
}
