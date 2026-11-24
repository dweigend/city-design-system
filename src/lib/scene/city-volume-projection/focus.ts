import type { DistrictKind } from '../../domain/city-volume';
import type { Drawable } from '../surface';
import { cityFocusPreset } from './focus-policy';
import { planOverlayIds } from './plan-water';

/** A choice in the city's focus menu. */
export type FocusChoice = (typeof cityFocusPreset.choices)[number];
/** A projection row in the city preset. */
export type Subsystem = (typeof cityFocusPreset.subsystems)[number];

const kinds = ['detached', 'block', 'center'] as const satisfies readonly DistrictKind[];

/** Overlay ids and the focus row each projection contributes. */
export const overlaySubsystems: ReadonlyMap<string, Subsystem> = new Map(
	Object.entries(planOverlayIds).map(([slot, id]) => [id, slot as keyof typeof planOverlayIds])
);

/** What a city picture holds besides terrain and water. */
export type CityContent = Readonly<{
	shares: Readonly<Record<DistrictKind, number>>;
	lattice: boolean;
	planDrawables: readonly Pick<Drawable, 'id'>[];
}>;

/** Resolves a requested focus for one city picture: the subsystems it holds, the choices worth
 * offering in menu order with their labels, the choice in effect (the fallback when the request is
 * not offered) and its analysis colouring. */
export function cityFocus(
	{ shares, lattice, planDrawables }: CityContent,
	requested: FocusChoice | undefined,
	fallback: FocusChoice = 'all'
) {
	const present: Subsystem[] = [
		'terrain',
		'water',
		...planDrawables.flatMap(({ id }) => overlaySubsystems.get(id) ?? []),
		...kinds.filter((kind) => shares[kind] > 0),
		...(lattice ? (['lattice'] as const) : [])
	];
	const { items, active, analysis } = cityFocusPreset.selectFocus(present, requested, fallback);
	return { items, active, analysis };
}
