import type { DistrictKind } from '../../domain/city-volume';
import { cityFocusPreset } from './focus-policy';

/** A choice in the city's focus menu. */
export type FocusChoice = (typeof cityFocusPreset.choices)[number];
/** A projection row in the city preset. */
export type Subsystem = (typeof cityFocusPreset.subsystems)[number];

const { offerFocus, readFocusChoice } = cityFocusPreset;

const kinds = ['detached', 'block', 'center'] as const satisfies readonly DistrictKind[];

/** What a city picture holds besides terrain, water and the plan grid. */
export type CityContent = Readonly<{
	shares: Readonly<Record<DistrictKind, number>>;
	lattice: boolean;
	waterCells: boolean;
	crossings: boolean;
	parcels?: readonly Subsystem[];
}>;

/** Resolves a requested focus for one city picture: the subsystems it holds, the choices worth
 * offering in menu order with their labels, the choice in effect (the fallback when the request is
 * not offered) and its analysis colouring. */
export function cityFocus(
	{ shares, lattice, waterCells, crossings, parcels = [] }: CityContent,
	requested: FocusChoice | undefined,
	fallback: FocusChoice = 'all'
) {
	const present: Subsystem[] = [
		'terrain',
		'water',
		'plan',
		...(waterCells ? (['water-cells'] as const) : []),
		...(crossings ? (['crossings'] as const) : []),
		...parcels,
		...kinds.filter((kind) => shares[kind] > 0),
		...(lattice ? (['lattice'] as const) : [])
	];
	const offered = offerFocus(present);
	const wanted = requested ?? fallback;
	const active = offered.includes(wanted) ? wanted : offered.includes(fallback) ? fallback : 'all';
	return {
		items: offered.map((value) => ({ value, label: readFocusChoice(value).label })),
		active,
		analysis: readFocusChoice(active).analysis
	};
}
