import { defaults } from '../../../config/cell-space';
import { isFiniteVector } from '../../core/geometry';
import { encodeKey } from '../../core/ref';
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
	if (!Array.from(corners).every((corner) => isFiniteVector(corner?.position, 2)))
		throw new RangeError('Parcel corners need finite plan positions');
	if (new Set(corners.map(({ id }) => id)).size !== corners.length)
		throw new RangeError('Parcel corner keys must be unique');
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

/** Identity of the parcel edge from one corner key to the next. */
export function parcelEdgeId(from: string, to: string): string {
	return encodeKey([from, to]);
}

/** Checks corners, frontage edge identities, base elevation, storeys and refinement rounds. */
export function validate(parcel: Parcel, rounds: number) {
	if (!Number.isFinite(parcel.baseZ)) throw new RangeError('baseZ must be finite');
	validateRing(parcel);
	const { corners, frontage, storeyCount, storeyHeightM } = parcel;
	const edges = new Set(
		corners.map(({ id }, i) => parcelEdgeId(id, corners[(i + 1) % corners.length].id))
	);
	if (!frontage.every((edge) => edges.has(edge)))
		throw new RangeError('Frontage must name parcel edges from one corner to the next');
	if (!(parcel.courtEdges ?? []).every((edge) => edges.has(edge) && !frontage.includes(edge)))
		throw new RangeError('Court edges must name parcel edges that are not frontage');
	if (!Number.isInteger(storeyCount) || storeyCount < 1)
		throw new RangeError('A cell space needs at least one storey');
	if (storeyHeightM !== undefined && !(storeyHeightM > 0 && Number.isFinite(storeyHeightM)))
		throw new RangeError('Storey height must be a positive length');
	if (!Number.isInteger(rounds) || rounds < 0 || rounds > maximumRefinementRounds)
		throw new RangeError(
			`Refinement rounds must be an integer from 0 to ${maximumRefinementRounds}`
		);
}
