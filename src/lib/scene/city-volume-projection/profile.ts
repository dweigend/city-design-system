import { levelHeight } from '../../domain/city-volume';
import {
	cityElevationFlatDeg,
	cityElevationPerReliefDeg,
	cityElevationRangeM,
	detailFadeMPerPx,
	envelopeFadeMPerPx,
	heightFadeMPerPx,
	peakFrameShare,
	peakTransitionLevels,
	quarterElevationDeg,
	rimFadeMPerPx,
	taperFadeMPerPx,
	taperFadeWidthM,
	townFrameShare,
	uprightFadeMPerPx
} from './constants';

/** Camera elevation and height scaling parameters. Ranges increase from quarter to whole city. */
export type CityCameraHeightPreset = Readonly<{
	quarterElevationDeg: number;
	cityElevationFlatDeg: number;
	cityElevationPerReliefDeg: number;
	cityElevationRangeM: readonly [number, number];
	townFrameShare: number;
	peakFrameShare: number;
	peakTransitionM: readonly [number, number];
	heightFadeMPerPx: readonly [number, number];
}>;

/** The default city camera keeps its existing tilt and height scaling as the frame widens. */
export const cityCameraHeightPreset: CityCameraHeightPreset = Object.freeze({
	quarterElevationDeg,
	cityElevationFlatDeg,
	cityElevationPerReliefDeg,
	cityElevationRangeM: Object.freeze(cityElevationRangeM),
	townFrameShare,
	peakFrameShare,
	peakTransitionM: Object.freeze([
		peakTransitionLevels[0] * levelHeight,
		peakTransitionLevels[1] * levelHeight
	] as const),
	heightFadeMPerPx: Object.freeze(heightFadeMPerPx)
});

function fade(value: number, [start, end]: readonly [number, number]) {
	const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
	return t * t * (3 - 2 * t);
}

/** Camera elevation in radians for a true horizontal frame width in meters. */
export function cityElevation(
	relief: number,
	widthM = Infinity,
	{
		quarterElevationDeg,
		cityElevationFlatDeg,
		cityElevationPerReliefDeg,
		cityElevationRangeM
	} = cityCameraHeightPreset
) {
	const wholeCity = Math.max(
		quarterElevationDeg,
		cityElevationFlatDeg + cityElevationPerReliefDeg * relief
	);
	const share = fade(widthM, cityElevationRangeM);
	return ((quarterElevationDeg + (wholeCity - quarterElevationDeg) * share) * Math.PI) / 180;
}

/** Smooth detail weights and vertical scale for a fitted city. At a broad view the projected
 * city peak is one tenth of the frame width, with a gentler target for towns. The caller applies
 * the same capped scale to terrain and city. */
export function cityProfile(
	width: number,
	metersPerPixel: number,
	peak: number,
	elevation: number,
	trueScale: boolean,
	maxScale = Infinity,
	{ townFrameShare, peakFrameShare, peakTransitionM, heightFadeMPerPx } = cityCameraHeightPreset
) {
	const target = townFrameShare + (peakFrameShare - townFrameShare) * fade(peak, peakTransitionM);
	const fullScale = Math.max(
		1,
		(width * target) / (Math.cos(elevation) * Math.max(levelHeight, peak))
	);
	return {
		factor:
			trueScale || peak <= 0
				? 1
				: 1 + (Math.min(maxScale, fullScale) - 1) * fade(metersPerPixel, heightFadeMPerPx),
		detail: 1 - fade(metersPerPixel, detailFadeMPerPx),
		uprights: 1 - fade(metersPerPixel, uprightFadeMPerPx),
		rims: 1 - fade(metersPerPixel, rimFadeMPerPx),
		envelope: fade(metersPerPixel, envelopeFadeMPerPx),
		/** Share of the taper shown: none while member detail is drawn or the frame is a quarter,
		 * whatever the canvas width, and all once both are gone. */
		taper: fade(metersPerPixel, taperFadeMPerPx) * fade(width, taperFadeWidthM)
	};
}
