import { defaults } from '../../../config/city-movement';
import type { Vec2 } from '../../core/geometry';
import type { CityGrid, CitySite } from '../city-site';
import type { CityRailOptions } from './rail';

export function readCityCrossingHeads(layout: CityGrid): readonly string[] {
	return layout.selectedCrossings[0]?.heads.map(({ nodeId }) => nodeId) ?? [];
}

export function createCityRailSurvey(
	site: CitySite,
	layout: CityGrid,
	heads: readonly string[]
): CityRailOptions {
	const head = layout.grid.vertices.find(({ id }) => id === heads[0]);
	const center: Vec2 = head ? [head.position[0], head.position[1]] : site.origin;
	const { bearing } = site.frame;
	const half =
		defaults.railCatchmentSpacingM / /* Exact arithmetic: half the catchment spacing. */ 2;
	const surface = ([x, y]: Vec2) => {
		const ground = site.sampleGround(x, y);
		return Math.max(ground.height, ground.waterHeight ?? -Infinity);
	};
	return {
		center,
		catchments: [
			{
				id: 'upstream',
				center: [center[0] - Math.cos(bearing) * half, center[1] - Math.sin(bearing) * half]
			},
			{
				id: 'downstream',
				center: [center[0] + Math.cos(bearing) * half, center[1] + Math.sin(bearing) * half]
			}
		],
		// The survey covers terrain and water with a configured grade envelope.
		readSpanUpperM(a, b) {
			const midpoint: Vec2 = [
				(a[0] + b[0]) / /* Exact arithmetic: midpoint. */ 2,
				(a[1] + b[1]) / /* Exact arithmetic: midpoint. */ 2
			];
			const nearestProbeM =
				Math.hypot(b[0] - a[0], b[1] - a[1]) /
				/* Exact arithmetic: three equally spaced probes. */ 4;
			return (
				Math.max(surface(a), surface(b), surface(midpoint)) +
				nearestProbeM * defaults.railTerrainSlopeBoundRatio
			);
		}
	};
}
