import type { Vec3 } from '../../core/geometry';
import {
	createRailPierObject,
	createStationPlatformObject,
	railDeckThicknessM,
	type TransitLine
} from '../../domain/transit-line';
import { defaults } from '../../../config/paths-projection';
import { appendParts, assembly, local, trace, up } from './assembly';
import { clip, onFootprint } from './clip';
import { pathSurfaces, railSurfaces } from './surfaces';
import type { PathsFrame } from './types';

// Exact arithmetic: rails and shelters are paired symmetrically about the centerline.
export function guideway(line: TransitLine | undefined, frame: PathsFrame) {
	const drawing = assembly('transit', frame);
	const rail = drawing.layer('rail-guideway', pathSurfaces.rail);
	const track = drawing.layer('rail-tracks', pathSurfaces.track);
	const piers = drawing.layer('rail-piers', railSurfaces.bearing);
	const stations = drawing.layer('rail-stations', railSurfaces.platform);
	if (!line) return drawing.complete();
	const endpoints = clip(
		local(frame, line.points[0]),
		local(frame, line.points[1]),
		frame.footprint
	);
	if (!endpoints) return drawing.complete();
	const [a, b] = endpoints;
	const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
	const u = (b[0] - a[0]) / length;
	const v = (b[1] - a[1]) / length;
	const at = ([x, y, z]: Vec3, along: number, across: number, lift = 0): Vec3 => [
		x + u * along - v * across,
		y + v * along + u * across,
		z + lift
	];
	rail.body.ribbon([a, b], defaults.railWidthM, railDeckThicknessM);
	trace(rail.stroke, [a, b], defaults.lineLiftM);
	for (const side of [-1, 1]) {
		const offset = (side * defaults.trackSpacingM) / 2;
		trace(track.stroke, [at(a, 0, offset), at(b, 0, offset)], defaults.lineLiftM * 2);
	}
	for (const { top, base } of line.piers) {
		const point = local(frame, base);
		const station = local(frame, top);
		if (!onFootprint(station, frame.footprint) || !onFootprint(point, frame.footprint)) continue;
		appendParts(createRailPierObject('pier', point, station), { bearing: piers.body });
	}
	for (const { position } of line.stations) {
		const station = local(frame, position);
		if (!onFootprint(station, frame.footprint)) continue;
		const object = createStationPlatformObject('station', station, [b[0] - a[0], b[1] - a[1]]);
		appendParts(object, { platform: stations.body, bearing: piers.body });
	}
	return drawing.complete(
		line.stations.map(({ id, position }) => ({
			name: id,
			position: local(frame, position),
			normal: up
		}))
	);
}
