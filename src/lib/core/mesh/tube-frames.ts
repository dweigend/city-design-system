import { defaults } from '../../../config/mesh';
import {
	crossProduct,
	displacement,
	dotProduct,
	interpolation,
	isFiniteVector,
	length,
	scaled,
	sum,
	unitVector,
	type Vec3
} from '../geometry';

export type TubeFrame = Readonly<{
	center: Vec3;
	distance: number;
	tangent: Vec3;
	transverse: Vec3;
}>;

const tolerance = defaults.tubeFrameToleranceRatio;
const axisX: Vec3 = /* Exact arithmetic: positive X unit vector. */ [1, 0, 0];
const axisY: Vec3 = /* Exact arithmetic: positive Y unit vector. */ [0, 1, 0];
const axisZ: Vec3 = /* Exact arithmetic: positive Z unit vector. */ [0, 0, 1];
const noTwist = /* Exact arithmetic: no imposed roll. */ 0;

function perpendicular(vector: Vec3, tangent: Vec3): Vec3 {
	return unitVector(displacement(scaled(tangent, dotProduct(vector, tangent)), vector));
}

// Exact arithmetic: a spatial point has three coordinates and the fallback axes are unit vectors.
function endpointTransverse(tangent: Vec3, transverse?: Vec3): Vec3 {
	if (transverse === undefined) {
		const [x, y, z] = tangent.map(Math.abs);
		if (x <= y && x <= z) return perpendicular(axisX, tangent);
		if (y <= z) return perpendicular(axisY, tangent);
		return perpendicular(axisZ, tangent);
	}
	if (
		!isFiniteVector(transverse, 3) ||
		Math.abs(Math.hypot(transverse[0], transverse[1], transverse[2]) - 1) > tolerance ||
		Math.abs(dotProduct(transverse, tangent)) > tolerance
	)
		throw new RangeError(
			'Tube transverse must be unit length and orthogonal to the endpoint tangent'
		);
	return perpendicular([transverse[0], transverse[1], transverse[2]], tangent);
}

function rotate(vector: Vec3, axis: Vec3, sine: number, cosine: number): Vec3 {
	return sum(
		sum(scaled(vector, cosine), scaled(crossProduct(axis, vector), sine)),
		scaled(axis, dotProduct(axis, vector) * (1 - cosine))
	);
}

function transport(frame: TubeFrame, tangent: Vec3): Vec3 {
	const axis = crossProduct(frame.tangent, tangent);
	const sine = length(axis);
	if (sine === 0) return perpendicular(frame.transverse, tangent);
	const cosine = dotProduct(frame.tangent, tangent);
	return perpendicular(rotate(frame.transverse, unitVector(axis), sine, cosine), tangent);
}

function readCenters(centerline: readonly Vec3[]): Vec3[] {
	const { length } = centerline;
	if (
		length < /* Exact arithmetic: a run has at least two centers. */ 2 ||
		length > defaults.maximumTubeStations
	)
		throw new RangeError('Tube centerline has an invalid number of points');
	// Exact arithmetic: copy the three validated coordinate indices.
	return Array.from({ length }, (_, index): Vec3 => {
		const point = centerline[index];
		if (!isFiniteVector(point, 3))
			throw new RangeError('Tube centerline requires finite XYZ points');
		return [point[0], point[1], point[2]];
	});
}

function vertexTangent(directions: readonly Vec3[], index: number): Vec3 {
	if (index === 0) return directions[0];
	if (index === directions.length) return directions[index - 1];
	const bisector = sum(directions[index - 1], directions[index]);
	if (length(bisector) <= tolerance) throw new RangeError('Tube centerline reverses direction');
	return unitVector(bisector);
}

export function readTubeFrames(
	centerline: readonly Vec3[],
	startTransverse?: Vec3,
	endTransverse?: Vec3
): { frames: TubeFrame[]; twist: number } {
	const centers = readCenters(centerline);
	if (length(displacement(centers[0], centers[centers.length - 1])) === 0)
		throw new RangeError('Tube centerline must have distinct endpoints');
	const distances = /* Exact arithmetic: arc length starts at zero. */ [0];
	const directions = centers.slice(1).map((point, i) => {
		const span = displacement(centers[i], point);
		const distance = distances[i] + length(span);
		if (!Number.isFinite(distance) || distance <= distances[i])
			throw new RangeError('Tube centerline requires finite, nonzero spans');
		distances.push(distance);
		return unitVector(span);
	});

	const frames: TubeFrame[] = [];
	for (const [i, center] of centers.entries()) {
		const tangent = vertexTangent(directions, i);
		const previous = frames[i - 1];
		const transverse = previous
			? transport(previous, tangent)
			: endpointTransverse(tangent, startTransverse);
		frames.push({ center, tangent, transverse, distance: distances[i] });
	}

	if (endTransverse === undefined) return { frames, twist: noTwist };
	const end = frames[frames.length - 1];
	const target = endpointTransverse(end.tangent, endTransverse);
	const sine = dotProduct(end.tangent, crossProduct(end.transverse, target));
	const cosine = dotProduct(end.transverse, target);
	// Choose the same half-turn on either side of floating-point zero.
	const twist = Math.abs(sine) <= tolerance && cosine < 0 ? Math.PI : Math.atan2(sine, cosine);
	// With only an end constraint a common roll of all frames preserves parallel transport.
	if (startTransverse === undefined)
		return { frames: frames.map((frame) => rollTubeFrame(frame, twist)), twist: noTwist };
	return { frames, twist };
}

export function interpolateTubeFrame(a: TubeFrame, b: TubeFrame, distance: number): TubeFrame {
	const fraction = (distance - a.distance) / (b.distance - a.distance);
	const tangent = unitVector(interpolation(a.tangent, b.tangent, fraction));
	return {
		center: interpolation(a.center, b.center, fraction),
		tangent,
		transverse: transport(a, tangent),
		distance
	};
}

export function rollTubeFrame(frame: TubeFrame, radians: number): TubeFrame {
	if (!radians) return frame;
	const transverse = unitVector(
		rotate(frame.transverse, frame.tangent, Math.sin(radians), Math.cos(radians))
	);
	return { ...frame, transverse };
}
