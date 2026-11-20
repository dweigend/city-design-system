import type { CityPlan } from '../city-plan';

/** Parcels occupied by the built ensemble, including its landmark and public court. */
export function courtReservations(city?: CityPlan) {
	return (city?.centres ?? []).flatMap((c) => [
		c.landmark.cellId,
		...c.lots,
		...(c.ensembles ?? []).flatMap((e) => [e.court, ...(e.plaza?.cells ?? [])])
	]);
}
