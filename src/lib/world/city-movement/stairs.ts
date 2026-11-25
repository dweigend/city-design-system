import type { Vec2, Vec3 } from '../../core/geometry';
import { accessObjectParams, type MovementNode } from '../../domain/movement-network';
import type { CitySite } from '../city-site';
import { defaults } from '../../../config/city-movement';
import type { columnClearance } from './clearance';
import { link } from './links';
import type { parcelClearance } from './parcel-clearance';

// Exact arithmetic: each flight pair has two endpoints per flight.
const lastFlightPairCorners = /* Exact arithmetic: corner count of the last two flights. */ 4;

type At = (along: number, across: number, z: number) => Vec3;

// Exact arithmetic: the farthest point from the sampling grid lies at a subcell center.
function dryFootprint(site: CitySite, at: At, from: number, to: number, halfWidth: number) {
	const step = defaults.stairFootprintProbeStepM;
	const length = Math.ceil((to - from) / step);
	const width = Math.ceil((halfWidth + halfWidth) / step);
	const margin = Math.hypot(step, step) / 2;
	for (let i = 0; i <= length; i++) {
		for (let j = 0; j <= width; j++) {
			const [x, y] = at(
				from + ((to - from) * i) / length,
				-halfWidth + ((halfWidth + halfWidth) * j) / width,
				/* Exact arithmetic: zero angle aligns with the cell. */ 0
			);
			if (site.sampleGround(x, y).waterClearance <= margin) return false;
		}
	}
	return true;
}

// Exact arithmetic: each paired flight returns to the same end of the footprint.
function flights(
	at: At,
	near: number,
	far: number,
	side: number,
	pairs: number,
	flightRise: number,
	z: number
) {
	const steps: Vec3[] = [];
	for (let i = 0; i < pairs; i++) {
		const level = z + i * 2 * flightRise;
		const landing = level + flightRise;
		steps.push(
			at(near, -side, level),
			at(far, -side, landing),
			at(far, side, landing),
			at(near, side, landing + flightRise)
		);
	}
	return steps;
}

// Exact arithmetic: sweep the configured number of directions over one full turn.
function orient(base: Vec3, index: number): At {
	const angle = (index * 2 * Math.PI) / defaults.stairBearingCount;
	const u = Math.cos(angle);
	const v = Math.sin(angle);
	return (along, across, z) => [
		base[0] + u * along - v * across,
		base[1] + v * along + u * across,
		z
	];
}

function footprintClear(
	clear: ReturnType<ReturnType<typeof columnClearance>>,
	at: At,
	from: number,
	to: number,
	halfWidth: number,
	z: number
) {
	// Two adjacent bands cover the entire footprint including both flights and the landing.
	return [-halfWidth, halfWidth].every((side) => clear(at(from, side, z), at(to, side, z)));
}

// Exact arithmetic: divide the rise evenly across two flights per switchback.
export function stairSurvey(
	site: CitySite,
	publicGround: ReturnType<typeof parcelClearance>,
	clear: ReturnType<typeof columnClearance>
) {
	return (id: string, base: MovementNode, top: MovementNode) => {
		const z = base.position[2];
		const rise = top.position[2] - z;
		if (rise <= 0) return undefined;
		const half = accessObjectParams.stair.width.default / 2;
		const side = defaults.stairFlightSeparationM / 2;
		const padding = half + side;
		const pairs = Math.ceil(rise / defaults.stairFlightRiseM / 2);
		const flightRise = rise / (pairs * 2);
		const near = padding;
		const far = near + flightRise * defaults.stairRunRatio;
		const footprint = clear(
			z,
			/* Exact arithmetic: no rotation of the footprint. */ 0,
			padding / 2
		);
		const access = clear(
			z,
			/* Exact arithmetic: no rotation of the access check. */ 0,
			/* Exact arithmetic: no padding of the access check. */ 0,
			true
		);
		for (let i = 0; i < defaults.stairBearingCount; i++) {
			const at = orient(base.position, i);
			if (!footprintClear(footprint, at, near, far, padding / 2, z)) continue;
			if (!access(base.position, at(near, -side, z))) continue;
			const xy = (along: number, across: number): Vec2 => {
				const [x, y] = at(along, across, z);
				return [x, y];
			};
			if (
				!publicGround.footprint([
					xy(near - half, -padding),
					xy(far + half, -padding),
					xy(far + half, padding),
					xy(near - half, padding)
				])
			)
				continue;
			const [x, y] = base.position;
			if (!publicGround.point([x, y]) || !publicGround.segment([x, y], xy(near, -side))) continue;
			if (!dryFootprint(site, at, near - half, far + half, padding)) continue;
			if (!dryApproach(site, base.position, at(near, -side, z))) continue;
			const via = flights(at, near, far, side, pairs, flightRise, z);
			const upper = via[via.length - 1];
			if (
				!clear(
					top.position[2],
					/* Exact arithmetic: no rotation of the top landing. */ 0,
					half
				)(upper, top.position)
			)
				continue;
			const supports = via.slice(-lastFlightPairCorners).map((point) => ({
				base: [point[0], point[1], site.sampleGround(point[0], point[1]).height] as Vec3,
				top: point
			}));
			return link(id, 'stair', base, top, via, supports);
		}
	};
}

function dryApproach(site: CitySite, [x, y]: Vec3, [u, v]: Vec3) {
	const count = Math.max(
		1,
		Math.ceil(Math.hypot(u - x, v - y) / defaults.stairFootprintProbeStepM)
	);
	for (let i = 0; i <= count; i++) {
		const reading = site.sampleGround(x + ((u - x) * i) / count, y + ((v - y) * i) / count);
		if (reading.waterKind !== null) return false;
	}
	return true;
}
