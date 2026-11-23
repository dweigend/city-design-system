import { defaults } from './settings';
import { easeBank } from './ground-profile';
import { interpolate, radius, triangle } from './catchment-grid';
import type { drainageTerrain } from './drainage-terrain';
import { millimetersPerMeter, toMillimeters } from './millimeters';
import { smoothstep } from './regional-profile';
import { spillBarriers } from './spill-barriers';
import { bankLimit, waterIndex } from './water-index';

const { analyticBenchFadeReliefRatio, trunkBankBlendRunM, secondaryBankBlendRunM } = defaults;

export type WaterKind = 'river' | 'tributary' | 'lake' | null;

const millimeters = (value: number) => toMillimeters(value) / millimetersPerMeter;

export function terrainSampler(terrain: ReturnType<typeof drainageTerrain>, relief: number) {
	const { reaches, lakes, flow, field } = terrain;
	const index = waterIndex(reaches, lakes);
	const blendBenches = 1 - smoothstep(relief / analyticBenchFadeReliefRatio);
	const { datum, terraces } = field;
	type Correction = ReturnType<typeof spillBarriers>;
	function sample(x: number, y: number, correct?: Correction) {
		if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('invalid-ground-position');
		if (Math.abs(x) > radius || Math.abs(y) > radius)
			throw new RangeError('outside-drainage-solve');
		const facet = blendBenches < 1 || lakes.length > 0 ? triangle(x, y) : undefined;
		if (facet && lakes.length > 0) {
			const basin = Math.max(
				flow.membership[facet.a],
				flow.membership[facet.b],
				flow.membership[facet.c]
			);
			const lake = lakes[basin];
			if (lake) {
				const base = interpolate(flow.bed, facet);
				if (base < lake.level)
					return {
						height: millimeters(base),
						water: lake.level,
						bank: index.shore(x, y, lake)?.bank ?? -bankLimit,
						waterKind: 'lake' as const,
						lakeId: lake.id
					};
			}
		}
		const adjustment = facet && correct ? correct(facet) : 0;
		const channel = index.channel(x, y);
		if (channel && channel.bank < 0) {
			const height = millimeters(channel.water - channel.depth + adjustment);
			const water = millimeters(channel.water);
			const wet = height <= water;
			return {
				height,
				water: wet ? water : height,
				bank: wet ? channel.bank : 0,
				waterKind: wet ? channel.kind : null,
				lakeId: null
			};
		}
		const shore = index.shore(x, y, undefined);
		const bank = Math.min(channel?.bank ?? bankLimit, shore?.bank ?? bankLimit);
		const reference =
			shore && shore.bank <= (channel?.bank ?? bankLimit) ? shore.lake.level : channel?.water;
		const downstreamDatum = datum(x, y);
		const dryReference = reference ?? downstreamDatum;
		const water =
			downstreamDatum + (dryReference - downstreamDatum) * (1 - smoothstep(bank / bankLimit));
		// Evaluate the inherited benches at the query coordinate. The solve raster
		// supplies the higher-relief surface and the wetted terrain.
		const ground =
			(facet && blendBenches < 1 ? interpolate(flow.bed, facet) * (1 - blendBenches) : 0) +
			(blendBenches > 0 ? (terraces(x, y) + downstreamDatum) * blendBenches : 0);
		const run = channel?.kind === 'river' ? trunkBankBlendRunM : secondaryBankBlendRunM;
		const t = Math.min(1, bank / run);
		const height =
			channel && channel.bank <= bank
				? channel.water + easeBank(ground - channel.water, t)
				: ground;
		const bed = millimeters(Math.max(height, water) + adjustment);
		return {
			height: bed,
			water: Math.min(bed, millimeters(water)),
			bank,
			waterKind: null as WaterKind,
			lakeId: null
		};
	}
	if (!lakes.length) return (x: number, y: number) => sample(x, y);
	const correct = spillBarriers(flow, (x, y) => sample(x, y).height);
	return (x: number, y: number) => sample(x, y, correct);
}
