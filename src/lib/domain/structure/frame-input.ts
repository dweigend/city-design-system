import { defaults } from '../../../config/structure';
import {
	distance,
	isConvexCounterclockwise,
	isFiniteVector,
	isSimpleRing,
	type Vec2
} from '../../core/geometry';
import { encodeKey } from '../../core/ref';

const { frameCollarWidthM, frameClearBayM } = defaults;

export type FrameRoofSeat = Readonly<{
	id: string;
	hostId: string;
	outline: readonly Vec2[];
	roofZ: number;
	foundationZ: number | null;
	bearingOutlines?: readonly (readonly Vec2[])[];
}>;

export type FrameObstruction = Readonly<{
	outline: readonly Vec2[];
	baseZ: number;
	topZ: number;
}>;

export type SupportedFrameSpec = Readonly<{
	id: string;
	start: Vec2;
	end: Vec2;
	widthM: number;
	deckZ: number;
	stations?: readonly Readonly<{ id: string; offsetM: number }>[];
	roofs?: readonly FrameRoofSeat[];
	obstructions?: readonly FrameObstruction[];
	groundAt: (point: Vec2) => number;
	allowPiers?: boolean;
}>;

function keyed(id: string) {
	return typeof id === 'string' && !!id.trim() && id.isWellFormed() && !/\p{Cc}/u.test(id);
}

function convexRing(ring: readonly Vec2[]) {
	return isSimpleRing(ring) && isConvexCounterclockwise(ring);
}

function validateRoof(roof: FrameRoofSeat) {
	const { id, hostId, outline, foundationZ, roofZ, bearingOutlines = [] } = roof;
	if (
		!keyed(id) ||
		!keyed(hostId) ||
		!convexRing(outline) ||
		!bearingOutlines.every(convexRing) ||
		!Number.isFinite(roofZ) ||
		(foundationZ !== null && (!Number.isFinite(foundationZ) || foundationZ >= roofZ))
	)
		throw new RangeError('Expected a keyed convex roof with valid foundation and elevation');
}

function validateObstruction({ outline, baseZ, topZ }: FrameObstruction) {
	if (!convexRing(outline) || !Number.isFinite(baseZ) || !Number.isFinite(topZ) || topZ <= baseZ)
		throw new RangeError('Expected a convex frame obstruction with positive height');
}

function validateBaseline({
	id,
	start,
	end,
	widthM,
	deckZ,
	groundAt,
	allowPiers
}: SupportedFrameSpec) {
	if (
		!keyed(id) ||
		!isFiniteVector(start, 2) ||
		!isFiniteVector(end, 2) ||
		!Number.isFinite(widthM) ||
		widthM < frameCollarWidthM + frameCollarWidthM + frameClearBayM ||
		!Number.isFinite(deckZ) ||
		typeof groundAt !== 'function' ||
		(allowPiers !== undefined && typeof allowPiers !== 'boolean')
	)
		throw new RangeError('Expected a keyed frame with finite coordinates and adequate width');
	const length = distance(start, end);
	if (!Number.isFinite(length) || length <= 0) throw new RangeError('Invalid frame baseline');
	return length;
}

export type Station = Readonly<{ id: string; offsetM: number }>;

function validateStations(stations: readonly Station[]) {
	const ids = new Set<string>();
	for (const [i, station] of stations.entries()) {
		if (
			!keyed(station.id) ||
			ids.has(station.id) ||
			!Number.isFinite(station.offsetM) ||
			(i > 0 && station.offsetM <= stations[i - 1].offsetM)
		)
			throw new RangeError('Expected uniquely keyed bearing stations in baseline order');
		ids.add(station.id);
	}
}

function validateRoofs(roofs: readonly FrameRoofSeat[]) {
	const roofIds = new Set<string>();
	for (const roof of roofs) {
		validateRoof(roof);
		const key = encodeKey([roof.hostId, roof.id]);
		if (roofIds.has(key)) throw new RangeError('Duplicate structural roof seat');
		roofIds.add(key);
	}
}

export function validateFrameSpec(spec: SupportedFrameSpec) {
	const length = validateBaseline(spec);
	const stations = [
		{ id: 'start', offsetM: /* Exact arithmetic: first station is the baseline origin. */ 0 },
		...(spec.stations ?? []),
		{ id: 'end', offsetM: length }
	];
	const roofs = spec.roofs ?? [];
	validateStations(stations);
	validateRoofs(roofs);
	spec.obstructions?.forEach(validateObstruction);
	return { length, stations, roofs };
}
