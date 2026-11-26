import {
	bounds as boundsOf,
	distance,
	readVertexMean,
	type Vec2,
	type Vec3
} from '../../lib/core/geometry';
import { bounds, move, type PlaceableObject } from '../../lib/core/object';
import { Random } from '../../lib/core/random';
import {
	cityCameraBearingRad,
	cityElevation,
	cityFrameFillFlat
} from '../../lib/scene/city-volume-projection';
import { stockPencilShare } from '../../lib/scene/focus';
import { houseUseColors, paintHouseUse, projectHouse } from '../../lib/scene/house-projection';
import {
	paintServicePipe,
	projectMovement,
	projectPathAsset,
	projectServicePipe,
	projectTransitLine,
	projectWalkableTube
} from '../../lib/scene/paths-projection';
import { projectFocus } from '../../lib/scene/stage';
import {
	projectGrove,
	resolveSurfaces,
	type Drawable,
	type Surface
} from '../../lib/scene/surface';
import { projectValleyWindow } from '../../lib/scene/valley-projection';
import type { CityGrowthRun, CityGrowthSnapshot } from '../../lib/world/city-growth';
import { cityWindow, readCityGrid, type CitySite } from '../../lib/world/city-site';
import {
	buildCivicEnvelope,
	buildCivicFrame,
	envelopeSurfaces,
	surveyObstructions,
	surveyRoofs
} from './civic';
import { milestones } from './growth';
import type { StoryFrame, StoryPart } from './timeline';

type Building = CityGrowthSnapshot['buildings'][number];

