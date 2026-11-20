import type { Vec3 } from '../parametrik/types';
import type { TerrainGrid } from './types';
import { surveyWall } from './wall-survey';

type XY = readonly [number, number];
type Edge = { a: XY; b: XY };
type Frontage = Edge & {
	courtId: string;
	edge: number;
	pavingZ: number;
	earthSide: 'left' | 'right';
};
type Wall = Edge & {
	houseId: string;
	ring: number;
	edge: number;
	start: number;
	end: number;
	footZ: number;
	use: 'wall' | 'party' | 'entrance' | 'flood-opening';
	/** Matched court endpoints in the direction of this wall interval. */
	court?: Frontage;
};

function at(edge: Edge, u: number): [number, number] {
	return [edge.a[0] + (edge.b[0] - edge.a[0]) * u, edge.a[1] + (edge.b[1] - edge.a[1]) * u];
}

const distance = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);
type Station = NonNullable<ReturnType<typeof surveyWall>>[number];

function elevation(stations: Station[], i: number, u: number) {
	const a = stations[i],
		b = stations[i + 1];
	return a.groundZ + ((b.groundZ - a.groundZ) * (u - a.u)) / (b.u - a.u);
}

// Corresponding sections share a station at every break of grade on either edge.
function setback(wall: Edge, court: Frontage, inner: Station[], outer: Station[]) {
	const sorted = [...inner, ...outer].map((s) => s.u).sort((a, b) => a - b);
	const breaks = sorted.filter((u, i) => i === 0 || u - sorted[i - 1] > 1e-9);
	breaks[breaks.length - 1] = 1;
	let i = 0,
		j = 0;
	return breaks.map((u) => {
		while (i + 2 < inner.length && inner[i + 1].u < u) i++;
		while (j + 2 < outer.length && outer[j + 1].u < u) j++;
		const foot: Vec3 = [...at(wall, u), elevation(inner, i, u)];
		const toe: Vec3 = [...at(court, u), elevation(outer, j, u)];
		return { foot, toe, lip: [toe[0], toe[1], court.pavingZ] as Vec3 };
	});
}

// The two rails meet exactly where the survey crosses the paving elevation.
function retainingFaces(rows: ReturnType<typeof setback>, earthSide: Frontage['earthSide']) {
	const faces: Vec3[][] = [];
	for (const [i, b] of rows.slice(1).entries()) {
		const a = rows[i];
		if (Math.abs(a.toe[2] - a.lip[2]) > 1e-9) faces.push([a.toe, b.lip, a.lip]);
		if (Math.abs(b.toe[2] - b.lip[2]) > 1e-9) faces.push([a.toe, b.toe, b.lip]);
	}
	// Expose fill toward the lower strip and cut toward the lower paving.
	return earthSide === 'right' ? faces : faces.map((face) => face.reverse());
}

/** Surveys one homogeneous exterior wall interval. Both XY endpoints name the full directed
 * edge; start/end are original edge fractions. Court endpoints bound just the matched interval.
 * A setback is a ruled earth strip between consecutive foot/toe sections. Its toe/lip face
 * belongs to terrain. On a shared wall the envelope owns that upright face. */
export function wallContact(grid: TerrainGrid, wall: Wall) {
	const { start, end, footZ, court } = wall;
	const missing = {
		kind: 'unsurveyed' as const,
		houseId: wall.houseId,
		ring: wall.ring,
		edge: wall.edge,
		start,
		end
	};
	if (!(start >= 0 && end <= 1 && start < end)) return missing;
	const edge = { a: at(wall, start), b: at(wall, end) };
	const inside = surveyWall(grid, edge, footZ);
	if (!inside) return missing;
	const stations = inside.map((s) => ({
		...s,
		u: start + s.u * (end - start),
		exposedHeight: Math.max(0, footZ - s.groundZ),
		buriedDepth: Math.max(0, s.groundZ - footZ)
	}));
	const owner = wall.use === 'wall' ? ('envelope' as const) : null;
	const base = { ...wall, stations, wallOwner: owner, kind: 'surveyed' as const };
	if (!court) return { ...base, frontage: undefined };
	const outside = surveyWall(grid, court, court.pavingZ);
	if (!outside) return missing;
	const shared = distance(edge.a, court.a) <= 1e-7 && distance(edge.b, court.b) <= 1e-7;
	const relation = shared ? ('shared-face' as const) : ('setback' as const);
	const retainingOwner = shared ? owner : ('terrain' as const);
	const rows = shared ? [] : setback(edge, court, inside, outside);
	return {
		...base,
		frontage: {
			relation,
			retainingOwner,
			sections: rows,
			retainingFaces: retainingFaces(rows, court.earthSide)
		}
	};
}
