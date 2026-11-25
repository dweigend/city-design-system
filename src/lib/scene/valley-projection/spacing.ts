import { defaults } from '../../../config/valley-projection';
import type { TerrainField } from '../surface';

function slopeAt(field: TerrainField, x: number, y: number) {
	const { columns, rows, width, depth, samples } = field;
	const u = (x / width + 0.5) * (columns - 1);
	const v = (y / depth + 0.5) * (rows - 1);
	const col = Math.max(
		0,
		Math.min(
			columns - /* Exact arithmetic: interpolation cell needs a second column. */ 2,
			Math.floor(u)
		)
	);
	const row = Math.max(
		0,
		Math.min(rows - /* Exact arithmetic: interpolation cell needs a second row. */ 2, Math.floor(v))
	);
	const channels = /* Exact arithmetic: RGBA channels per texel. */ 4;
	const a = (row * columns + col) * channels;
	const b = a + columns * channels;
	const gradient = (channel: number) => {
		const low =
			samples[a + channel] + (samples[a + channel + channels] - samples[a + channel]) * (u - col);
		const high =
			samples[b + channel] + (samples[b + channel + channels] - samples[b + channel]) * (u - col);
		return low + (high - low) * (v - row);
	};
	return Math.hypot(
		gradient(/* Exact arithmetic: X gradient channel. */ 1),
		gradient(/* Exact arithmetic: Y gradient channel. */ 2)
	);
}

/** Redistributes a fixed number of cross-section vertices towards the terrace risers. */
export function slopeSpacing(
	field: TerrainField,
	x: number,
	from: number,
	to: number,
	count: number
) {
	const steps = Math.max(1, Math.ceil((to - from) / defaults.valleySlopeSampleStepM));
	const width = (to - from) / steps;
	const mass = /* Exact arithmetic: the cumulative integral begins at zero. */ [0];
	for (let i = 0; i < steps; i++) {
		const slope = slopeAt(field, x, from + (i + 0.5) * width);
		const density =
			1 +
			defaults.valleySlopeDensityGain *
				Math.max(
					0,
					Math.min(1, (slope - defaults.valleySlopeDensityStart) / defaults.valleySlopeDensityRange)
				);
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
