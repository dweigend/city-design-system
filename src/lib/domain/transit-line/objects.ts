import { defaults } from '../../../config/transit-line';
import type { Vec2, Vec3 } from '../../core/geometry';
import { defineParams } from '../../core/params';
import { createMeshObject, drawBearing, mesh } from '../../core/mesh';

// Exact arithmetic: attachments use the positive Z normal.
const up: Vec3 = [0, 0, 1];

/** Thickness of the guideway slab and its crossheads in meters. */
export const railDeckThicknessM = defaults.railDeckThicknessM;

/** Schemas for editable pier radius and platform width in meters. */
export const transitObjectParams = Object.freeze({
	pier: defineParams({
		radius: {
			label: 'Radius',
			unit: 'm',
			default: defaults.railPierRadiusM,
			min: defaults.registeredPierRadiusMinM,
			max: defaults.registeredPierRadiusMaxM,
			step: defaults.registeredPierRadiusStepM
		}
	}),
	platform: defineParams({
		width: {
			label: 'Width',
			unit: 'm',
			default: defaults.platformWidthM,
			min: defaults.registeredPlatformWidthMinM,
			max: defaults.registeredPlatformWidthMaxM,
			step: defaults.registeredPlatformWidthStepM
		}
	})
});

/** Builds a rail pier between the supplied base and bearing, including any offset crosshead. */
export function createRailPierObject(
	id: string,
	base: Vec3,
	top: Vec3,
	radius: number = defaults.railPierRadiusM
) {
	if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Invalid pier radius');
	const bearing = mesh();
	drawBearing(bearing, base, top, radius, railDeckThicknessM);
	return createMeshObject(id, { bearing }, [
		{ name: 'ground', position: base, normal: up },
		{ name: 'rail', position: top, normal: up }
	]);
}

/** Builds a platform, paired shelters and their posts along a horizontal track direction. */
// Exact arithmetic: the platform and its two shelters are paired symmetrically about the axis.
export function createStationPlatformObject(
	id: string,
	position: Vec3,
	direction: Vec2,
	width: number = defaults.platformWidthM
) {
	if (!Number.isFinite(width) || width <= 0) throw new RangeError('Invalid platform width');
	const length = Math.hypot(...direction);
	if (!Number.isFinite(length) || length === 0) throw new RangeError('Invalid track direction');
	const [u, v] = [direction[0] / length, direction[1] / length];
	const [x, y, z] = position;
	const at = (along: number, across: number, lift = 0): Vec3 => [
		x + u * along - v * across,
		y + v * along + u * across,
		z + lift
	];
	const platform = mesh();
	const bearing = mesh();
	const half = defaults.platformLengthM / 2;
	const slab = defaults.platformSlabThicknessM;
	platform.ribbon([at(-half, 0), at(half, 0)], width, slab);
	for (const side of [-1, 1]) {
		const offset = (side * width) / 2;
		const roof = defaults.canopyHeightM;
		const canopy = [
			at(-half * defaults.stationCanopyLengthShare, offset / 2, roof),
			at(half * defaults.stationCanopyLengthShare, offset / 2, roof)
		];
		platform.ribbon(canopy, width / 2, slab);
		for (const top of canopy) bearing.pier([top[0], top[1], z], top[2], defaults.canopyPostRadiusM);
	}
	return createMeshObject(id, { platform, bearing }, [{ name: 'station', position, normal: up }]);
}
