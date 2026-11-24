import type { DistrictKind } from '../../domain/city-volume';
import { offerFocus, readFocusChoice, type FocusChoice, type Subsystem } from '../focus';

const kinds = ['detached', 'block', 'center'] as const satisfies readonly DistrictKind[];

/** What a city picture holds besides terrain, water and the plan grid. */
export type CityContent = Readonly<{
	shares: Readonly<Record<DistrictKind, number>>;
	lattice: boolean;
	waterCells: boolean;
	crossings: boolean;
	additional?: readonly Subsystem[];
}>;

/** Resolves a requested focus for one city picture: the subsystems it holds, the choices worth
 * offering in menu order with their labels, the choice in effect (the fallback when the request is
 * not offered) and its analysis colouring. */
export function cityFocus(
	{ shares, lattice, waterCells, crossings, additional = [] }: CityContent,
	requested: FocusChoice | undefined,
	fallback: FocusChoice = 'all'
) {
	const present: Subsystem[] = [
		'terrain',
		'water',
		'plan',
		...(waterCells ? (['water-cells'] as const) : []),
		...(crossings ? (['crossings'] as const) : []),
		...kinds.filter((kind) => shares[kind] > 0),
		...(lattice ? (['lattice'] as const) : []),
		...additional
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
