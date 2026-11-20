import type { StockPart } from './house-object';
import type { Vec3 } from '../parametrik/types';
type Fit = { point: (p: Vec3) => Vec3; scale: Vec3; angle: number };

function placed(part: StockPart, { point, scale: [sx, sy, sz], angle }: Fit): StockPart {
	const radius = Math.min(sx, sy);
	switch (part.kind) {
		case 'pipe':
			return {
				...part,
				points: part.points.map(point),
				radius: part.radius * Math.min(radius, sz)
			};
		case 'capsule':
			return { ...part, from: point(part.from), to: point(part.to), radius: part.radius * radius };
		case 'sphere':
			return {
				...part,
				position: point(part.position),
				radius: part.radius * radius,
				squash: ((part.squash ?? 1) * sz) / radius
			};
		case 'dome':
			return {
				...part,
				position: point(part.position),
				radius: part.radius * radius,
				height: (part.height ?? part.radius) * sz
			};
		case 'cone':
		case 'cylinder':
			return {
				...part,
				position: point(part.position),
				radius: part.radius * radius,
				height: part.height * sz
			};
		default:
			return placeRectangular(part, { point, scale: [sx, sy, sz], angle });
	}
}

function placePrism(
	part: Extract<StockPart, { kind: 'prism' }>,
	{ point, scale: [, , sz] }: Fit
): StockPart {
	const ring = (polygon: [number, number][]) =>
		polygon.map(([x, y]): [number, number] => {
			const q = point([x, y, 0]);
			return [q[0], q[1]];
		});
	return {
		...part,
		polygon: ring(part.polygon),
		...(part.holes ? { holes: part.holes.map(ring) } : {}),
		z: point([0, 0, part.z])[2],
		height: part.height * sz
	};
}
function placeRing(
	part: Extract<StockPart, { kind: 'ring' }>,
	{ point, scale: [sx, sy], angle }: Fit
): StockPart {
	const radius = Math.min(sx, sy);
	return {
		...part,
		position: point(part.position),
		radius: part.radius * radius,
		innerRadius: part.innerRadius * radius,
		depth: part.depth * radius,
		rotation: (part.rotation ?? 0) + angle
	};
}
function placeTorus(
	part: Extract<StockPart, { kind: 'torus' }>,
	{ point, scale: [sx, sy], angle }: Fit
): StockPart {
	const radius = Math.min(sx, sy);
	return {
		...part,
		position: point(part.position),
		radius: part.radius * radius,
		tube: part.tube * radius,
		rotation: (part.rotation ?? 0) + angle
	};
}
function placeVault(
	part: Extract<StockPart, { kind: 'vault' | 'arch' | 'halfpipe' }>,
	{ point, scale: [sx, sy, sz], angle }: Fit
): StockPart {
	const radius = Math.min(sx, sy);
	return {
		...part,
		position: point(part.position),
		width: part.width * sx,
		length: part.length * sy,
		rise: part.rise * sz,
		rotation: (part.rotation ?? 0) + angle,
		thickness: part.thickness === undefined ? undefined : part.thickness * radius
	};
}
function placeFrame(
	part: Extract<StockPart, { kind: 'frame' }>,
	{ point, scale: [sx, sy, sz] }: Fit
): StockPart {
	const radius = Math.min(sx, sy);

	const [w, d, h] = part.size;
	return {
		...part,
		position: point(part.position),
		size: [w * sx, d * sy, h * sz],
		bar: part.bar * radius
	};
}
function placeBox(
	part: Extract<StockPart, { kind: 'box' | 'wedge' }>,
	{ point, scale: [sx, sy, sz], angle }: Fit
): StockPart {
	const [w, d, h] = part.size,
		[x, y, z] = part.position;
	const center = point([x + w / 2, y + d / 2, z]);
	return {
		...part,
		position: [center[0] - (w * sx) / 2, center[1] - (d * sy) / 2, center[2]],
		size: [w * sx, d * sy, h * sz],
		rotation: (part.rotation ?? 0) + angle
	};
}
function placeHelix(
	part: Extract<StockPart, { kind: 'helix' }>,
	{ point, scale: [sx, sy, sz], angle }: Fit
): StockPart {
	const radius = Math.min(sx, sy);
	return {
		...part,
		position: point(part.position),
		radius: part.radius * radius,
		innerRadius: part.innerRadius * radius,
		height: part.height * sz,
		thickness: part.thickness * sz,
		rotation: (part.rotation ?? 0) + angle
	};
}
/** Kinds defined by world points only: every point takes the fitted transform. */
function placeAnnular(part: StockPart, fit: Fit): StockPart {
	switch (part.kind) {
		case 'mesh':
		case 'polyline':
			return { ...part, points: part.points.map(fit.point) };
		case 'membrane': {
			const [a, b, c, d] = part.corners.map(fit.point);
			return { ...part, corners: [a, b, c, d] };
		}
		case 'helix':
			return placeHelix(part, fit);
		case 'ring':
			return placeRing(part, fit);
		case 'torus':
			return placeTorus(part, fit);
		default:
			throw new RangeError('Unsupported house fitting ' + part.kind);
	}
}
function placeRectangular(part: StockPart, fit: Fit): StockPart {
	switch (part.kind) {
		case 'prism':
			return placePrism(part, fit);
		case 'vault':
		case 'arch':
		case 'halfpipe':
			return placeVault(part, fit);
		case 'frame':
			return placeFrame(part, fit);
		case 'box':
		case 'wedge':
			return placeBox(part, fit);
		default:
			return placeAnnular(part, fit);
	}
}

/** Places registry members relative to their measured native origin. */
export function place(parts: StockPart[], origin: Vec3, target: Vec3, scale: Vec3, angle: number) {
	const c = Math.cos(angle),
		s = Math.sin(angle);
	const point = ([x, y, z]: Vec3): Vec3 => {
		const u = (x - origin[0]) * scale[0],
			v = (y - origin[1]) * scale[1];
		return [
			target[0] + u * c - v * s,
			target[1] + u * s + v * c,
			target[2] + (z - origin[2]) * scale[2]
		];
	};
	return parts.map((p) => placed(p, { point, scale, angle }));
}
