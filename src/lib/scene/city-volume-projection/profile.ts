import { levelHeight } from '../../domain/city-volume';

const profileLaw = {
	peakFrameShare: 0.1,
	// Detail transitions are in true meters per CSS pixel.
	detail: [0.65, 2.7],
	uprights: [1.2, 4.3],
	rims: [1.9, 5.15],
	height: [0.65, 3.15],
	envelope: [0.85, 4.55]
} as const;

function fade(value: number, [start, end]: readonly [number, number]) {
	const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
	return t * t * (3 - 2 * t);
}

/** Smooth detail weights and vertical scale for a fitted city. At a broad view the projected
 * peak is one tenth of the frame width. The terrain and foundations stay fixed below the pivot. */
export function cityProfile(
	width: number,
	metersPerPixel: number,
	peak: number,
	elevation: number,
	trueScale: boolean
) {
	const pivotAboveDatum = levelHeight / 2;
	const fullScale = Math.max(
		1,
		((width * profileLaw.peakFrameShare) / Math.cos(elevation) - pivotAboveDatum) /
			Math.max(2.5 * levelHeight, peak - pivotAboveDatum)
	);
	return {
		factor: trueScale ? 1 : 1 + (fullScale - 1) * fade(metersPerPixel, profileLaw.height),
		detail: 1 - fade(metersPerPixel, profileLaw.detail),
		uprights: 1 - fade(metersPerPixel, profileLaw.uprights),
		rims: 1 - fade(metersPerPixel, profileLaw.rims),
		envelope: fade(metersPerPixel, profileLaw.envelope),
		pivotAboveDatum
	};
}
