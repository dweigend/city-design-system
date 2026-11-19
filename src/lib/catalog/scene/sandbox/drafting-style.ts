import { MASSSTAB, ZOOM } from '../../data/leitstil';
import { stilFuer } from '../../logic/leitstil';

/** Closest bible zoom for the camera's current scale in CSS pixels per meter. */
export function nearestZoom(scale: number) {
	return ZOOM.reduce((best, next) =>
		Math.abs(MASSSTAB[best] - scale) <= Math.abs(MASSSTAB[next] - scale) ? best : next
	);
}

/** Sandbox drafting follows the bible at the current zoom. */
export const sandboxStyle = stilFuer;
