import type { Vec2 } from '../../core/geometry';
import { Random } from '../../core/random';
import {
	cityAccessibility,
	cityGrowth,
	levelHeight,
	type CityPlanVariant
} from '../../domain/city-volume';
import { planCellSide, TerrainGrid } from '../../domain/terrain-grid';
import type { WaterKind } from '../../domain/valley';

const bankSetbackM = 3;
const edgeSampleStepM = 8;

export const maximumCellRiseM = 16;
const minimumPartAreaM2 = 360_000;

export type CityTerrainSampler = (
	x: number,
	y: number
) => Readonly<{
	height: number;
	dry: boolean;
	waterClearance: number;
	waterKind?: WaterKind;
}>;

type Site = Readonly<{
	sampleGround: CityTerrainSampler;
	origin: Vec2;
	bearing: number;
	center: Vec2;
}>;

// Look for a narrow cross section near the seeded station. Water widths are measured
// from the same terrain readings used for the plan, at 12 m intervals across the belt.
function crossingCenter(center: Vec2, u: number, v: number, sample: CityTerrainSampler) {
	let best: { point: Vec2; width: number } | undefined;
	let bestCost = Infinity;
	for (let along = -520; along <= 520; along += 65) {
		const x = center[0] + along * u;
		const y = center[1] + along * v;
		let entrance: number | undefined;
		for (let across = -1500; across <= 1500; across += 12) {
			const kind = sample(x - across * v, y + across * u).waterKind;
			if (kind === 'river') {
				entrance ??= across - 6;
				continue;
			}
			if (entrance === undefined) continue;
			const width = across - 6 - entrance;
			const midpoint = entrance + width / 2;
			const cost = 3 * width + Math.abs(along) + 0.35 * Math.abs(midpoint);
			if (kind !== 'lake' && cost < bestCost) {
				bestCost = cost;
				best = { point: [x - midpoint * v, y + midpoint * u], width };
			}
			entrance = undefined;
		}
	}
	return best;
}

const crossingDirections = Array.from({ length: 8 }, (_, i) => {
	const angle = (i * Math.PI) / 4;
	return [Math.cos(angle), Math.sin(angle)] as const;
});

// A local access credit requires a flowing channel and dry ground on the other side.
// Rays longer than 100 m do not count as local crossings, and lakes have no credit.
function crossingCredit([x, y]: Vec2, clearance: number, sample: CityTerrainSampler) {
	if (clearance > 42) return 0;
	let shortest = 100;
	for (const [u, v] of crossingDirections) {
		let entrance: number | undefined;
		for (let d = 5; d < shortest; d += 5) {
			const kind = sample(x + d * u, y + d * v).waterKind;
			if (kind === 'lake' || (entrance === undefined && d > clearance + 22)) break;
			if (kind === 'river' || kind === 'tributary') entrance ??= d;
			else if (entrance !== undefined) {
				shortest = d;
				break;
			}
		}
	}
	return 0.65 * (100 - shortest);
}

export function prepareCarrier(
	site: Site,
	coarseCellSize: number,
	variant: CityPlanVariant,
	seed: number
) {
	const { sampleGround, origin, bearing, center } = site;
	const span = { along: 3500, across: 1900 };
	const u = Math.cos(bearing);
	const v = Math.sin(bearing);
	const outline = [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1]
	].map(([a, b]): Vec2 => [
		origin[0] + a * span.along * u - b * span.across * v,
		origin[1] + a * span.along * v + b * span.across * u
	]);
	const candidates = TerrainGrid.create({
		seed,
		site: { origin, bearing, outline },
		variant,
		parameters: { cellSize: coarseCellSize / planCellSide[variant] },
		maximumCellRise: maximumCellRiseM,
		edgeSampleStep: edgeSampleStepM,

		shore: {
			clearanceAt: (x, y) => sampleGround(x, y).waterClearance - bankSetbackM,
			minimumEdge: coarseCellSize / 10,
			minimumArea: 0.24 * coarseCellSize ** 2
		},
		referenceHeightAt: (x, y) => sampleGround(x, y).height,
		heightAt(x, y) {
			const reading = sampleGround(x, y);
			return reading.dry ? reading.height : undefined;
		}
	});
	const random = Random.create({ seed }).derive('crossing');
	const shift = random.number({ min: -140, max: 140 });
	const crossing = crossingCenter(center, u, v, sampleGround);
	const core: Vec2 = crossing?.point ?? [center[0] - shift * v, center[1] + shift * u];
	const approachM = crossing ? crossing.width / 2 + 135 : 0;
	const access = cityAccessibility(seed, core, bearing, approachM);
	const order = cityGrowth(
		candidates,
		(point, grade) => {
			const clearance = sampleGround(...point).waterClearance;
			return access(point, grade, clearance) - crossingCredit(point, clearance, sampleGround);
		},
		minimumPartAreaM2
	);
	const ranks = new Map(order.map(({ id }, index) => [id, index]));
	const lowest = candidates.vertices.reduce(
		(low, { position }) => Math.min(low, position[2]),
		Infinity
	);
	const datumZ = Number.isFinite(lowest) ? levelHeight * Math.floor(lowest / levelHeight) : 0;
	return { candidates, order, ranks, datumZ };
}
