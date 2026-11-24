/** Module: Draws registry placements and parcel markers in the shared city terrain frame. */
import type { Vec2 } from '../../core/geometry';
import { move, type PlaceableObject } from '../../core/object';
import { defaults } from '../../../config/sandbox-projection';
import type { Parcel } from '../../domain/parcels';
import type { createSandboxWorld } from '../../world/sandbox-world';
import { cityWindow, type CityGrid, type CitySite } from '../../world/city-site';
import { projectCityTerrain } from '../city-volume-projection';
import { projectHouse } from '../house-projection';
import { resolveSurfaces, type Drawable } from '../surface';
import { createTerrainDrape } from '../terrain-grid-projection';

type Holdings = ReturnType<typeof createSandboxWorld>['holdings'];

const emptyMesh = { kind: 'mesh', positions: [], indices: [] } as const;
// Exact arithmetic: the world origin and zero elevation are the frame transform anchor.
const worldOrigin = [0, 0, 0] as const;
const accessSurface = { color: '--ink-2', finish: 'matte' } as const;

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
			return parts.map((part) => ({ ...part, id: JSON.stringify([placementId, part.id]) }));
		},
		/** Drapes a single contour on displayed ground so it remains visible above plan strokes. */
		projectHover({ outline }: Pick<Parcel, 'outline'>): Drawable {
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
				id: 'sandbox-hover',
				shape: emptyMesh,
				color: '--ink',
				finish: 'line',
				fillVisible: false,
				strokeSegments,
				stroke: { color: '--ink', width: defaults.hoverStrokePx, opacity: defaults.hoverOpacity }
			};
		}
	});
}
