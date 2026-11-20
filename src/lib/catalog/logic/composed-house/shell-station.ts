import type { HouseComposition } from '../house-typology';
type Shell = NonNullable<HouseComposition['exterior']>;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
/** Interpolates a free surface point between the two surveyed sections bracketing its height. */
export function stationAt(
	shell: Shell,
	height: number,
	corner: number,
	depth: number,
	tuck: number
) {
	const upper = shell.stations.findIndex((s) => s.z >= height);
	const index = upper < 0 ? shell.stations.length - 1 : Math.max(1, upper);
	const lo = shell.stations[index - 1],
		hi = shell.stations[index];
	const t = clamp((height - lo.z) / (hi.z - lo.z));
	const at = (k: number) => {
		const base = shell.ring[corner][k];
		const atStation = (station: typeof lo) =>
			station.atBoundary
				? base + tuck * (shell.reveal[corner][k] - base)
				: base + depth * (station.ring[corner][k] - base);
		return (1 - t) * atStation(lo) + t * atStation(hi);
	};
	return [at(0), at(1)];
}
