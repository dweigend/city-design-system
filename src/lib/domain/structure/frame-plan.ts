import { defaults } from '../../../config/structure';
import type { Vec2, Vec3 } from '../../core/geometry';
import { encodeKey } from '../../core/ref';
import {
	validateFrameSpec,
	type FrameObstruction,
	type FrameRoofSeat,
	type Station,
	type SupportedFrameSpec
} from './frame-input';

const {
	primaryWidthM,
	frameCollarWidthM,
	frameClearBayM,
	frameBearingClearanceM,
	frameMaximumSpanM,
	frameMinimumBearingRiseM,
	frameMaximumBearingRiseM,
	supportedFrameDeckThicknessM,
	frameContactToleranceM
} = defaults;

export const half = /* Exact arithmetic: convert a full width to its radius. */ 2;
export const collarHalfM = frameCollarWidthM / half;

export type FrameBearing = Readonly<{
	id: string;
	at: Vec3;
	seat: Vec3;
	ground: Vec3;
	foundation: Vec3;
	support: Readonly<{ kind: 'roof'; hostId: string; seatId: string }> | Readonly<{ kind: 'pier' }>;
}>;

export type FrameRejection = Readonly<
	| { status: 'rejected'; reason: 'span-limit'; from: string; to: string }
	| { status: 'rejected'; reason: 'obstructed' }
	| { status: 'rejected'; reason: 'no-grounded-bearing'; stationId: string; side: 'left' | 'right' }
>;

function rectangle(x0: number, x1: number, y0: number, y1: number): Vec2[] {
	return [
		[x0, y0],
		[x1, y0],
		[x1, y1],
		[x0, y1]
	];
}

function containsPad(outline: readonly Vec2[], pad: readonly Vec2[]) {
	return outline.every(([ax, ay], i) => {
		const [bx, by] = outline[(i + 1) % outline.length];
		const dx = bx - ax;
		const dy = by - ay;
		const clearance = (frameBearingClearanceM - frameContactToleranceM) * Math.hypot(dx, dy);
		return pad.every(([x, y]) => dx * (y - ay) - dy * (x - ax) >= clearance);
	});
}

function separates(first: readonly Vec2[], second: readonly Vec2[]) {
	return first.some(([x, y], i) => {
		const [nx, ny] = first[(i + 1) % first.length];
		const dx = nx - x;
		const dy = ny - y;
		const tolerance = frameContactToleranceM * Math.hypot(dx, dy);
		return second.every(([px, py]) => dx * (py - y) - dy * (px - x) <= tolerance);
	});
}

const overlaps = (a: readonly Vec2[], b: readonly Vec2[]) => !separates(a, b) && !separates(b, a);

function readStock(
	roofs: readonly FrameRoofSeat[],
	obstructions: readonly FrameObstruction[]
): readonly FrameObstruction[] {
	return [
		...roofs.map(({ outline, foundationZ, roofZ }) => ({
			outline,
			baseZ: foundationZ ?? -Infinity,
			topZ: roofZ
		})),
		...obstructions
	];
}

function blocks(
	pad: readonly Vec2[],
	base: number,
	top: number,
	stock: readonly FrameObstruction[]
) {
	return stock.some(
		(solid) =>
			solid.topZ > base + frameContactToleranceM &&
			solid.baseZ < top - frameContactToleranceM &&
			overlaps(pad, solid.outline)
	);
}

function fitsRise(rise: number) {
	return rise >= frameMinimumBearingRiseM && rise <= frameMaximumBearingRiseM;
}

function selectBearing(
	id: string,
	at: Vec2,
	pad: readonly Vec2[],
	top: number,
	context: BearingContext
): FrameBearing | undefined {
	const { groundAt, roofs, stock, allowPiers } = context;
	const elevations = [at, ...pad].map(groundAt);
	if (!elevations.every(Number.isFinite))
		throw new RangeError('Nonfinite terrain at frame bearing');
	const low = Math.min(...elevations);
	const high = Math.max(...elevations);
	const roof = roofs.find(
		({ roofZ, foundationZ, outline, bearingOutlines = [] }) =>
			foundationZ !== null &&
			foundationZ <= low + frameContactToleranceM &&
			roofZ >= high &&
			fitsRise(top - roofZ) &&
			containsPad(outline, pad) &&
			bearingOutlines.every((ring) => containsPad(ring, pad)) &&
			!blocks(pad, roofZ, top, stock)
	);
	const pier =
		allowPiers &&
		fitsRise(top - low) &&
		top - high >= frameMinimumBearingRiseM &&
		!blocks(pad, low, top, stock);
	if (!roof && !pier) return undefined;
	return Object.freeze({
		id,
		at: Object.freeze([...at, top] as const),
		seat: Object.freeze([...at, roof?.roofZ ?? low] as const),
		ground: Object.freeze([...at, elevations[0]] as const),
		foundation: Object.freeze([...at, roof?.foundationZ ?? low] as const),
		support: Object.freeze(
			roof
				? ({ kind: 'roof', hostId: roof.hostId, seatId: roof.id } as const)
				: ({ kind: 'pier' } as const)
		)
	});
}

