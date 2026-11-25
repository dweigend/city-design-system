/** Module: Draws registry placements and parcel markers in the shared city terrain frame. */
import type { Vec2 } from '../../core/geometry';
import { move, type PlaceableObject } from '../../core/object';
import { defaults } from '../../../config/sandbox-projection';
import type { CellStorey, FineCell } from '../../domain/cell-space';
import {
	createHouseObject,
	houseFaces,
	type AdjoiningWall,
	type HouseStyleName
} from '../../domain/house-court';
import type { SurfaceLevel } from '../../domain/material';
import type { Parcel } from '../../domain/parcels';
import type { FinishOverride } from '../../domain/sandbox-document';
import type { createSandboxWorld } from '../../world/sandbox-world';
import { cityWindow, type CityGrid, type CitySite } from '../../world/city-site';
import type { PlacedParcelHouse } from '../../world/house-site';
import { projectCityTerrain } from '../city-volume-projection';
import {
	houseMaterials,
	paintHouseFinishes,
	projectCladHouse,
	projectHouse,
	projectProgrammedHouse
} from '../house-projection';
import { projectPathAsset } from '../paths-projection';
import type { CameraRay, View } from '../stage';
import {
	projectGrove,
	readModelSurface,
	resolveSurfaces,
	type Drawable,
	type ModelTone
} from '../surface';
import { createTerrainDrape } from '../terrain-grid-projection';

type Holdings = ReturnType<typeof createSandboxWorld>['holdings'];

const emptyMesh = { kind: 'mesh', positions: [], indices: [] } as const;
// Exact arithmetic: the world origin and zero elevation are the frame transform anchor.
const worldOrigin = /* Exact arithmetic: world origin. */ [0, 0, 0] as const;
const placementSurface = { color: '--ink-2', finish: 'matte' } as const;

