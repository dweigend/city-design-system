import { levelHeight } from '../../domain/city-volume';

const profileLaw = {
	peakFrameShare: 0.1,
	townFrameShare: 0.014,
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

/** Camera elevation in radians for a true horizontal frame width in meters. */
export function cityElevation(relief: number, widthM = Infinity) {
	const quarter = 18;
	const wholeCity = 24 + 38 * relief;
	return ((quarter + (wholeCity - quarter) * fade(widthM, [500, 2300])) * Math.PI) / 180;
}

/** Smooth detail weights and vertical scale for a fitted city. At a broad view the projected
 * city peak is one tenth of the frame width, with a gentler target for towns. The caller applies the same capped scale to terrain and city. */
export function cityProfile(
	width: number,
	metersPerPixel: number,
	peak: number,
	elevation: number,
	trueScale: boolean,
	maxScale = Infinity
) {
	const target =
		profileLaw.townFrameShare +
		(profileLaw.peakFrameShare - profileLaw.townFrameShare) * fade(peak, profileLaw.peakTransition);
	const fullScale = Math.max(
		1,
		(width * target) / (Math.cos(elevation) * Math.max(levelHeight, peak))
	);
	return {
		factor:
			trueScale || peak <= 0
				? 1
				: 1 + (Math.min(maxScale, fullScale) - 1) * fade(metersPerPixel, profileLaw.height),
		detail: 1 - fade(metersPerPixel, profileLaw.detail),
		uprights: 1 - fade(metersPerPixel, profileLaw.uprights),
		rims: 1 - fade(metersPerPixel, profileLaw.rims),
		envelope: fade(metersPerPixel, profileLaw.envelope),
		/** Share of the taper shown: none while member detail is drawn, all once it is gone. */
		taper: fade(metersPerPixel, profileLaw.detail)
	};
}
