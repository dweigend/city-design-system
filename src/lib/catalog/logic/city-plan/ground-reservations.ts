import type { CellSpace } from '../cell-space';
import type { Reservations } from '../occupancy';
import type { GroundPlan } from './ground-plan';

/**
 * Projects plan reserves into a target cell space using leaf ID → reserved ground cell ID.
 * The volume producer selects the protected leaves from the plan areas and their scope.
 * Several leaves can share one ground source. Unlisted leaves are left unreserved.
 * Returns a detached reservation map in lexical leaf ID order, retaining each area owner.
 * The mapping uses IDs only, has no defaults and leaves all inputs intact.
 * @throws {RangeError} If a target leaf is unknown or a source has no ground reserve.
 */
export function projectGroundReservations(
	plan: GroundPlan,
	space: CellSpace,
	groundByLeaf: ReadonlyMap<string, string>
): Reservations {
	const leaves = new Set(space.cells.map(({ id }) => id));
	const reservations = new Map<string, string>();
	for (const id of [...groundByLeaf.keys()].sort()) {
		if (!leaves.has(id)) throw new RangeError('Unknown reservation leaf: ' + id);
		const source = groundByLeaf.get(id);
		const owner = source === undefined ? undefined : plan.reservations.get(source);
		if (owner === undefined) throw new RangeError('Unknown ground reserve: ' + source);
		reservations.set(id, owner);
	}
	return reservations;
}
