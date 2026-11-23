import type { Random } from '../../core/random';
import { smoothstep } from './regional-profile';

function massif(random: Random, x: number, y: number, height: number) {
	const centerX = x + random.number({ min: -660, max: 660 });
	const centerY = y + random.number({ min: -660, max: 660 });
	const radiusX = random.number({ min: 620, max: 1450 });
	const radiusY = random.number({ min: 620, max: 1450 });
	const bearing = random.number({ min: 0, max: Math.PI });
	const amplitude = height * random.number({ min: 0.25, max: 0.85 });
	return {
		centerX,
		centerY,
		cos: Math.cos(bearing),
		sin: Math.sin(bearing),
		radiusX,
		radiusY,
		amplitude
	};
}

export function peakHeightM(relief: number) {
	return 400 * relief ** 1.3;
}

export function uplifts(random: Random, relief: number) {
	if (relief === 0) return () => 0;
	const height = peakHeightM(relief);
	const spacing = 1750;
	const side = 9;
	const offset = (side - 1) / 2;
	const massifs = Array.from({ length: side * side }, (_, i) =>
		massif(
			random.derive(String(i)),
			((i % side) - offset) * spacing,
			(Math.floor(i / side) - offset) * spacing,
			height
		)
	);
	return (x: number, y: number, fromTrough: number) => {
		const gate = smoothstep((fromTrough - (510 - 280 * relief)) / 1030);
		if (!gate) return 0;
		const centerX = Math.max(0, Math.min(side - 1, Math.round(x / spacing) + offset));
		const centerY = Math.max(0, Math.min(side - 1, Math.round(y / spacing) + offset));
		let uplift = 0;
		for (let row = Math.max(0, centerY - 2); row <= Math.min(side - 1, centerY + 2); row++) {
			for (
				let column = Math.max(0, centerX - 2);
				column <= Math.min(side - 1, centerX + 2);
				column++
			) {
				const { centerX, centerY, cos, sin, radiusX, radiusY, amplitude } =
					massifs[row * side + column];
				const dx = x - centerX;
				const dy = y - centerY;
				const distance =
					((dx * cos + dy * sin) / radiusX) ** 2 + ((dy * cos - dx * sin) / radiusY) ** 2;
				const t = Math.max(0, 1 - distance / 4);
				uplift += amplitude * t ** 4;
			}
		}
		return uplift * gate;
	};
}