function address(parts: readonly Drawable[], placementId: string): Drawable[] {
	return parts.map((part) => ({ ...part, id: JSON.stringify([placementId, part.id]) }));
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
	/** Converts a displayed position to the polygon index's world XY meters. */
	function toWorld(x: number, y: number): Vec2 {
		return [origin[0] + x * east - y * north, origin[1] + x * north + y * east];
	}

	const noWalls: readonly AdjoiningWall[] = Object.freeze([]);
	type HouseDetail = Readonly<{ level: SurfaceLevel; budget: number; tone: ModelTone }>;
	type Drawing = Readonly<{ budget: number; tone: ModelTone; parts: readonly Drawable[] }>;
	const houses = new WeakMap<
		PlacedParcelHouse,
		WeakMap<readonly AdjoiningWall[], Map<SurfaceLevel, Drawing>>
	>();

	function readHouseDrawing(
		placed: PlacedParcelHouse,
		walls: readonly AdjoiningWall[],
		{ level, budget, tone }: HouseDetail
	) {
		const byWalls =
			houses.get(placed) ?? new WeakMap<readonly AdjoiningWall[], Map<SurfaceLevel, Drawing>>();
		houses.set(placed, byWalls);
		const wallKey = walls.length ? walls : noWalls;
		const byLevel = byWalls.get(wallKey) ?? new Map<SurfaceLevel, Drawing>();
		byWalls.set(wallKey, byLevel);
		const cached = byLevel.get(level);
		if (cached?.budget === budget && cached.tone === tone) return cached.parts;
		const { style, house, space } = placed;
		if (!Object.hasOwn(houseMaterials, style.id))
			throw new RangeError('No sandbox materials for ' + style.id);
		const plain = level === 'plain';
		const detail = plain ? 'block' : 'full';
		const faces = plain ? [] : houseFaces(space, house, 'full', style, walls, true);
		const materials = houseMaterials[style.id as HouseStyleName];
		const options = {
			budget,
			placement: { translation: offset, radians: -bearing },
			level,
			seed: house.inputs.seed,
			plainTone: tone,
			addressed: true
		};
		const { drawables } = house.cells.some(({ program }) => program?.length)
			? projectProgrammedHouse(placed, detail, walls, faces, materials, 'full', options)
			: projectCladHouse(
					createHouseObject(space, house, detail, style, walls, true),
					faces,
					materials,
					'full',
					options
				);
		byLevel.set(level, { budget, tone, parts: drawables });
		return drawables;
	}

	return Object.freeze({
		background: [...terrain.drawables, ...terrain.projectParcels(holdings)],
		toLocal,
		toWorld,
		/** Re-expresses a stage ray in the parcel coordinate system. */
		readWorldRay({ origin: [x, y, z], direction: [dx, dy, dz] }: CameraRay): CameraRay {
			return {
				origin: [...toWorld(x, y), z],
				direction: [dx * east - dy * north, dx * north + dy * east, dz]
			};
		},
		/** Projects one object's registry geometry with its slot surfaces. */
		projectPlacement(object: PlaceableObject, kind: string, placementId: string): Drawable[] {
			const local = move(object, offset, -bearing);
			if (kind === 'park') return address(projectGrove(local), placementId);
			const parts =
				kind === 'house'
					? projectHouse(local, 'full')
					: (projectPathAsset(local, kind) ??
						resolveSurfaces(
							local,
							Object.fromEntries(local.slots.map((slot) => [slot, placementSurface]))
						));
			return address(parts, placementId);
		},
		/** Draws a parcel house at a model surface level with its current party walls and budget. */
		projectParcelHouse(
			placed: PlacedParcelHouse,
			adjoiningWalls: readonly AdjoiningWall[],
			placementId: string,
			detail: HouseDetail,
			finishOverrides: readonly FinishOverride[] = []
		): Drawable[] {
			const parts = readHouseDrawing(placed, adjoiningWalls, detail);
			return address(
				paintHouseFinishes(parts, placed.house.id, finishOverrides, detail.level),
				placementId
			);
		},
		/** Drapes a single contour on displayed ground so it remains visible above plan strokes. */
		projectHover(parcel: Pick<Parcel, 'outline'>): Drawable {
			return projectOutline(parcel, 'sandbox-hover', '--ink', defaults.hoverStrokePx);
		},
		/** Drapes a parcel contour in a colour token, for stroke, skip and selection marks. */
		projectMark(parcel: Pick<Parcel, 'outline'>, id: string, color: `--${string}`): Drawable {
			return projectOutline(parcel, id, color, defaults.markStrokePx);
		},
		/** Draws a fine cell's contiguous storey span, including edges obscured by stock. */
		projectStoreyPreview(
			cell: FineCell,
			storeys: readonly CellStorey[],
			view: View
		): Drawable | undefined {
			if (!storeys.length) return undefined;
			const polygon = cell.quad.map(([x, y]) => toLocal(x, y));
			const base = Math.min(...storeys.map(({ bottomZ }) => bottomZ));
			const top = Math.max(...storeys.map(({ topZ }) => topZ));
			const levels = view === 'plan' ? [top] : new Set([base, ...storeys.map(({ topZ }) => topZ)]);
			const strokeSegments: number[] = [];
			for (const z of levels)
				for (const [i, p] of polygon.entries())
					strokeSegments.push(...p, z, ...polygon[(i + 1) % polygon.length], z);
			if (view === 'iso') for (const p of polygon) strokeSegments.push(...p, base, ...p, top);
			const color = '--blueprint';
			return {
				id: 'sandbox-storey-preview',
				shape: { kind: 'prism', polygon, base, top },
				color,
				finish: 'line',
				fillVisible: false,
				strokeSegments,
				stroke: {
					color,
					width: defaults.hoverStrokePx,
					opacity: defaults.hoverOpacity,
					hidden: defaults.storeyPreviewHiddenOpacity
				}
			};
		},
		/** A plain matte body standing on the parcel up to `heightM` above its lowest ground, the
		 * immediate stand-in for a house that is still being built. */
		projectBody(
			{ outline }: Pick<Parcel, 'outline'>,
			heightM: number,
			id: string,
			tone: ModelTone
		): Drawable {
			const base = Math.min(...outline.map(([x, y]) => site.sampleGround(x, y).height));
			const polygon = outline.map(([x, y]) => toLocal(x, y));
			return {
				id,
				shape: { kind: 'prism', polygon, base, top: base + heightM },
				...readModelSurface({ family: 'board', tone }, 'normal')
			};
		}
	});
}