type BearingContext = Pick<SupportedFrameSpec, 'groundAt' | 'allowPiers'> &
	Readonly<{
		roofs: readonly FrameRoofSeat[];
		stock: readonly FrameObstruction[];
	}>;

function compareAddress(a: FrameRoofSeat, b: FrameRoofSeat) {
	if (a.roofZ !== b.roofZ) return b.roofZ - a.roofZ;
	const ak = encodeKey([a.hostId, a.id]);
	const bk = encodeKey([b.hostId, b.id]);
	return ak < bk ? -1 : Number(ak !== bk);
}

function selectStations(stations: readonly Station[], plan: FramePlan, context: BearingContext) {
	const rows: FrameBearing[][] = [];
	for (const { id, offsetM } of stations) {
		const row: FrameBearing[] = [];
		for (const [side, y] of [
			['right', plan.rightM],
			['left', plan.leftM]
		] as const) {
			const pad = plan.ring(
				offsetM - collarHalfM,
				offsetM + collarHalfM,
				y - collarHalfM,
				y + collarHalfM
			);
			const bearing = selectBearing(
				encodeKey([id, side]),
				plan.point(offsetM, y),
				pad,
				plan.soffitZ,
				context
			);
			if (!bearing)
				return { status: 'rejected', reason: 'no-grounded-bearing', stationId: id, side } as const;
			row.push(bearing);
		}
		rows.push(row);
	}
	return { status: 'selected', rows } as const;
}

function createPlan(spec: SupportedFrameSpec, length: number) {
	const { start, end, widthM, deckZ } = spec;
	const ux = (end[0] - start[0]) / length;
	const uy = (end[1] - start[1]) / length;
	const point = (x: number, y: number): Vec2 => [
		start[0] + ux * x - uy * y,
		start[1] + uy * x + ux * y
	];
	const ring = (x0: number, x1: number, y0: number, y1: number) =>
		rectangle(x0, x1, y0, y1).map(([x, y]) => point(x, y));
	return {
		length,
		widthM,
		deckZ,
		point,
		ring,
		rotation: Math.atan2(uy, ux),
		rightM: collarHalfM - widthM / half,
		leftM: widthM / half - collarHalfM,
		soffitZ: deckZ - supportedFrameDeckThicknessM - primaryWidthM
	};
}

export type FramePlan = ReturnType<typeof createPlan>;

function terrainObstructsFrame(plan: FramePlan, groundAt: SupportedFrameSpec['groundAt']): boolean {
	const edge = plan.widthM / half;
	const minX = -collarHalfM;
	const maxX = plan.length + collarHalfM;
	const minSteps = /* Exact arithmetic: sample both endpoints of each axis. */ 2;
	const nx = Math.max(minSteps, Math.ceil((maxX - minX) / frameCollarWidthM));
	const ny = Math.max(minSteps, Math.ceil((edge * half) / frameCollarWidthM));
	for (let ix = 0; ix <= nx; ix++) {
		const x = minX + ((maxX - minX) * ix) / nx;
		for (let iy = 0; iy <= ny; iy++) {
			const y = -edge + (edge * half * iy) / ny;
			const z = groundAt(plan.point(x, y));
			if (!Number.isFinite(z)) throw new RangeError('Nonfinite terrain under frame footprint');
			if (z > plan.soffitZ + frameContactToleranceM) return true;
		}
	}
	return false;
}

export function selectFramePlan(spec: SupportedFrameSpec) {
	const { length, stations, roofs } = validateFrameSpec(spec);
	for (const [i, { id, offsetM }] of stations.slice(1).entries()) {
		const from = stations[i];
		const span = offsetM - from.offsetM;
		if (span > frameMaximumSpanM || span < frameCollarWidthM + frameClearBayM)
			return { status: 'rejected', reason: 'span-limit', from: from.id, to: id } as const;
	}
	const plan = createPlan(spec, length);
	if (plan.leftM - plan.rightM > frameMaximumSpanM)
		return { status: 'rejected', reason: 'span-limit', from: 'right', to: 'left' } as const;
	const stock = readStock(roofs, spec.obstructions ?? []);
	const edge = plan.widthM / half;
	const footprint = plan.ring(-collarHalfM, length + collarHalfM, -edge, edge);
	const { frameBayHeightM, secondaryWidthM } = defaults;
	if (
		terrainObstructsFrame(plan, spec.groundAt) ||
		blocks(footprint, plan.soffitZ, plan.deckZ + frameBayHeightM + secondaryWidthM, stock)
	)
		return { status: 'rejected', reason: 'obstructed' } as const;
	const supports = selectStations(stations, plan, {
		groundAt: spec.groundAt,
		allowPiers: spec.allowPiers ?? true,
		roofs: roofs.toSorted(compareAddress),
		stock
	});
	if (supports.status === 'rejected') return supports;
	return { status: 'planned', plan, stations, rows: supports.rows } as const;
}
