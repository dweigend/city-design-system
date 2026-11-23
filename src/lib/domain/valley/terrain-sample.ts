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
	const datum = field.datum;
	const outside = (x: number, y: number) => Math.abs(x) > radius || Math.abs(y) > radius;
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
		const facet = triangle(x, y);
		const base = interpolate(flow.bed, facet);
		const basin = Math.max(
			flow.membership[facet.a],
			flow.membership[facet.b],
			flow.membership[facet.c]
		);
		const lake = lakes[basin];
		const inside = lake && base < lake.level ? lake : undefined;
		const shore = index.shore(x, y, inside);
		const channel = index.channel(x, y);
		if (inside) {
			return {
				height: millimeters(base),
				water: inside.level,
				bank: shore?.bank ?? -bankLimit,
				waterKind: 'lake' as const,
				lakeId: inside.id
			};
		}
		if (channel && channel.bank < 0) {
			return {
				height: millimeters(channel.water - channel.depth),
				water: millimeters(channel.water),
				bank: channel.bank,
				waterKind: channel.kind,
				lakeId: null
			};
		}
		const bank = Math.min(channel?.bank ?? bankLimit, shore?.bank ?? bankLimit);
		const reference =
			shore && shore.bank <= (channel?.bank ?? bankLimit) ? shore.lake.level : channel?.water;
		const downstreamDatum = datum(x, y);
		const dryReference = reference ?? downstreamDatum;
		const water =
			downstreamDatum + (dryReference - downstreamDatum) * (1 - smoothstep(bank / bankLimit));
		// The continuous alluvial benches preserve their short terrace risers inside the
		// measurement window. Higher relief and the outer belt use the routed triangles.
		const bench = blendBenches && 1 - smoothstep((Math.sqrt(x * x + y * y) - 1350) / 450);
		const ground = bench ? base + (field.terraces(x, y) + downstreamDatum - base) * bench : base;
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