export function createStoryDrawing(site: CitySite, run: CityGrowthRun, adoptedId?: string) {
	const { valley } = site;
	if (!valley) throw new Error('Story needs a valley');
	const { carrierSizeM, planFamily } = run.recipe;
	const { grid } = readCityGrid(site, carrierSizeM, planFamily, run.seed);
	const window = cityWindow(site, grid);
	const terrain = projectValleyWindow(valley, window, 1);
	const offset = [...terrain.toLocal(0, 0), 0] as const;
	const camera = {
		bearing: cityCameraBearingRad,
		elevation: cityElevation(valley.parameters.relief)
	};
	const frame = { toLocal: terrain.toLocal, footprint: terrain.footprint };
	const localPoint = ([x, y, z]: Vec3): Vec3 => [...frame.toLocal(x, y), z];
	const ground = ([x, y]: Vec2) => site.sampleGround(x, y).height;
	const local = (object: PlaceableObject) => move(object, offset, -window.bearing);

	function fit(points: readonly Vec3[], fill: number = cityFrameFillFlat, angles = camera) {
		return { ...angles, fill, subject: projectFocus('iso', angles, points) };
	}

	function fitObject(object: PlaceableObject, fill?: number) {
		const { min, max } = bounds(object);
		return fit(
			[min[0], max[0]].flatMap((x) =>
				[min[1], max[1]].flatMap((y) => [min[2], max[2]].map((z): Vec3 => [x, y, z]))
			),
			fill
		);
	}

	const ids = new WeakMap<Drawable, number>();
	let size = 0;
	let pending: StoryPart[] = [];
	const drawings = new Map<string, readonly number[]>();
	const shapes = new Map<string, Building['parts'][number]['shape']>();
	let lastRoofKey = '';
	let roomIndices: readonly number[] = [];
	let crossingFit: ReturnType<typeof fit> | undefined;
	const subjectFits = new Map<string, ReturnType<typeof fit>>();
	const crossingFits = new Map<string, ReturnType<typeof fit>>();

	function index(drawable: Drawable, extra: Omit<StoryPart, 'drawable'> = {}) {
		const existing = ids.get(drawable);
		if (existing !== undefined) return existing;
		const id = size++;
		ids.set(drawable, id);
		pending.push({ drawable, ...extra });
		return id;
	}

	function cache(key: string, create: () => readonly Drawable[]) {
		let indices = drawings.get(key);
		if (!indices) {
			indices = create().map((drawable) => index({ ...drawable, id: key + '/' + drawable.id }));
			drawings.set(key, indices);
		}
		return indices;
	}

	const terrainIndices = terrain.drawables.map((part) => index(part));
	const terrainFit = fitObject(terrain.object);

	function buildings(snapshot: CityGrowthSnapshot) {
		return snapshot.buildings.flatMap((building) => {
			const storeys = building.parts.filter(({ kind }) => kind === 'storey');
			const first = Math.min(...storeys.map(({ datumIndex }) => datumIndex));
			const stock =
				Random.create({ seed: run.seed }).derive(building.id).number() < stockPencilShare
					? 'pencil'
					: 'transparent';
			return building.parts.map((part) => {
				const { id, slot, phase, use, datumIndex, kind } = part;
				const key = id + ':' + phase + ':' + use;
				const previous = drawings.get(key);
				if (previous) return previous[0];
				let shape = shapes.get(id);
				if (!shape) {
					shape = local({
						id,
						parts: [part],
						slots: [slot],
						footprint: terrain.footprint,
						anchors: []
					}).parts[0].shape;
					shapes.set(id, shape);
				}
				const [base] = projectHouse(
					{
						id,
						parts: [{ id, slot: 'mass', shape }],
						slots: ['mass'],
						footprint: terrain.footprint,
						anchors: []
					},
					phase === 'retained' ? stock : 'silhouette'
				);
				const drawable = { ...base, creaseAngleRad: Math.PI / 4 };
				const value = index(
					phase === 'retained'
						? drawable
						: paintHouseUse({ ...drawable, useColor: houseUseColors[use] }),
					{
						...(kind === 'storey' && { floor: datumIndex - first }),
						building: building.holdingId
					}
				);
				drawings.set(key, [value]);
				return value;
			});
		});
	}

	function movement(snapshot: CityGrowthSnapshot) {
		const lanes = snapshot.lanes.flatMap(({ id, points, nodeIds, lengthM }) =>
			cache(
				'lane/' + id,
				() =>
					projectMovement(
						{
							nodes: [],
							edges: [
								{
									id,
									kind: 'lane',
									nodeIds,
									cost: lengthM,
									lengthM,
									points: points.map(([x, y]): Vec3 => [x, y, ground([x, y])])
								}
							],
							readNode: () => undefined,
							readRoute: () => undefined,
							readComponents: () => new Map()
						},
						{ lane: 'trace' },
						frame
					).drawables
			)
		);
		const rail = snapshot.rail.flatMap(({ id, line }) => {
			const stations = snapshot.stations
				.filter(({ railId }) => railId === id)
				.map(({ station }) => station);
			return cache(
				'rail/' + id + '/' + stations.length,
				() => projectTransitLine({ ...line, stations }, frame).drawables
			);
		});
		const docks = snapshot.stations.flatMap(({ id, dock }) =>
			cache(
				'dock/' + id,
				() =>
					projectMovement(
						{
							nodes: [],
							edges: dock.map((edge) => ({
								...edge,
								kind: edge.kind === 'stair' ? ('stair' as const) : ('walk' as const)
							})),
							readNode: () => undefined,
							readRoute: () => undefined,
							readComponents: () => new Map()
						},
						{ stair: 'stairs', walk: 'deck' },
						frame
					).drawables
			)
		);
		return [...lanes, ...rail, ...docks];
	}

	function assets(snapshot: CityGrowthSnapshot) {
		return snapshot.assets.flatMap(({ id, assetId, object }) =>
			cache('asset/' + id, () => {
				const placed = local(object);
				if (assetId === 'park/grove') return projectGrove(placed);
				if (assetId === 'access/walkway') return projectPathAsset(placed, 'access') ?? [];
				const sculpture: Surface = { color: '--model-orange', finish: 'matte' };
				return resolveSurfaces(
					placed,
					Object.fromEntries(placed.slots.map((slot) => [slot, sculpture]))
				);
			})
		);
	}

	function tube(snapshot: CityGrowthSnapshot) {
		const stationSpan = snapshot.stations
			.flatMap(({ dock }) => dock)
			.find(
				({ kind, points }) =>
					kind === 'walkway' &&
					points.length === 2 &&
					distance([points[0][0], points[0][1]], [points[1][0], points[1][1]]) >= 4
			);
		const bridge = snapshot.crossings[0]?.parts.filter(({ kind }) => kind === 'deck');
		const endpoints =
			stationSpan?.points ?? bridge?.flatMap(({ points }, i) => (i ? points.slice(1) : points));
		if (!endpoints?.length) return [];
		const key = 'tube/' + endpoints.flat().join('/');
		const prior = drawings.get(key);
		const points = endpoints.map(localPoint);
		const first = points[0];
		const last = points[points.length - 1];
		const angle = Math.atan2(last[1] - first[1], last[0] - first[0]);
		const bearing = angle + Math.PI / 10;
		crossingFit =
			crossingFits.get(key) ??
			fit(
				points.flatMap(([x, y, z]): Vec3[] => [
					[x - 3, y - 3, z - 3],
					[x + 3, y + 3, z + 5]
				]),
				0.72,
				{ bearing, elevation: camera.elevation }
			);
		crossingFits.set(key, crossingFit);
		if (prior) return prior;
		// Seat the tube floor on the existing deck. Keep the pipe on the visible flank and clear of the water.
		const glazed = projectWalkableTube(
			'crossing-tube',
			points.map(([x, y, z]) => [x, y, z + 0.9])
		);
		const pipe = projectServicePipe(
			'crossing-service',
			points.map(([x, y, z]) => [x + Math.sin(angle) * 1.25, y - Math.cos(angle) * 1.25, z - 0.24]),
			'water'
		);
		const indices = [
			...glazed.drawables.map((drawable) => index(drawable)),
			...paintServicePipe(pipe, 'normal').map((drawable) =>
				index({ ...drawable, preserveColor: true }, { service: true })
			)
		];
		drawings.set(key, indices);
		return indices;
	}

	function architecture(snapshot: CityGrowthSnapshot) {
		if (snapshot.year < milestones[1].year) return [];
		const candidates = [
			...snapshot.squares.map(({ holding }) => ({ holding, court: undefined })),
			...snapshot.holdings
				.filter(({ courtAccess }) => courtAccess)
				.map((holding) => ({ holding, court: holding.courtAccess?.polygons.at(-1) }))
		];
		let envelope: readonly number[] = [];
		for (const { holding, court } of candidates) {
			const key = 'envelope/' + holding.id + (court ? '/court' : '/square');
			const built = cache(key, () => {
				const result = buildCivicEnvelope(holding, ground, court);
				if (!result) return [];
				return [result.canopy, result.bands, result.posts].flatMap((object) => {
					const placed = local(object);
					return resolveSurfaces(
						placed,
						Object.fromEntries(
							placed.slots.map((slot) => [
								slot,
								envelopeSurfaces[slot as keyof typeof envelopeSurfaces]
							])
						)
					).map((drawable) => ({ ...drawable, id: object.id + '/' + drawable.id }));
				});
			});
			if (built.length) {
				envelope = built;
				break;
			}
		}
		// Replay only changes the frame survey when any host or adopted obstruction changes.
		const hosts = snapshot.buildings.filter(({ holdingId }) => holdingId !== adoptedId);
		const reserved = snapshot.buildings.filter(({ holdingId }) => holdingId === adoptedId);
		const roofKey = snapshot.buildings.map(({ id, parts }) => id + ':' + parts.length).join('/');
		if (roofKey !== lastRoofKey) {
			lastRoofKey = roofKey;
			const roofs = surveyRoofs(hosts, ground);
			const obstructions = surveyObstructions(reserved, ground);
			const result = buildCivicFrame(roofs, obstructions, ground, run.seed);
			const bearings =
				result?.frame.bearings.map(({ at, seat }) => [...at, ...seat].join(',')) ?? [];
			roomIndices = result
				? cache('civic/' + bearings.join('/'), () =>
						[result.frame.object, result.room].flatMap((object) =>
							projectHouse(local(object), 'full')
						)
					)
				: [];
		}

		return [...envelope, ...roomIndices];
	}

	function fitSettled(snapshot: CityGrowthSnapshot) {
		const points: Vec3[] = [
			...snapshot.buildings.flatMap(({ parts }) =>
				parts.flatMap(({ id }) => {
					const shape = shapes.get(id);
					return shape?.kind === 'prism'
						? shape.polygon.flatMap(([x, y]): Vec3[] => [
								[x, y, shape.base],
								[x, y, shape.top]
							])
						: [];
				})
			),
			...snapshot.crossings.flatMap(({ parts }) =>
				parts.flatMap((part) => part.points.map(localPoint))
			),
			...snapshot.squares.flatMap(({ holding }) =>
				holding.outline.map(([x, y]) => localPoint([x, y, ground([x, y])]))
			)
		];
		const extent = boundsOf(points);
		if (!extent) return terrainFit;
		const terrainBounds = bounds(terrain.object);
		const marginM = 28;
		const minHalfSpanM = 70;
		const cx = (extent.min[0] + extent.max[0]) / 2;
		const cy = (extent.min[1] + extent.max[1]) / 2;
		const halfX = Math.max((extent.max[0] - extent.min[0]) / 2 + marginM, minHalfSpanM);
		const halfY = Math.max((extent.max[1] - extent.min[1]) / 2 + marginM, minHalfSpanM);
		const x0 = Math.max(terrainBounds.min[0], cx - halfX);
		const x1 = Math.min(terrainBounds.max[0], cx + halfX);
		const y0 = Math.max(terrainBounds.min[1], cy - halfY);
		const y1 = Math.min(terrainBounds.max[1], cy + halfY);
		const z0 = Math.max(terrainBounds.min[2], extent.min[2] - 4);
		const z1 = Math.max(terrainBounds.max[2], extent.max[2] + 6);
		return fit(
			[x0, x1].flatMap((x) => [y0, y1].flatMap((y) => [z0, z1].map((z): Vec3 => [x, y, z]))),
			0.82
		);
	}

	return {
		fit: terrainFit,
		fitSettled,
		drain() {
			const parts = pending;
			pending = [];
			return parts;
		},
		draw(snapshot: CityGrowthSnapshot): StoryFrame {
			const house =
				snapshot.buildings.find(({ holdingId }) => holdingId === adoptedId) ??
				snapshot.buildings[0];
			const polygon = house?.parts.find(
				({ shape, kind }) => kind === 'storey' && shape.kind === 'prism'
			)?.shape;
			const focus =
				polygon?.kind === 'prism'
					? localPoint([...readVertexMean(polygon.polygon), polygon.top])
					: undefined;
			crossingFit = undefined;
			const indices = [
				...terrainIndices,
				...movement(snapshot),
				...assets(snapshot),
				...buildings(snapshot),
				...architecture(snapshot),
				...tube(snapshot)
			];
			let detailFit: ReturnType<typeof fit> | undefined;
			if (house) {
				detailFit = subjectFits.get(house.id);
				if (!detailFit) {
					const part = house.parts.find(({ kind }) => kind === 'storey');
					const shape = part && shapes.get(part.id);
					if (shape?.kind === 'prism') {
						detailFit = fit(
							shape.polygon.flatMap(([x, y]): Vec3[] => [
								[x - 8, y - 8, shape.base],
								[x + 8, y + 8, shape.top + 20]
							]),
							0.74,
							{ ...camera, bearing: camera.bearing + Math.PI }
						);
						subjectFits.set(house.id, detailFit);
					}
				}
			}
			return {
				year: snapshot.year,
				eventCount: snapshot.eventCount,
				indices,
				subject: house?.holdingId,
				detailFit,
				cutY: focus?.[1],
				serviceFit: crossingFit
			};
		}
	};
}
