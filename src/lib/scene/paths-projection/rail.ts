import type { Vec3 } from '../../core/geometry';
import type { TransitLine } from '../../domain/transit-line';
import { defaults } from '../../../config/paths-projection';
import { assembly, local, trace, up } from './assembly';
import { drawBearing } from './bearing';
import { clip, onFootprint } from './clip';
import { pathSurfaces } from './surfaces';
import type { PathsFrame } from './types';

// Exact arithmetic: rails and shelters are paired symmetrically about the centerline.
export function guideway(line: TransitLine | undefined, frame: PathsFrame) {
	const drawing = assembly('transit', frame);
	const rail = drawing.layer('rail-guideway', pathSurfaces.rail);
	const track = drawing.layer('rail-tracks', pathSurfaces.track);
	const piers = drawing.layer('rail-piers', pathSurfaces.pier);
	const stations = drawing.layer('rail-stations', pathSurfaces.station);
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
	rail.body.ribbon([a, b], defaults.railWidthM, defaults.railDeckThicknessM);
	trace(rail.stroke, [a, b], defaults.lineLiftM);
	for (const side of [-1, 1]) {
		const offset = (side * defaults.trackSpacingM) / 2;
		trace(track.stroke, [at(a, 0, offset), at(b, 0, offset)], defaults.lineLiftM * 2);
	}
	for (const { top, base } of line.piers) {
		const point = local(frame, base);
		const station = local(frame, top);
		if (!onFootprint(station, frame.footprint) || !onFootprint(point, frame.footprint)) continue;
		drawBearing(piers.body, point, station, defaults.railPierRadiusM, defaults.railDeckThicknessM);
	}
	for (const { position } of line.stations) {
		const station = local(frame, position);
		if (!onFootprint(station, frame.footprint)) continue;
		const half = defaults.platformLengthM / 2;
		stations.body.ribbon(
			[at(station, -half, 0), at(station, half, 0)],
			defaults.platformWidthM,
			defaults.deckThicknessM
		);
		for (const side of [-1, 1]) {
			const offset = (side * defaults.platformWidthM) / 2;
			const width = defaults.platformWidthM / 2;
			const roof = defaults.canopyHeightM;
			const canopy = [
				at(station, -half * defaults.stationCanopyLengthShare, offset / 2, roof),
				at(station, half * defaults.stationCanopyLengthShare, offset / 2, roof)
			];
			stations.body.ribbon(canopy, width, defaults.deckThicknessM);
			for (const top of canopy)
				piers.body.pier([top[0], top[1], station[2]], top[2], defaults.walkwayPierRadiusM);
		}
	}
	return drawing.complete(
		line.stations.map(({ id, position }) => ({
			name: id,
			position: local(frame, position),
			normal: up
		}))
	);
}
