import { clipPolylineToSquare } from '../../core/polyline';
import { radius, side, vertex } from './catchment-grid';
import type { RiverCourse } from './course';

type Station = { index: number; x: number; y: number; length: number };

/** Embed the inherited meander as a descending breakline on the regional triangulation.
 * A cardinal connector bridges a corner if the triangulation uses the other diagonal. */
// Exact arithmetic: one point occupies an XY pair in the interleaved course.
const xyStride = 2;

export function trough(course: RiverCourse) {
	const clipped = clipPolylineToSquare(course.xy, 2 * radius);
	if (!clipped) throw new Error('The ancestral trough must cross the catchment');
	const xy = clipped.xy;
	const stations: Station[] = [];
	let length = 0;
	for (let i = 0; i < xy.length; i += xyStride) {
		const x = xy[i];
		const y = xy[i + 1];
		const index = vertex(x, y);
		if (i) length += Math.hypot(x - xy[i - xyStride], y - xy[i - 1]);
		const previous = stations.at(-1);
		if (previous?.index === index) continue;
		const delta = previous ? index - previous.index : 0;
		if (previous && Math.abs(delta) === side - 1) {
			const stepY = Math.sign(delta) * side;
			const connector = i === xyStride ? previous.index + stepY : index - stepY;
			stations.push({
				index: connector,
				x: (previous.x + x) / 2,
				y: (previous.y + y) / 2,
				length: (previous.length + length) / 2
			});
		}
		stations.push({ index, x, y, length });
	}
	const boundary = ({ index }: Station) =>
		index < side || index >= side * (side - 1) || index % side === 0 || index % side === side - 1;
	const entry = stations.findIndex((station) => !boundary(station)) - 1;
	const exit = stations.findIndex(
		(station, i) => i > entry && boundary(station) && !boundary(stations[i - 1])
	);
	const path = stations.slice(entry, exit + 1);
	if (path.length <= 1) throw new Error('The ancestral trough needs an inlet and an outlet');
	return path;
}
