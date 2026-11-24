import { latticeVariants, type LatticeVariant } from '../../domain/city-volume';
import type { PlanVariant } from '../../domain/terrain-grid';

/** Tiled plan families offered by the city chapter and the lattice models each may use.
 * The chapter terrain mask can open holes on polar and free-quad carriers. */
export const cityLatticesByPlan = Object.freeze({
	organic: latticeVariants,
	square: latticeVariants,
	hex: latticeVariants,
	triangle: latticeVariants,
	bands: latticeVariants,
	contour: latticeVariants,
	voronoi: latticeVariants
} satisfies Partial<Record<PlanVariant, readonly LatticeVariant[]>>);

/** Plan families offered by the city chapter. */
export type CityPlanVariant = keyof typeof cityLatticesByPlan;

/** Chapter plan families in display order. */
export const cityPlanVariants = Object.freeze(Object.keys(cityLatticesByPlan) as CityPlanVariant[]);
