import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { blockInputs, defineParams, resolveParams } from '../../core/params';
import type { TerrainGrid } from '../terrain-grid';
import { distanceToEdge, createProfile, type ProfileDatum } from './profile';

/** Full lattice level height in meters. A 96 m summit fits six full levels. */
export const levelHeight = 14;

/** Summit height above ground in meters and unitless relief. */
export const cityVolumeParams = defineParams({
	height: { label: 'Height', unit: 'm', min: 16, max: 144, default: 96, step: 1 },
	complexity: { ...blockInputs.complexity, default: 0.75 }
});

/** A seeded profile and lattice over an immutable plan. The datum's origin, bearing
 * (radians) and reference extents (meters) stay fixed across crops. */
export type CityVolumeOptions = Readonly<{
	plan: TerrainGrid;
	datum: ProfileDatum;
	seed: number;
	parameters?: Readonly<{ height?: number; complexity?: number }>;
}>;

/** One full lattice cell, addressed by its plan cell and zero-based level. */
export type CityCell = Readonly<{ id: string; planCellId: string; level: number }>;

/** Continuous height above ground, with grid columns in plan order and cells bottom up. */
export type CityVolume = Readonly<{
	profile: Readonly<{ height: (x: number, y: number) => number; summit: Vec2 }>;
	grid: Readonly<{
		columns: readonly Readonly<{ planCellId: string; levels: number }>[];
		cells: readonly CityCell[];
	}>;
}>;

/** Builds a detached profile and grid from a valid terrain grid and fixed datum. The
 * profile takes world XY meters and returns meter offsets above terrain. Complete
 * levels fit at each cell's XY center. A growing crop preserves existing levels
 * and IDs. Changing height scales every sample. Invalid datum, seed or inputs throw. */
function create({ plan, datum, seed, parameters }: CityVolumeOptions): CityVolume {
	const values = resolveParams(cityVolumeParams, parameters);
	const vertices = new Map(plan.vertices.map(({ id, position: [x, y] }) => [id, [x, y] as Vec2]));
	const point = (id: string) => required(vertices.get(id), 'city plan vertex');
	const boundary = plan.boundary.map(([a, b]) => [point(a), point(b)] as const);
	let edgeWidth = datum.width / 7;
	const samples = plan.cells.map(({ id, vertexIds }) => {
		const ring = vertexIds.map(point);
		const center = ring.reduce<Vec2>(([x, y], [u, v]) => [x + u / 4, y + v / 4], [0, 0]);
		// Fade within the edge of the crop, without changing any cell center sample.
		for (const [i, a] of ring.entries()) {
			edgeWidth = Math.min(edgeWidth, distanceToEdge(center, a, ring[(i + 1) % 4]));
		}
		return { id, center };
	});
	const profile = createProfile(seed, datum, values, boundary, edgeWidth);
	const columns = samples.map(({ id, center }) =>
		Object.freeze({ planCellId: id, levels: Math.floor(profile.height(...center) / levelHeight) })
	);
	const cells = columns.flatMap(({ planCellId, levels }) =>
		Array.from({ length: levels }, (_, level) =>
			Object.freeze({ id: `${planCellId}/level/${level}`, planCellId, level })
		)
	);
	return Object.freeze({
		profile,
		grid: Object.freeze({ columns: Object.freeze(columns), cells: Object.freeze(cells) })
	});
}

/** Factory for a seeded city profile and its full-height lattice. */
export const CityVolume = Object.freeze({ create });
