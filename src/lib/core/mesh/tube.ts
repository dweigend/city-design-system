import { defaults } from '../../../config/mesh';
import { crossProduct, displacement, length, scaled, sum, type Vec3 } from '../geometry';
import type { Anchor, Shape } from '../object';
import { interpolateTubeFrame, readTubeFrames, rollTubeFrame, type TubeFrame } from './tube-frames';

type TubeShape = Extract<Shape, { kind: 'mesh' }>;

/** Sleeve geometry in meters. End sleeves are automatic. Joints index the input centerline. */
export type TubeCollars = Readonly<{
	innerRadius: number;
	outerRadius: number;
	width: number;
	jointIndices?: readonly number[];
	ribSpacing?: number;
}>;

/** Circular sweep dimensions, optional roll constraints, and optional FORM-5 sleeves. */
export type SweptTubeOptions = Readonly<{
	radius: number;
	radialSegments: number;
	startTransverse?: Vec3;
	endTransverse?: Vec3;
	collars?: TubeCollars;
}>;

/** Open body, optional batched hollow collars, and the start and end attachment frames. */
export type SweptTube = Readonly<{
	body: TubeShape;
	collars?: TubeShape;
	anchors: readonly [start: Anchor, end: Anchor];
}>;

function positive(value: number): boolean {
	return Number.isFinite(value) && value > 0;
}

function validateOptions({ radius, radialSegments, collars }: SweptTubeOptions): void {
	if (!positive(radius)) throw new RangeError('Tube radius must be finite and positive');
	if (
		!Number.isInteger(radialSegments) ||
		radialSegments < /* Exact arithmetic: minimum polygon sides. */ 3 ||
		radialSegments > defaults.maximumTubeRadialSegments
	)
		throw new RangeError('Invalid tube radial segment count');
	if (collars) validateCollars(collars, radius);
}

function validateCollars(collars: TubeCollars, radius: number): void {
	if (
		!positive(collars.width) ||
		!positive(collars.innerRadius) ||
		collars.innerRadius > radius ||
		!Number.isFinite(collars.outerRadius) ||
		collars.outerRadius <= radius ||
		(collars.ribSpacing !== undefined && !positive(collars.ribSpacing))
	)
		throw new RangeError('Invalid tube collar dimensions or rib spacing');
}

type Station = { frame: TubeFrame; collar: boolean };

function intervalStations(
	a: TubeFrame,
	b: TubeFrame,
	roll: number,
	ribs: readonly number[]
): Station[] {
	const steps = Math.ceil(Math.abs(roll) / defaults.maximumTubeRollStepRad);
	const distances = new Map(ribs.map((distance) => [distance, true]));
	for (let i = 1; i < steps; i++) {
		const distance = a.distance + ((b.distance - a.distance) * i) / steps;
		if (distance > a.distance && distance < b.distance && !distances.has(distance))
			distances.set(distance, false);
	}
	return [...distances]
		.sort(([a], [b]) => a - b)
		.map(([distance, collar]) => ({ frame: interpolateTubeFrame(a, b, distance), collar }));
}

function readJoints(end: number, collars?: TubeCollars): Set<number> {
	if (!collars) return new Set();
	const joints = new Set(collars.jointIndices);
	for (const index of joints)
		if (!Number.isInteger(index) || index < 0 || index > end)
			throw new RangeError('Tube collar joint is outside its centerline');
	joints.add(/* Exact arithmetic: the first centerline index. */ 0);
	joints.add(end);
	return joints;
}

function readRibs(total: number, reserved: readonly number[], collars?: TubeCollars): number[] {
	const spacing = collars?.ribSpacing;
	if (spacing === undefined) return [];
	if (total / spacing > defaults.maximumTubeStations)
		throw new RangeError('Tube rib spacing adds too many stations');
	const width = collars?.width ?? 0;
	const ribs: number[] = [];
	for (let i = 1; i * spacing < total; i++) {
		const distance = i * spacing;
		const overlapsReserved = reserved.some((station) => Math.abs(distance - station) < width);
		const overlapsPrevious = ribs.length > 0 && distance - ribs[ribs.length - 1] < width;
		if (!overlapsReserved && !overlapsPrevious) ribs.push(distance);
	}
	return ribs;
}

function readStations(
	frames: readonly TubeFrame[],
	twist: number,
	collars?: TubeCollars
): Station[] {
	const end = frames.length - 1;
	const total = frames[end].distance;
	const joints = readJoints(end, collars);
	const reserved = [...joints].map((index) => frames[index].distance);
	const ribs = readRibs(total, reserved, collars);
	const stations: Station[] = [
		{ frame: frames[0], collar: joints.has(/* Exact arithmetic: first station index. */ 0) }
	];
	let ribIndex = 0;
	for (let i = 1; i <= end; i++) {
		const a = frames[i - 1];
		const b = frames[i];
		const firstRib = ribIndex;
		while (ribIndex < ribs.length && ribs[ribIndex] < b.distance) ribIndex++;
		const roll = twist * ((b.distance - a.distance) / total);
		stations.push(...intervalStations(a, b, roll, ribs.slice(firstRib, ribIndex)));
		if (ribs[ribIndex] === b.distance) {
			ribIndex++;
			joints.add(i);
		}
		stations.push({ frame: b, collar: joints.has(i) });
		if (stations.length > defaults.maximumTubeStations)
			throw new RangeError('Tube sweep has too many stations');
	}
	return stations.map(({ frame, collar }) => ({
		frame: rollTubeFrame(frame, twist * (frame.distance / total)),
		collar
	}));
}

