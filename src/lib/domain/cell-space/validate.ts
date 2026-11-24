import { defaults } from '../../../config/cell-space';
import { doubleArea } from './split';
import type { Parcel } from './types';

const { minimumEdgeM, maximumRefinementRounds } = defaults;

/** A parcel whose edges or area vanish at the cell-space tolerance. */
export class DegenerateParcelError extends RangeError {
	override name = 'DegenerateParcelError';
}

// Exact arithmetic: a ring needs three corners.
function validateRing({ corners }: Parcel) {
	if (corners.length < 3) throw new RangeError('A parcel needs at least three corners');
	if (new Set(corners.map(({ id }) => id)).size !== corners.length)
		throw new RangeError('Parcel corner keys must be unique');
	if (!corners.every(({ position }) => position.length === 2 && position.every(Number.isFinite)))
		throw new RangeError('Parcel corners need finite plan positions');
	const points = corners.map(({ position }) => position);
	points.forEach(([ax, ay], i) => {
		const [bx, by] = points[(i + 1) % points.length];
		if (Math.hypot(bx - ax, by - ay) < minimumEdgeM)
			throw new DegenerateParcelError(`Parcel edge ${i} is shorter than ${minimumEdgeM} m`);
	});
	const area = doubleArea(points);
	if (Math.abs(area) < minimumEdgeM * minimumEdgeM)
		throw new DegenerateParcelError('Parcel area vanishes');
	if (area < 0) throw new RangeError('Parcel corners must run counterclockwise');
}

/** Checks corners, frontage edge identities, storeys and the refinement rounds. */
export function validate(parcel: Parcel, rounds: number) {
	validateRing(parcel);
	const { corners, frontage, storeyCount, storeyHeightM } = parcel;
	const edges = new Set(
		corners.map(({ id }, i) => JSON.stringify([id, corners[(i + 1) % corners.length].id]))
	);
	if (!frontage.every((edge) => edges.has(edge)))
		throw new RangeError('Frontage must name parcel edges from one corner to the next');
	if (!Number.isInteger(storeyCount) || storeyCount < 1)
		throw new RangeError('A cell space needs at least one storey');
	if (storeyHeightM !== undefined && !(storeyHeightM > 0 && Number.isFinite(storeyHeightM)))
		throw new RangeError('Storey height must be a positive length');
	if (!Number.isInteger(rounds) || rounds < 0 || rounds > maximumRefinementRounds)
		throw new RangeError(
			`Refinement rounds must be an integer from 0 to ${maximumRefinementRounds}`
		);
}
