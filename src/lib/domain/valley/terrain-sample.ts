import { interpolate, radius, triangle } from './catchment-grid';
import type { drainageTerrain } from './drainage-terrain';
import { toMillimeters } from './millimeters';
import { smoothstep } from './regional-profile';
import { bankLimit, waterIndex } from './water-index';

export type WaterKind = 'river' | 'tributary' | 'lake' | null;

const millimeters = (value: number) => toMillimeters(value) / 1000;

export function terrainSampler(terrain: ReturnType<typeof drainageTerrain>, relief: number) {
	const { reaches, lakes, flow, field } = terrain;
	const index = waterIndex(reaches, lakes);
	const blendBenches = 1 - smoothstep(relief / 0.15);
	const { datum, terraces } = field;
	const outside = (x: number, y: number) => x < -radius || x > radius || y < -radius || y > radius;
	return (x: number, y: number) => {
		if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('invalid-ground-position');
		if (outside(x, y))
			return {
				height: millimeters(field.ground(x, y)),
				water: millimeters(datum(x, y)),
				bank: bankLimit,
				waterKind: null,
				lakeId: null
			};
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
		const channel = index.channel(x, y);
		if (channel && channel.bank < 0) {
			return {
				height: millimeters(channel.water - channel.depth),
				water: millimeters(channel.water),
				bank: channel.bank,
				waterKind: channel.kind,
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
		const run = channel?.kind === 'river' ? 36 : 30;
		const t = Math.min(1, bank / run);
		const height =
			channel && channel.bank <= bank
				? channel.water + (ground - channel.water) * t * (2 - t)
				: ground;
		return {
			height: millimeters(Math.max(height, water)),
			water: millimeters(water),
			bank,
			waterKind: null as WaterKind,
			lakeId: null
		};
	};
}
