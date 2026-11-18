import { flows } from './focus';
import type { AusfuehrungId } from './materialAusfuehrung';
import type { FamilieId } from './materialSeite';

export const pickerMaterialien: readonly FamilieId[] = [
	'beton',
	'holz',
	'metall',
	'keramik',
	'kunststoff',
	'glas',
	'membran'
];
export const pickerFarben = ['natur', 'people', 'water', 'energy', 'food', 'material'] as const;
export const pickerFarbNamen: ReadonlyMap<string, string> = new Map<string, string>([
	['natur', 'Natural'],
	...flows.map(({ id, name }) => [id, name] as const)
]);
export const ausgeschlosseneTexturen: ReadonlySet<AusfuehrungId> = new Set([
	'metall-signalrot',
	'metall-kalkgruen',
	'metall-graphit'
]);
/** Lowest pigment share of a skin that takes a flow color, so the color reads at house scale. */
export const MIN_FARBANTEIL = 0.7;
/** Blue-based finishes need a higher share so other flows do not turn purple or grey. */
export const farbAnteilVon: Partial<Record<AusfuehrungId, number>> = {
	'membran-beschichtet': 0.92,
	'kunststoff-gerippt': 0.92,
	'membran-flor': 0.92
};
/** Pigment share of the accent zone (door, cornice, plinth) when it carries the color. */
export const AKZENT_ANTEIL = 0.9;
/** Wheel order per family where the native finish's neighbour should differ at a glance. */
export const texturFolge: Partial<Record<FamilieId, readonly AusfuehrungId[]>> = {
	keramik: ['keramik-glasiert', 'keramik-schachbrett', 'keramik-ton']
};
