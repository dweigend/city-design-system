/** Module: Draws registry placements and parcel markers in the shared city terrain frame. */
import type { Vec2 } from '../../core/geometry';
import { move, type PlaceableObject } from '../../core/object';
import { defaults } from '../../../config/sandbox-projection';
import { houseFaces, type AdjoiningWall, type HouseStyleName } from '../../domain/house-court';
import type { Parcel } from '../../domain/parcels';
import type { createSandboxWorld } from '../../world/sandbox-world';
import { cityWindow, type CityGrid, type CitySite } from '../../world/city-site';
import { createParcelHouseObject, type PlacedParcelHouse } from '../../world/house-site';
import { projectCityTerrain } from '../city-volume-projection';
import {
	blockTriangleBudget,
	houseMaterials,
	projectCladHouse,
	projectHouse
} from '../house-projection';
import { shapeArrays } from '../stage';
import { resolveSurfaces, type Drawable } from '../surface';
import { createTerrainDrape } from '../terrain-grid-projection';

type Holdings = ReturnType<typeof createSandboxWorld>['holdings'];

const emptyMesh = { kind: 'mesh', positions: [], indices: [] } as const;
// Exact arithmetic: the world origin and zero elevation are the frame transform anchor.
const worldOrigin = [0, 0, 0] as const;
const accessSurface = { color: '--ink-2', finish: 'matte' } as const;

/** The one matte key tone of each house style, for stand-in bodies and style specimens. */
export const styleTones = Object.freeze({
	neutral: '--mat-masonry',
	memphis: '--cat-mobility',
	archigram: '--mat-metal',
	organic: '--cat-foliage'
} as const satisfies Record<HouseStyleName, `--${string}`>);

function address(parts: readonly Drawable[], placementId: string): Drawable[] {
	return parts.map((part) => ({ ...part, id: JSON.stringify([placementId, part.id]) }));
}

function normalOf(positions: readonly number[], [a, b, c]: readonly number[]) {
	const p = (i: number) => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]];
	const [pa, pb, pc] = [p(a), p(b), p(c)];
	const u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
	const v = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
	const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
	const length = Math.hypot(n[0], n[1], n[2]) || 1;
	return n.map((value) => value / length);
}

/** The edges of a triangle mesh where the surface folds by more than the crease angle, or ends.
 * Vertices are matched by position, so separately triangulated faces still share their edges. */
function readCreases(positions: readonly number[], indices: readonly number[]) {
	const key = (i: number) =>
		[positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]]
			.map((value) => value.toFixed(defaults.volumeEdgeDecimals))
			.join(',');
	const edges = new Map<string, { from: number; to: number; normals: number[][] }>();
	for (let t = 0; t < indices.length; t += 3) {
		const corners = [indices[t], indices[t + 1], indices[t + 2]];
		const normal = normalOf(positions, corners);
		for (const [i, from] of corners.entries()) {
			const to = corners[(i + 1) % corners.length];
			const id = [key(from), key(to)].sort().join('|');
			const edge = edges.get(id) ?? { from, to, normals: [] };
			edge.normals.push(normal);
			edges.set(id, edge);
		}
	}
	const limit = Math.cos((defaults.volumeCreaseDeg * Math.PI) / 180);
	const segments: number[] = [];
	for (const { from, to, normals } of edges.values()) {
		const [n, m] = normals;
		const folds = !m || n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < limit;
		if (!folds) continue;
		for (const i of [from, to])
			segments.push(positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]);
	}
	return segments;
}

/** Builds the immutable terrain and parcel background once. The projection accepts all
 * addresses in world meters and uses the same city frame as the bible. */
