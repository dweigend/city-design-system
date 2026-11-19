import { deckCorners, deckParts, WALKWAY_WIDTH_M } from '../walkway';
import { flowToken } from '../../data/focus';
import type { Vec3 } from '../traeger';
/** A pier-free walkway between two supported doors in meters. Returns new ordered
 * deck parts and rails. Coincident plan positions or nonfinite coordinates throw RangeError. */
export function moduleBridge(a: Vec3, b: Vec3, id = 'bridge') {
	if (![...a, ...b].every(Number.isFinite) || Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-8)
		throw new RangeError('Invalid bridge endpoints');
	return deckParts(deckCorners(a, b, WALKWAY_WIDTH_M), id, WALKWAY_WIDTH_M, flowToken.people);
}
