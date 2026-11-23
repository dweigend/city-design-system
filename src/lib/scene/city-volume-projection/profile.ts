import { levelHeight } from '../../domain/city-volume';

const profileLaw = {
	peakFrameShare: 0.1,
	townFrameShare: 0.024,
	peakTransition: [3 * levelHeight, 6 * levelHeight],
	// Detail transitions are in true meters per CSS pixel.
	detail: [0.7, 3.2],
	uprights: [1.55, 3.65],
	rims: [2.2, 3.85],
	height: [0.7, 3.15],
	envelope: [1.25, 3.85]
} as const;

function fade(value: number, [start, end]: readonly [number, number]) {
	const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
	return t * t * (3 - 2 * t);
}

/** Smooth detail weights and vertical scale for a fitted city. At a broad view the projected
 * city peak is one tenth of the frame width, with a gentler target for towns. The terrain and foundations stay fixed below the pivot. */
export function cityProfile(
	width: number,
	metersPerPixel: number,
	peak: number,
	elevation: number,
	trueScale: boolean
) {
	const pivotAboveDatum = levelHeight;
	const target =
		profileLaw.townFrameShare +
		(profileLaw.peakFrameShare - profileLaw.townFrameShare) * fade(peak, profileLaw.peakTransition);
	const fullScale = Math.max(
		1,
		((width * target) / Math.cos(elevation) - pivotAboveDatum) /
			Math.max(2 * levelHeight, peak - pivotAboveDatum)
	);
	return {
		factor:
			trueScale || peak <= pivotAboveDatum
				? 1
				: 1 + (fullScale - 1) * fade(metersPerPixel, profileLaw.height),
		detail: 1 - fade(metersPerPixel, profileLaw.detail),
		uprights: 1 - fade(metersPerPixel, profileLaw.uprights),
		rims: 1 - fade(metersPerPixel, profileLaw.rims),
		envelope: fade(metersPerPixel, profileLaw.envelope),
		pivotAboveDatum
	};
}
