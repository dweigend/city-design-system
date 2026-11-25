import type { Vec2, Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { PlaceableObject } from '../../core/object';
import {
	createWorldReference,
	encodeKey,
	equalRefs,
	readWorldReference,
	type Ref,
	type ReferenceResolution
} from '../../core/ref';
import {
	readCellStoreys,
	readStoreyKey,
	type CellStorey,
	type FineCell
} from '../../domain/cell-space';
import { readHousePartRefs, type HousePartRef } from '../../domain/house-court';
import { readHostReference, type SandboxPlacement } from '../../domain/sandbox-document';
import { buildAsset, readGrovePlan } from '../asset-registry';
import { cityRailTerrainSlopeBound, readCityRail } from '../city-movement';
import { createTownHouseStudy } from '../house-site';
import { createSandboxWorld } from './index';

/** Opens the Architecture Town fixture and addresses its first private parcel. */
export function example() {
	const town = createTownHouseStudy();
	const { site, layout, columns, parcelsByBlock, blocks } = town;
	const world = createSandboxWorld(site, layout, columns);
	const parcels = parcelsByBlock.get(blocks.block.id) ?? [];
	return { world, town, parcels };
}

function resolved<T>(result: ReferenceResolution<T>) {
	if (result.status !== 'resolved') throw new Error('Exchange reference: ' + result.status);
	return result.value;
}

type StoreyGeometry = CellStorey & Pick<FineCell, 'quad'>;
type PartSpan = Readonly<{
	bottomZ: number;
	topZ: number;
	footprints: readonly (readonly Vec2[])[];
}>;

function sameXY([ax, ay]: readonly [number, number, ...number[]], [bx, by]: Vec2) {
	return Math.hypot(ax - bx, ay - by) <= 1e-6;
}

function quadOrientation(quad: readonly Vec2[]) {
	let area = 0;
	for (let i = 0; i < quad.length; i++) {
		const [x0, y0] = quad[i];
		const [x1, y1] = quad[(i + 1) % quad.length];
		area += x0 * y1 - x1 * y0;
	}
	return area >= 0 ? 1 : -1;
}

/** Reads the vertical elevation bands of a cell's built exterior walls directly from 3D wall meshes. */
function readBuiltWallBands(
	object: PlaceableObject,
	quad: readonly Vec2[]
): readonly (readonly [number, number])[] {
	const sign = quadOrientation(quad);
	const bands = new Map<string, readonly [number, number]>();
	for (const { slot, shape } of object.parts) {
		if (slot !== 'wall' || shape.kind !== 'mesh') continue;
		const { positions, indices } = shape;
		const vertex = (index: number): Vec3 => [
			positions[index * 3],
			positions[index * 3 + 1],
			positions[index * 3 + 2]
		];
		for (let i = 0; i < indices.length; i += 3) {
			const a = vertex(indices[i]);
			const b = vertex(indices[i + 1]);
			const c = vertex(indices[i + 2]);
			const bottomZ = Math.min(a[2], b[2], c[2]);
			const topZ = Math.max(a[2], b[2], c[2]);
			if (topZ <= bottomZ) continue;
			const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
			const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
			const nx = ab[1] * ac[2] - ab[2] * ac[1];
			const ny = ab[2] * ac[0] - ab[0] * ac[2];
			for (let e = 0; e < quad.length; e++) {
				const p = quad[e];
				const q = quad[(e + 1) % quad.length];
				const onEdge = (point: Vec3) => sameXY(point, p) || sameXY(point, q);
				if (!onEdge(a) || !onEdge(b) || !onEdge(c)) continue;
				const outwardDot = nx * (q[1] - p[1]) * sign - ny * (q[0] - p[0]) * sign;
				if (outwardDot <= 0) continue;
				bands.set(`${bottomZ}|${topZ}`, [bottomZ, topZ]);
			}
		}
	}
	return [...bands.values()].sort(([a], [b]) => a - b);
}

function readGroveCanopies(
	{ params: { density, height }, seed }: SandboxPlacement,
	outline: readonly Vec2[]
) {
	return readGrovePlan({ outline }, { density, height }, seed).map(({ at: [x, y], radius }) => [
		[x + radius, y],
		[x, y + radius],
		[x - radius, y],
		[x, y - radius]
	]);
}

/** Produces a fixed sandbox/3 exchange and independent plan and spatial readers of it. */
export function boundaryExample() {
	const { world, town, parcels } = example();
	const { site, layout, columns } = town;
	const document = world.createDocument();
	const hostAt = (id: string) => ({ kind: 'parcel', id }) as const;
	function houseEdit(candidates: typeof parcels) {
		const trial = world.createDocument();
		for (const { id, publicUse } of candidates) {
			if (publicUse) continue;
			const host = hostAt(id);
			const edit = {
				...world.place('house/court-neutral', host, {
					height: 21,
					width: 28,
					complexity: 0
				}),
				host
			};
			trial.apply([edit]);
			const placement = required(trial.readPlacement(host), 'trial house');
			trial.undo();
			const before = world.resolveHouse(placement);
			if (
				before?.status === 'placed' &&
				before.house.cells.some(({ fromStorey, toStorey }) => toStorey - fromStorey > 1)
			)
				return edit;
		}
		throw new Error('Expected a buildable parcel for the exchange');
	}
	const houseEditAt = houseEdit(parcels);
	const peerEditAt = houseEdit(town.parcelsByBlock.get(town.blocks.neighbour.id) ?? []);
	const houseHost = houseEditAt.host;
	const peerHost = peerEditAt.host;
	const groveHost = hostAt(
		required(
			parcels.find(({ id, publicUse }) => !publicUse && id !== houseHost.id),
			'grove parcel'
		).id
	);
	const bridge = required(
		world.movement.network.edges.find(({ kind }) => kind === 'bridge'),
		'bridge'
	);
	document.apply([
		houseEditAt,
		world.place('park/grove', groveHost, { height: 8, density: 5 }),
		peerEditAt
	]);
	const worldId = world.world.id;
	const ref = (kind: string, key: string) => createWorldReference(worldId, kind, key);
	const house = ref('placement', required(document.readPlacement(houseHost), 'house slot').id);
	const grove = ref('placement', required(document.readPlacement(groveHost), 'grove slot').id);
	const peer = ref('placement', required(document.readPlacement(peerHost), 'neighbor slot').id);

	const center: Vec2 = [bridge.points[0][0], bridge.points[0][1]];
	const rail = required(
		readCityRail(site, layout, [...columns.values()], {
			center,
			catchments: [{ id: 'town', center }],
			readSpanUpperM(a, b) {
				const height = ([x, y]: Vec2) => {
					const ground = site.sampleGround(x, y);
					return Math.max(ground.height, ground.waterHeight ?? -Infinity);
				};
				return (
					Math.max(height(a), height(b), height([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])) +
					(Math.hypot(a[0] - b[0], a[1] - b[1]) * cityRailTerrainSlopeBound) / 4
				);
			}
		}),
		'rail line'
	);
	const groundVertex = required(layout.grid.vertices[0], 'ground vertex');
	const ground = readHostReference(world.world, { kind: 'ground', point: groundVertex.position });
	const railRef = ref('rail', 'town-line');
	const survey = [
		{ ref: ground, geometry: groundVertex },
		// JSON carries the straight line's infinite radius explicitly.
		{
			ref: railRef,
			geometry: {
				...rail,
				minimumRadiusM: Number.isFinite(rail.minimumRadiusM)
					? rail.minimumRadiusM
					: ('unbounded' as const)
			}
		}
	] as const;
	type Exchange = Readonly<{ document: string; refs: readonly Ref[]; survey: typeof survey }>;
	const base = [
		ref('parcel', houseHost.id),
		house,
		peer,
		grove,
		ref('lane', required(world.holdings.lanes[0], 'lane').id),
		ref('bridge', bridge.id),
		railRef,
		ground
	];

	function readExchange(): Exchange {
		const children = [houseHost, peerHost].flatMap((host) => {
			const placement = required(document.readPlacement(host), 'placed house');
			const result = world.resolveHouse(placement);
			if (result?.status !== 'placed') throw new Error('Expected a built house');
			const storeys = readCellStoreys(result.space, worldId);
			const parts = readHousePartRefs(result.house, worldId).filter(
				(part) => part.cellId && part.storeyRefs.length === 1 && part.slot === 'wall'
			);
			const stack = Map.groupBy(parts, (part) => part.cellId);
			const pair = required(
				[...stack.values()].find((rows) =>
					rows.some(({ storeySpan }) => storeySpan[0] !== rows[0].storeySpan[0])
				),
				'stacked house walls'
			);
			return [...storeys.map(({ ref }) => ref), ...pair.map(({ ref }) => ref)];
		});
		return { document: document.serialize(), refs: [...base, ...children], survey };
	}

	function readSpatial(exchange: Exchange) {
		const consumer = createSandboxWorld(site, layout, columns);
		const document = consumer.restore(exchange.document);
		const builtHouses = new Map<string, PlaceableObject>();
		const wallBandsByCell = new Map<string, readonly (readonly [number, number])[]>();
		const houseFor = (houseId: string) => {
			const cached = builtHouses.get(houseId);
			if (cached) return cached;
			const parcelId = houseId.startsWith('house/') ? houseId.slice('house/'.length) : houseId;
			const placement = required(
				document.readPlacement({ kind: 'parcel', id: parcelId }),
				'spatial house placement'
			);
			const object = consumer.build(placement);
			builtHouses.set(object.id, object);
			return object;
		};
		return exchange.refs.map((encoded) => {
			const ref = required(readWorldReference(encoded), 'exchange ref');
			if (ref.kind === 'placement') {
				const placement = resolved(document.resolveReference(ref));
				const host = consumer.resolveHost(placement.host);
				const object = buildAsset(placement.assetId, host, placement.params, placement.seed);
				if (placement.host.kind === 'parcel') builtHouses.set(object.id, object);
				return { ref, object, geometry: placement };
			}
			const sample = exchange.survey.find((row) => equalRefs(row.ref, ref));
			const geometry = sample?.geometry ?? resolved(consumer.resolveReference(ref, document));
			if (ref.kind === 'house-part') {
				if (!('storeyRefs' in geometry) || !geometry.cellId || geometry.storeyRefs.length !== 1)
					throw new Error('Expected a single-storey wall part');
				const [houseId] = JSON.parse(ref.key) as [string, string];
				const parcelId = houseId.startsWith('house/') ? houseId.slice('house/'.length) : houseId;
				const placement = required(
					document.readPlacement({ kind: 'parcel', id: parcelId }),
					'wall house placement'
				);
				const placed = consumer.resolveHouse(placement);
				if (placed?.status !== 'placed') throw new Error('Expected a placed house');
				const cell = required(
					placed.house.cells.find(({ id }) => id === geometry.cellId),
					'wall occupancy cell'
				);
				const storey = resolved(consumer.resolveReference(geometry.storeyRefs[0], document));
				if (!('quad' in storey)) throw new Error('Expected spatial storey footprint');
				const bandKey = encodeKey([houseId, geometry.cellId]);
				let bands = wallBandsByCell.get(bandKey);
				if (!bands) {
					bands = readBuiltWallBands(houseFor(houseId), storey.quad);
					wallBandsByCell.set(bandKey, bands);
				}
				const band = required(bands[storey.storey - cell.fromStorey], 'built wall elevation band');
				const span: PartSpan = {
					bottomZ: band[0],
					topZ: band[1],
					footprints: [storey.quad]
				};
				return { ref, object: undefined, geometry, span };
			}
			return { ref, object: undefined, geometry, span: undefined };
		});
	}

	function readPlan(exchange: Exchange) {
		const consumer = createSandboxWorld(site, layout, columns);
		const document = consumer.restore(exchange.document);
		const parcels = new Map(consumer.holdings.parcels.map((parcel) => [parcel.id, parcel]));
		const storeys = new Map<string, StoreyGeometry>();
		const parts = new Map<string, Readonly<{ geometry: HousePartRef; span: PartSpan }>>();
		for (const placement of document.readPlacements()) {
			const placed = consumer.resolveHouse(placement);
			if (placed?.status !== 'placed') continue;
			const cells = new Map(placed.space.cells.map(({ id, quad }) => [id, quad]));
			const storeyRefs = new Map<string, Ref<'storey'>>();
			for (const { ref, ...storey } of readCellStoreys(placed.space, consumer.world.id)) {
				const quad = required(cells.get(storey.cellId), 'plan storey footprint');
				storeys.set(ref.key, { ...storey, quad });
				storeyRefs.set(ref.key, ref);
			}
			for (const cell of placed.house.cells) {
				for (let storey = cell.fromStorey; storey < cell.toStorey; storey++) {
					const datumIndex = placed.space.datumIndex + storey;
					const storeyKey = readStoreyKey(placed.space.id, cell.id, datumIndex);
					const row = required(storeys.get(storeyKey), 'plan storey');
					const storeyRef = required(storeyRefs.get(storeyKey), 'plan storey ref');
					const partId = `${cell.id}/envelope/datum/${datumIndex}`;
					const key = encodeKey([placed.house.id, partId]);
					const program = cell.program?.find((entry) => entry.key === storeyKey);
					parts.set(key, {
						geometry: {
							ref: createWorldReference(consumer.world.id, 'house-part', key),
							partId,
							slot: 'wall',
							cellId: cell.id,
							storeySpan: [datumIndex, datumIndex + 1],
							storeyRefs: [storeyRef],
							body: true,
							...(program ? { program: { phase: program.phase, use: program.use } } : {})
						},
						span: {
							bottomZ: row.bottomZ,
							topZ: row.topZ,
							footprints: [row.quad]
						}
					});
				}
			}
		}
		const readStorey = (ref: Ref) => required(storeys.get(ref.key), 'plan storey');
		return exchange.refs.map((encoded) => {
			const ref = required(readWorldReference(encoded), 'exchange ref');
			if (ref.world !== consumer.world.id) throw new Error('Foreign exchange ref');
			if (ref.kind === 'placement') {
				const geometry = resolved(document.resolveReference(ref));
				if (geometry.host.kind !== 'parcel') throw new Error('Expected a parcel placement');
				const { outline } = required(parcels.get(geometry.host.id), 'placement parcel');
				const canopies =
					geometry.assetId === 'park/grove' ? readGroveCanopies(geometry, outline) : undefined;
				return { ref, geometry, outline, canopies };
			}
			if (ref.kind === 'storey') return { ref, geometry: readStorey(ref) };
			if (ref.kind === 'house-part') {
				const entry = required(parts.get(ref.key), 'plan house part');
				return { ref, geometry: entry.geometry, span: entry.span };
			}
			const sample = exchange.survey.find((row) => equalRefs(row.ref, ref));
			const geometry =
				sample?.geometry ??
				required(
					parcels.get(ref.kind === 'parcel' ? ref.key : '') ??
						consumer.holdings.lanes.find(({ id }) => ref.kind === 'lane' && id === ref.key) ??
						consumer.movement.network.edges.find(
							({ id, kind }) => ref.kind === kind && id === ref.key
						),
					'plan feature'
				);
			return { ref, geometry };
		});
	}

	return {
		readExchange,
		readPlan,
		readSpatial,
		growGrove() {
			const before = required(document.readPlacement(groveHost), 'grove to grow');
			document.apply([
				{ kind: 'replace', id: before.id, params: { ...before.params, height: 12 } }
			]);
		},
		house,
		grove,
		peer
	};
}
