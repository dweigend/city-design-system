import { planPoints } from './part-plan';
import { bounds } from '../ansicht/geometrie';
import type { StockPart } from './house-object';

/** Bounding volume of a mounted member in the surveyed house axes. */
function memberVolume(p: StockPart) {
	const b = bounds(p);
	if ((p.kind === 'box' || p.kind === 'wedge') && p.rotation) {
		const points = planPoints(p);
		for (const k of [0, 1] as const) {
			b.min[k] = Math.min(...points.map((q) => q[k]));
			b.max[k] = Math.max(...points.map((q) => q[k]));
		}
	}
	return b.max.reduce((v, end, i) => v * (end - b.min[i]), 1);
}

/** Sum of member bounding volumes, including landings, rails and the terrain approach. */
export function accessShare(parts: StockPart[]) {
	let total = 0,
		access = total;
	for (const p of parts) {
		const volume = memberVolume(p);
		total += volume;
		if (p.id.includes('/stair/') || p.id.includes('/landing-seat/')) access += volume;
	}
	return access / total;
}

/** Maximum combined share of stair parts and their landing seats. */
export const maxAccessShare = 0.1;

/** Sums the world-space bounding volumes for the mounted stock. */
export function volume(parts: StockPart[]) {
	return parts.reduce((sum, p) => sum + memberVolume(p), 0);
}

/** Remaining rail volume after fitting the walk and its supports. */
export function remainingAccessVolume(house: StockPart[], walk: StockPart[], seats: StockPart[]) {
	return (volume(house) * maxAccessShare) / (1 - maxAccessShare) - volume(walk) - volume(seats);
}
