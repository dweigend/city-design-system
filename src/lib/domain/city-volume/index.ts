import { required } from '../../core/invariant';
import { blockInputs, defineParams, resolveParams } from '../../core/params';
import type { TerrainGrid } from '../terrain-grid';
import { createProfile, type ProfileDatum } from './profile';
import {
	createFrame,
	latticeVariants,
	type CityLattice,
	type Column,
	type LatticeVariant
} from './frame';

/** Full structural level height above the terrain, in meters. */
export const levelHeight = 14;

/** Summit height above ground in meters and unitless relief. */
export const cityVolumeParams = defineParams({
	height: { label: 'Height', unit: 'm', min: 16, max: 144, default: 120, step: 1 },
	complexity: { ...blockInputs.complexity, default: 0.75 }
});

/** Column frame families in display order. */
export { latticeVariants };

/** Member topology applied to every complete level of a plan column. */
export type { LatticeVariant };

/** A triangulation-independent continuous height field in world XY meters. */
export type CityProfile = ReturnType<typeof createProfile>;

/** Builds a seeded continuous height-above-ground field in meters. The fixed datum
 * controls its position and extent independently of growth or plan topology. Invalid input throws. */
export function createCityProfile(
	datum: ProfileDatum,
	seed: number,
	parameters?: Readonly<{ height?: number; complexity?: number }>
): CityProfile {
	return createProfile(seed, datum, resolveParams(cityVolumeParams, parameters));
}

/** Complete levels by plan polygon, with their terrain-draped corners in world meters. */
export type CityColumn = Column;

/** Samples the profile at each polygon's mean corner position. Returns immutable columns in
 * plan order, with only complete 14 m levels counted. No random draws or input mutation. */
export function readCityColumns(plan: TerrainGrid, profile: CityProfile): readonly CityColumn[] {
	const vertices = new Map(plan.vertices.map((vertex) => [vertex.id, vertex]));
	return Object.freeze(
		plan.cells.map(({ id, vertexIds }) => {
			const corners = Object.freeze(
				vertexIds.map((key) => required(vertices.get(key), 'plan corner'))
			);
			const [x, y] = corners.reduce(
				([a, b], { position: [u, v] }) => [a + u / corners.length, b + v / corners.length],
				[0, 0]
			);
			return Object.freeze({
				planCellId: id,
				corners,
				levels: Math.floor(profile.height(x, y) / levelHeight)
			});
		})
	);
}

/** Stable addresses for full levels, joints and undirected members in world XYZ meters. */
export type { CityLattice };

/** Builds the selected frame over the sampled columns. Shared joints and edges are emitted
 * once. Growing the crop retains existing IDs and positions. Unknown variants throw RangeError. */
export function createCityLattice(
	columns: readonly CityColumn[],
	variant: LatticeVariant = 'box'
): CityLattice {
	return createFrame(columns, levelHeight, variant);
}
