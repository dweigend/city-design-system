import { family, block, row, slope } from './assembly';
import { drum, energy, path } from './parts';
const asset = family('house-fittings', 'roof');
export const roofMachinery = [
	asset('fan-bank', [4, 2], (factor) => {
		const lid = 0.74 * factor;
		return [
			block(0, 0, 0, 3.8, 1.7, lid, energy),
			...row(3, (t) => drum([t * 1.19, 0, lid], 0.49, 0.09, path)),
			...[-1.19, 0, 1.19].flatMap((x) =>
				row(4, (_, i) => {
					const angle = (i * Math.PI) / 2;
					return slope(
						x + 0.23 * Math.cos(angle),
						0.23 * Math.sin(angle),
						lid + 0.09,
						0.42,
						0.18,
						0.07,
						angle
					);
				})
			)
		];
	})
];
