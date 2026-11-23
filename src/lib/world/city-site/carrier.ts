import type { Vec2 } from '../../core/geometry';
import { distance } from '../../core/geometry';
import { required } from '../../core/invariant';
import { Random } from '../../core/random';
import {
	cityAccessibility,
	cityGrowth,
	levelHeight,
	type CityPlanVariant
} from '../../domain/city-volume';
import { planCellSide, TerrainGrid } from '../../domain/terrain-grid';
import type { CityTerrainSampler } from './sampling';
import { channelCrossings } from './crossings';

export const cityBankSetbackM = 3;
const edgeSampleStepM = 8;

export const maximumCellRiseM = 16;
const minimumPartAreaM2 = 360_000;

type Site = Readonly<{
	sampleGround: CityTerrainSampler;
	origin: Vec2;
	bearing: number;
	center: Vec2;
	bankSide?: (point: Vec2) => number;
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
	const { grid: candidates, plan } = TerrainGrid.createPlan(
		{
			seed,
			site: { origin, bearing, outline },
			variant,
			parameters: { cellSize: coarseCellSize / planCellSide[variant] },
			maximumCellRise: maximumCellRiseM,
			edgeSampleStep: edgeSampleStepM,

			shore: {
				align: true,
				clearanceAt: (x, y) => sampleGround(x, y).waterClearance - cityBankSetbackM,
				minimumEdge: coarseCellSize / 10,
				minimumArea: 0.24 * coarseCellSize ** 2
			},
			referenceHeightAt: (x, y) => sampleGround(x, y).height,
			heightAt(x, y) {
				const reading = sampleGround(x, y);
				return reading.dry ? reading.height : undefined;
			}
		},
		(point) => {
			const ground = sampleGround(...point);
			return ground.dry ? 'dry' : (ground.waterKind ?? 'water');
		}
	);
	const random = Random.create({ seed }).derive('crossing');
	const shift = random.number({ min: -140, max: 140 });
	const crossing = crossingCenter(center, u, v, sampleGround);
	const core: Vec2 = crossing?.point ?? [center[0] - shift * v, center[1] + shift * u];
	const crossings = channelCrossings(plan, candidates, sampleGround, core);
	const nodes = new Map(plan.vertices.map(({ id, position: [x, y] }) => [id, [x, y] as Vec2]));
	const primary = crossings
		.filter(
			({ midpoint, heads: [a, b] }) =>
				sampleGround(...midpoint).waterKind === 'river' &&
				(!site.bankSide ||
					site.bankSide(required(nodes.get(a.nodeId), 'first bank node')) !==
						site.bankSide(required(nodes.get(b.nodeId), 'second bank node')))
		)
		.sort(
			(a, b) =>
				distance(core, a.midpoint) +
				0.45 * a.path.lengthM -
				distance(core, b.midpoint) -
				0.45 * b.path.lengthM
		)[0];
	const approaches = primary?.heads
		.map(({ nodeId }) => required(nodes.get(nodeId), 'approach node'))
		.sort((a, b) => (site.bankSide ? site.bankSide(a) - site.bankSide(b) : a[0] - b[0]));
	const first = approaches?.[0] ?? core;
	const second = approaches?.[1];
	const side = site.bankSide;
	const secondSide = second && side?.(second);
	const secondBank = (point: Vec2) => {
		if (!second) return false;
		return secondSide && side
			? side(point) === secondSide
			: distance(point, second) < distance(point, first);
	};
	const access = cityAccessibility(seed, [first, second], bearing, sampleGround, secondBank);
	const links = crossings.flatMap(({ heads: [a, b], path }) =>
		a.cellIds.flatMap((from) =>
			b.cellIds.map((to) => ({
				headIds: [from, to] as const,
				spanM: path.lengthM
			}))
		)
	);
	const order = cityGrowth(
		candidates,
		(point, grade) => access(point, grade, sampleGround(...point).waterClearance),
		minimumPartAreaM2,
		links
	);
	const ranks = new Map(order.map(({ id }, index) => [id, index]));
	const lowest = candidates.vertices.reduce(
		(low, { position }) => Math.min(low, position[2]),
		Infinity
	);
	const datumZ = Number.isFinite(lowest) ? levelHeight * Math.floor(lowest / levelHeight) : 0;
	return { candidates, plan, crossings, order, ranks, datumZ };
}
