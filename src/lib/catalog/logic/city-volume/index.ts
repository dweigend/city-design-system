import { projectGroundReservations, type GroundPlan } from '../city-plan';
import { createOccupancy } from '../occupancy';
import { liftEnvelope, type VolumeOptions } from './envelope';
import { volumeSpace } from './space';
import { localSubgrids } from './subgrid';

export type { VolumeOptions } from './envelope';
export type CityVolume = ReturnType<typeof deriveCityVolume>;

/**
 * Lifts a seeded ground plan into detached coarse and active leaf spaces in world metres, Z up.
 * Heights are terrain-relative (1–32 m, defaults 24 m dense and 7 m low). Both exceed
 * path clearance. The upper layer of two adjacent ground pieces is refined at half-height.
 * Bindings carry ground, coarse and leaf addresses. Cell spaces emit in lexical ID order.
 * Occupancy starts empty. Reservations retain plan area owners. No draws or input mutation.
 * @throws {RangeError} For incompatible heights, a non-adjacent pair or invalid geometry.
 */
export function deriveCityVolume(plan: GroundPlan, options: VolumeOptions = {}) {
	const { refineGroundPair, ...profile } = options;
	const { columns, clearance } = liftEnvelope(plan, profile);
	const subgrids = localSubgrids(plan, columns, refineGroundPair);
	const coarse = volumeSpace(plan.id, columns, clearance).space;
	const { space: leaves, bindings } = volumeSpace(plan.id, columns, clearance, subgrids);
	const skyOwners = new Set(
		plan.areas
			.filter((area) => 'reserve' in area && area.reserve.kind === 'open-to-sky')
			.map((area) => area.id)
	);
	const protectedGround = new Map<string, string>();
	for (const { groundId, leafId, layer } of bindings) {
		const owner = plan.reservations.get(groundId);
		if (owner && (layer === 'lower' || skyOwners.has(owner))) protectedGround.set(leafId, groundId);
	}
	return {
		coarse,
		leaves,
		bindings,
		occupancy: createOccupancy(leaves),
		reservations: projectGroundReservations(plan, leaves, protectedGround)
	};
}