export function createSandboxProjection(site: CitySite, layout: CityGrid, holdings: Holdings) {
	const terrain = projectCityTerrain(site, layout.grid, layout.plan);
	const { toLocal } = terrain;
	const { bearing, origin } = cityWindow(site, layout.plan);
	const east = Math.cos(bearing);
	const north = Math.sin(bearing);
	const ground = terrain.drawables.find(({ finish }) => finish === 'terrain');
	if (ground?.shape.kind !== 'mesh') throw new Error('Expected the city terrain mesh');
	const drape = createTerrainDrape(ground.shape);
	const [x, y, z] = worldOrigin;
	const offset = [...toLocal(x, y), z] as const;

	function projectOutline(
		{ outline }: Pick<Parcel, 'outline'>,
		id: string,
		color: `--${string}`,
		width: number
	): Drawable {
		const strokeSegments: number[] = [];
		for (const [i, point] of outline.entries()) {
			const next = outline[(i + 1) % outline.length];
			const points = drape.segment(toLocal(...point), toLocal(...next));
			for (let j = 1; j < points.length; j++) {
				for (const [x, y, z] of [points[j - 1], points[j]])
					strokeSegments.push(x, y, z + defaults.hoverLiftM);
			}
		}
		return {
			id,
			shape: emptyMesh,
			color,
			finish: 'line',
			fillVisible: false,
			strokeSegments,
			stroke: { color, width, opacity: defaults.hoverOpacity }
		};
	}
	return Object.freeze({
		background: [...terrain.drawables, ...terrain.projectParcels(holdings)],
		toLocal,
		/** Converts a displayed ground point to the polygon index's world XY meters. */
		toWorld(x: number, y: number): Vec2 {
			return [origin[0] + x * east - y * north, origin[1] + x * north + y * east];
		},
		/** Projects one object's registry geometry with its slot surfaces. */
		projectPlacement(object: PlaceableObject, kind: string, placementId: string): Drawable[] {
			const local = move(object, offset, -bearing);
			const parts =
				kind === 'house'
					? projectHouse(local, 'full')
					: resolveSurfaces(
							local,
							Object.fromEntries(local.slots.map((slot) => [slot, accessSurface]))
						);
			return address(parts, placementId);
		},
		/** Draws a town parcel house with its current party walls, in flat cladding unless a level
		 * and that level's share of the block triangle budget are given. */
		projectParcelHouse(
			placed: PlacedParcelHouse,
			adjoiningWalls: readonly AdjoiningWall[],
			placementId: string,
			detail: Readonly<{ level: 'flat' | 'relief'; budget: number }> = {
				level: 'flat',
				budget: blockTriangleBudget
			}
		): Drawable[] {
			const { style, house, space } = placed;
			if (!Object.hasOwn(houseMaterials, style.id))
				throw new RangeError('No sandbox materials for ' + style.id);
			const { drawables } = projectCladHouse(
				createParcelHouseObject(placed, 'full', adjoiningWalls),
				houseFaces(space, house, 'full', style, adjoiningWalls),
				houseMaterials[style.id as HouseStyleName],
				'full',
				{
					budget: detail.budget,
					placement: { translation: offset, radians: -bearing },
					level: detail.level
				}
			);
			return address(drawables, placementId);
		},
		/** Draws a town parcel house as its plain massing: block detail merged into one matte body
		 * in one tone with hairline edges. No cladding and no separate parts. */
		projectParcelVolume(
			placed: PlacedParcelHouse,
			adjoiningWalls: readonly AdjoiningWall[],
			placementId: string,
			color: `--${string}`
		): Drawable[] {
			const local = move(
				createParcelHouseObject(placed, 'block', adjoiningWalls),
				offset,
				-bearing
			);
			// Exact arithmetic: a mesh position has three coordinates.
			const stride = 3;
			const positions: number[] = [];
			const indices: number[] = [];
			for (const { shape } of local.parts) {
				const arrays = shapeArrays(shape);
				const base = positions.length / stride;
				positions.push(...arrays.positions);
				for (const index of arrays.indices) indices.push(base + index);
			}
			return [
				{
					id: JSON.stringify([placementId, 'volume']),
					shape: { kind: 'mesh', positions, indices },
					color,
					finish: 'matte'
				},
				{
					id: JSON.stringify([placementId, 'edges']),
					shape: emptyMesh,
					color: '--ink-2',
					finish: 'line',
					fillVisible: false,
					strokeSegments: readCreases(positions, indices),
					stroke: {
						color: '--ink-2',
						width: defaults.volumeEdgePx,
						opacity: defaults.volumeEdgeOpacity
					}
				}
			];
		},
		/** Drapes a single contour on displayed ground so it remains visible above plan strokes. */
		projectHover(parcel: Pick<Parcel, 'outline'>): Drawable {
			return projectOutline(parcel, 'sandbox-hover', '--ink', defaults.hoverStrokePx);
		},
		/** Drapes a parcel contour in a colour token, for stroke, skip and selection marks. */
		projectMark(parcel: Pick<Parcel, 'outline'>, id: string, color: `--${string}`): Drawable {
			return projectOutline(parcel, id, color, defaults.markStrokePx);
		},
		/** A plain matte body standing on the parcel up to `heightM` above its lowest ground, the
		 * immediate stand-in for a house that is still being built. */
		projectBody(
			{ outline }: Pick<Parcel, 'outline'>,
			heightM: number,
			id: string,
			color: `--${string}`
		): Drawable {
			const base = Math.min(...outline.map(([x, y]) => site.sampleGround(x, y).height));
			const polygon = outline.map(([x, y]) => toLocal(x, y));
			return {
				id,
				shape: { kind: 'prism', polygon, base, top: base + heightM },
				color,
				finish: 'matte'
			};
		}
	});
}
