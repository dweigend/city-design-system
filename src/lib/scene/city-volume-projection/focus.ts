import type { DistrictKind } from '../../domain/city-volume';
import { offerFocus, readFocusChoice, type FocusChoice, type Subsystem } from '../focus';

const kinds = ['detached', 'block', 'center'] as const satisfies readonly DistrictKind[];

/** Resolves a requested focus for one city picture: the subsystems it holds, the choices worth
 * offering in menu order with their labels, the choice in effect (All when the request is not
 * offered) and its analysis colouring. */
export function cityFocus(
	shares: Readonly<Record<DistrictKind, number>>,
	lattice: boolean,
	requested: FocusChoice
) {
	const present: Subsystem[] = [
		'terrain',
		'water',
		...kinds.filter((kind) => shares[kind] > 0),
		...(lattice ? (['lattice'] as const) : [])
	];
	const offered = offerFocus(present);
	const active = offered.includes(requested) ? requested : 'all';
	return {
		items: offered.map((value) => ({ value, label: readFocusChoice(value).label })),
		active,
		analysis: readFocusChoice(active).analysis
	};
}
