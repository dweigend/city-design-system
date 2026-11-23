import type { Vec2 } from '../../core/geometry';
import { Random } from '../../core/random';
import {
	cityAccessibility,
	cityGrowth,
	levelHeight,
	type CityPlanVariant
} from '../../domain/city-volume';
import { planCellSide, TerrainGrid } from '../../domain/terrain-grid';
import { surveyDefaults } from '../../domain/valley';

const bankSetbackM = 3;
const edgeSampleStepM = 8;
const surfaceSampleStepM = 12;
const buildableSlopeLimit = surveyDefaults.buildableSlope;

export type CityTerrainSampler = (
	x: number,
	y: number
) => Readonly<{
	height: number;
	dry: boolean;
	waterClearance: number;
	slope?: number;
}>;

type Site = Readonly<{
	sampleGround: CityTerrainSampler;
	origin: Vec2;
	bearing: number;
	center: Vec2;
}>;

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
		maximumCellGrade: buildableSlopeLimit,
		edgeSampleStep: edgeSampleStepM,
		surface: {
			sampleStep: surfaceSampleStepM,
			accepts(x, y) {
				const reading = sampleGround(x, y);
				return reading.dry && (reading.slope ?? 0) <= buildableSlopeLimit;
			}
		},
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
	const core: Vec2 = [center[0] - shift * v, center[1] + shift * u];
	const access = cityAccessibility(seed, core, bearing);
	const order = cityGrowth(candidates, (point, grade) =>
		access(point, grade, sampleGround(...point).waterClearance)
	);
	const ranks = new Map(order.map(({ id }, index) => [id, index]));
	const lowest = candidates.vertices.reduce(
		(low, { position }) => Math.min(low, position[2]),
		Infinity
	);
	const datumZ = Number.isFinite(lowest) ? levelHeight * Math.floor(lowest / levelHeight) : 0;
	return { candidates, order, ranks, datumZ };
}
