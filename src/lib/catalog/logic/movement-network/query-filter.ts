import type { MovementEdge, MovementPathQuery, MovementPort } from './types';

// Dimensionless grade comparison tolerance from ST1 build-space contract.
const gradeTolerance = 1e-9;
// Width and headroom bound comparison tolerance in metres.
const dimensionTolerance = 1e-9;

/** Throws RangeError for a supplied numeric bound outside the finite nonnegative range. */
export function validateQuery(query: MovementPathQuery | undefined) {
	if (!query) return;
	for (const [name, value] of [
		['maxGrade', query.maxGrade],
		['minWidth', query.minWidth],
		['minHeadroom', query.minHeadroom]
	] as const) {
		if (value !== undefined && (!Number.isFinite(value) || value < 0))
			throw new RangeError(`Invalid movement query ${name}: ${value}`);
	}
}

/** Checks the port's recorded width and headroom in metres against the optional minima. */
export function portAdmitted(port: MovementPort, query: MovementPathQuery | undefined) {
	if (!query) return true;
	const widthOk = query.minWidth === undefined || port.width + dimensionTolerance >= query.minWidth;
	const headroomOk =
		query.minHeadroom === undefined || port.headroom + dimensionTolerance >= query.minHeadroom;
	return widthOk && headroomOk;
}

function edgeBoundsAdmitted(edge: MovementEdge, query: MovementPathQuery) {
	if (query.maxGrade !== undefined && edge.maxGrade > query.maxGrade + gradeTolerance) return false;
	return query.minWidth === undefined || edge.width + dimensionTolerance >= query.minWidth;
}

/** Checks both ports and the edge against the optional mode, kind, grade and clearance filters. */
export function edgeAdmitted(
	edge: MovementEdge,
	from: MovementPort,
	to: MovementPort,
	query: MovementPathQuery | undefined
) {
	if (!query) return true;
	if (!portAdmitted(from, query) || !portAdmitted(to, query)) return false;
	if (query.modes && !query.modes.includes(edge.mode)) return false;
	if (query.excludeKinds?.includes(edge.kind)) return false;
	return edgeBoundsAdmitted(edge, query);
}
