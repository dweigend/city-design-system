import { defaults } from './settings';
import { position } from './catchment-grid';
import type { RiverCourse } from './course';
import type { drainageTerrain } from './drainage-terrain';
import type { ReachStation } from './reaches';

const { guideWetToBankfullWidthRatio } = defaults;

export function trunkCourse(
	terrain: ReturnType<typeof drainageTerrain>,
	bearing: number
): RiverCourse {
	const xy: number[] = [];
	const widths: { width: number; length: number }[] = [];
	for (const id of terrain.path) {
		const station = terrain.guide.get(id);
		xy.push(...(station ? [station.x, station.y] : position(id)));
	}
	for (const { trunk, stations } of terrain.reaches) {
		if (!trunk) continue;
		let previous: ReachStation = stations[0];
		for (const next of stations.slice(1)) {
			widths.push({
				width: (previous.width + next.width) / 2,
				length: Math.hypot(next.xy[0] - previous.xy[0], next.xy[1] - previous.xy[1])
			});
			previous = next;
		}
	}
	let middle = widths.reduce((sum, { length }) => sum + length, 0) / 2;
	let wetWidth = widths[0].width;
	for (const { width, length } of widths.sort((a, b) => a.width - b.width)) {
		wetWidth = width;
		middle -= length;
		if (middle <= 0) break;
	}
	return Object.freeze({
		xy: Object.freeze(xy),
		bearing,
		wetWidth,
		bankfullWidth: wetWidth / guideWetToBankfullWidthRatio
	});
}