type MeshBuffer = { positions: number[]; indices: number[] };

// Exact arithmetic: XYZ positions and one full circle of equally spaced profile vertices.
function addRing(
	mesh: MeshBuffer,
	{ center, tangent, transverse }: TubeFrame,
	radius: number,
	sides: number
): number {
	const start = mesh.positions.length / 3;
	const binormal = crossProduct(tangent, transverse);
	for (let i = 0; i < sides; i++) {
		const angle = (i * 2 * Math.PI) / sides;
		const offset = sum(
			scaled(transverse, radius * Math.cos(angle)),
			scaled(binormal, radius * Math.sin(angle))
		);
		mesh.positions.push(...sum(center, offset));
	}
	return start;
}

function joinRings(mesh: MeshBuffer, a: number, b: number, sides: number): void {
	for (let i = 0; i < sides; i++) {
		const next = (i + 1) % sides;
		mesh.indices.push(a + i, a + next, b + next, a + i, b + next, b + i);
	}
}

function addCollar(mesh: MeshBuffer, frame: TubeFrame, collar: TubeCollars, sides: number): void {
	const { center, tangent } = frame;
	const halfWidth = collar.width / /* Exact arithmetic: half on each side of the station. */ 2;
	const start = { ...frame, center: sum(center, scaled(tangent, -halfWidth)) };
	const end = { ...frame, center: sum(center, scaled(tangent, halfWidth)) };
	const innerStart = addRing(mesh, start, collar.innerRadius, sides);
	const outerStart = addRing(mesh, start, collar.outerRadius, sides);
	const outerEnd = addRing(mesh, end, collar.outerRadius, sides);
	const innerEnd = addRing(mesh, end, collar.innerRadius, sides);
	joinRings(mesh, innerStart, outerStart, sides);
	joinRings(mesh, outerStart, outerEnd, sides);
	joinRings(mesh, outerEnd, innerEnd, sides);
	joinRings(mesh, innerEnd, innerStart, sides);
}

function pointAt(positions: readonly number[], index: number): Vec3 {
	const offset = index * /* Exact arithmetic: three coordinates per vertex. */ 3;
	return [positions[offset], positions[offset + 1], positions[offset + 2]];
}

function shape(mesh: MeshBuffer): TubeShape {
	const { positions, indices } = mesh;
	if (!positions.every(Number.isFinite)) throw new RangeError('Tube coordinates overflow');
	// Exact arithmetic: each triangle consumes three vertex indices.
	for (let i = 0; i < indices.length; i += 3) {
		const a = pointAt(positions, indices[i]);
		const b = pointAt(positions, indices[i + 1]);
		const c = pointAt(positions, indices[i + 2]);
		if (length(crossProduct(displacement(a, b), displacement(a, c))) === 0)
			throw new RangeError('Tube geometry collapsed at finite coordinate precision');
	}
	return { kind: 'mesh', ...mesh };
}

/** Sweeps an open circular shell along caller-sampled XYZ points in meters. The optional
 * endpoint transverses set ring roll. Collars at ends, joints and optional rib stations form
 * one separate indexed mesh. Returns detached data in run order. Invalid inputs throw RangeError. */
export function createSweptTube(centerline: readonly Vec3[], options: SweptTubeOptions): SweptTube {
	const { radius, radialSegments, startTransverse, endTransverse, collars } = options;
	validateOptions(options);
	const { frames, twist } = readTubeFrames(centerline, startTransverse, endTransverse);
	const stations = readStations(frames, twist, collars);
	const body: MeshBuffer = { positions: [], indices: [] };
	const sleeves: MeshBuffer = { positions: [], indices: [] };
	let previous: number | undefined;
	for (const { frame, collar } of stations) {
		const ring = addRing(body, frame, radius, radialSegments);
		if (previous !== undefined) joinRings(body, previous, ring, radialSegments);
		if (collars && collar) addCollar(sleeves, frame, collars, radialSegments);
		previous = ring;
	}
	const start = stations[0].frame;
	const end = stations[stations.length - 1].frame;
	return {
		body: shape(body),
		...(collars ? { collars: shape(sleeves) } : {}),
		anchors: [
			{
				name: 'start',
				position: start.center,
				normal: scaled(start.tangent, /* Exact arithmetic: face out of the start. */ -1),
				transverse: start.transverse
			},
			{ name: 'end', position: end.center, normal: end.tangent, transverse: end.transverse }
		]
	};
}
