import { Random } from '../../core/random';
import { size } from '../../core/geometry';
import { bounds, type PlaceableObject } from '../../core/object';
import type { AddressedParcel, ParcelPlan, ParcelPortal } from '../../domain/parcels';
import {
	readPlacementId,
	SandboxDataError,
	type SandboxPlacement,
	type StockEdit
} from '../../domain/sandbox-document';
import type { HostAddress } from '../asset-registry';
import { createSandboxWorld } from '../sandbox-world';
import type { GrowthCarrier } from './carrier';
import { freezeGeometry } from './infrastructure';
import type { CityGrowthAsset, CityGrowthSnapshot } from './types';

type World = ReturnType<typeof createSandboxWorld>;
type Document = ReturnType<World['createDocument']>;
type Building = CityGrowthSnapshot['buildings'][number];

function buildHouse(building: Building, holding: CityGrowthSnapshot['holdings'][number]) {
	const [[x, y], [u, v]] = holding.portal.points;
	const unmeasured = /* Exact arithmetic: placeholder before measuring the footprint. */ 0;
	const up = /* Exact arithmetic: world up in XYZ. */ [0, 0, 1] as const;
	const object: PlaceableObject = {
		id: building.id,
		slots: [...new Set(building.parts.map(({ slot }) => slot))],
		parts: building.parts,
		footprint: {
			width: unmeasured,
			depth: unmeasured
		},
		anchors: [
			{
				name: 'frontage',
				position: [
					(x + u) / 2,
					(y + v) / 2,
					Math.min(
						...building.parts.flatMap(({ shape }) => (shape.kind === 'prism' ? [shape.base] : []))
					)
				],
				normal: up
			}
		]
	};
	const [width, depth] = size(bounds(object));
	return freezeGeometry({ ...object, footprint: { width, depth } });
}

function readOccupiedHeight({ parts }: Building) {
	const floors = parts.flatMap(({ kind, shape }) =>
		kind === 'storey' && shape.kind === 'prism' ? [shape] : []
	);
	const bottom = Math.min(...floors.map(({ base }) => base));
	return Math.max(...floors.map(({ top }) => top)) - bottom;
}

function createStockEdits(snapshot: CityGrowthSnapshot, seed: number): StockEdit[] {
	const random = Random.create({ seed });
	const houses = snapshot.buildings.map((building): StockEdit => ({
		kind: 'place',
		assetId: 'house/court-' + building.styleId,
		host: { kind: 'parcel', id: building.holdingId },
		params: { height: readOccupiedHeight(building) },
		seed: random.derive(building.id).seed
	}));
	return [
		...houses,
		...snapshot.assets.map(({ assetId, host, params, seed }): StockEdit => ({
			kind: 'place',
			assetId,
			host,
			params,
			seed
		}))
	];
}

function readCommittedHoldings(base: ParcelPlan, snapshot: CityGrowthSnapshot): ParcelPlan {
	const retiredParents = new Set(
		snapshot.events
			.filter((event) => event.kind === 'holding-split')
			.map(({ predecessorId }) => predecessorId)
	);
	const activeById = new Map(snapshot.holdings.map((holding) => [holding.id, holding]));
	const parcels: AddressedParcel[] = [];
	const portals: ParcelPortal[] = [];
	const seenParcels = new Set<string>();
	for (const parcel of base.parcels) {
		if (retiredParents.has(parcel.id)) continue;
		const active = activeById.get(parcel.id);
		const next: AddressedParcel = active
			? Object.freeze({
					id: active.id,
					blockId: active.blockId,
					splitPath: active.splitPath,
					plannedKind: active.plannedKind,
					publicUse: active.publicUse,
					outline: active.outline,
					corners: active.corners,
					areaM2: active.areaM2,
					portalId: active.portalId
				})
			: parcel;
		parcels.push(next);
		seenParcels.add(next.id);
	}
	for (const portal of base.portals) {
		if (!retiredParents.has(portal.parcelId)) portals.push(portal);
	}
	for (const holding of snapshot.holdings) {
		if (seenParcels.has(holding.id)) continue;
		parcels.push(
			Object.freeze({
				id: holding.id,
				blockId: holding.blockId,
				splitPath: holding.splitPath,
				plannedKind: holding.plannedKind,
				publicUse: holding.publicUse,
				outline: holding.outline,
				corners: holding.corners,
				areaM2: holding.areaM2,
				portalId: holding.portalId
			})
		);
		portals.push(holding.portal);
	}
	return Object.freeze({
		...base,
		parcels: Object.freeze(parcels),
		portals: Object.freeze(portals)
	});
}

function readArchive(input: unknown) {
	if (input === null || typeof input !== 'object')
		throw new SandboxDataError('Invalid town handover');
	const { format, sandbox, stock } = input as Record<string, unknown>;
	if (format !== 'growth-stock/1' || typeof sandbox !== 'string')
		throw new SandboxDataError('Invalid town handover format');
	return { sandbox, stock };
}

function parseArchive(json: string) {
	let input: unknown;
	try {
		input = JSON.parse(json);
	} catch (cause) {
		throw new SandboxDataError('Invalid town handover JSON', { cause });
	}
	return readArchive(input);
}

function readSavedStockCount(serializedSandbox: string): number {
	const parsed = JSON.parse(serializedSandbox) as { stock?: unknown };
	return Array.isArray(parsed.stock) ? parsed.stock.length : -1;
}

export function createHandover(carrier: GrowthCarrier, snapshot: CityGrowthSnapshot, seed: number) {
	const { site, layout, parcelPlan, columns, terrainRevision: revision } = carrier;
	if (
		!site.valley &&
		(revision === undefined || revision !== JSON.stringify(site.terrainRevision?.()))
	)
		throw new RangeError('Sandbox handover requires the original custom terrain revision');
	const world = createSandboxWorld(
		site,
		{
			...layout,
			selectedCrossings: Object.freeze(snapshot.crossings.map(({ crossing }) => crossing))
		},
		columns,
		revision,
		undefined,
		undefined,
		{ holdings: readCommittedHoldings(parcelPlan, snapshot), allowGroundHosts: true }
	);
	const { year, datumZ, lanes, crossings, squares, rail, stations, retiredBuildings } = snapshot;
	const stock = Object.freeze({
		year,
		datumZ,
		lanes,
		crossings,
		squares,
		rail,
		stations,
		retiredBuildings,
		holdings: snapshot.holdings,
		buildings: snapshot.buildings,
		assets: snapshot.assets
	});
	const document = world.createDocument(createStockEdits(snapshot, seed));
	const holdings = new Map(stock.holdings.map((holding) => [holding.id, holding]));
	const buildings = new Map(stock.buildings.map((building) => [building.holdingId, building]));
	const assetsByPlacementId = new Map(
		stock.assets.map((asset) => [readPlacementId(world.world, asset.host), asset])
	);
	const stockRecords = new Map<string, Building | CityGrowthAsset>();
	const baselinePlacements = document.readPlacements();
	const baselineById = new Map<string, string>();
	for (const placement of baselinePlacements) {
		baselineById.set(placement.id, JSON.stringify(placement));
		const asset = assetsByPlacementId.get(placement.id);
		const record =
			asset?.assetId === placement.assetId
				? asset
				: placement.host.kind === 'parcel'
					? buildings.get(placement.host.id)
					: undefined;
		if (record) stockRecords.set(placement.id, record);
	}
	const stockPayload = JSON.stringify(stock);
	function matchesWorld(doc: Document) {
		const identity = doc.world;
		return (
			identity.id === world.world.id &&
			identity.topologyRevision === world.world.topologyRevision &&
			identity.terrainRevision === world.world.terrainRevision &&
			identity.registryRevision === world.world.registryRevision
		);
	}
	function matchesBaseline(doc: Document, serializedSandbox?: string) {
		if (!matchesWorld(doc)) return false;
		const saved = serializedSandbox ?? doc.serialize();
		if (readSavedStockCount(saved) !== baselinePlacements.length) return false;
		for (const placement of baselinePlacements) {
			const before = doc.readStock(placement.host);
			if (JSON.stringify(before) !== baselineById.get(placement.id)) return false;
		}
		return true;
	}
	function readStock(doc: Document, host: HostAddress): Building | CityGrowthAsset | undefined {
		const placement = doc.readPlacement(host);
		if (
			placement &&
			placement === doc.readStock(host) &&
			matchesWorld(doc) &&
			JSON.stringify(placement) === baselineById.get(placement.id)
		)
			return stockRecords.get(placement.id);
	}
	return Object.freeze({
		world,
		document,
		stock,
		/** Reads exact dated geometry for an active baseline slot in a same-world document. */
		readStock,
		/** Projects the dated stock geometry or builds an edited placement through the sandbox. */
		build(doc: Document, placement: SandboxPlacement): PlaceableObject {
			const record =
				placement === doc.readPlacement(placement.host) && readStock(doc, placement.host);
			if (!record) return world.build(placement);
			if ('object' in record) return record.object;
			const holding = holdings.get(record.holdingId);
			if (!holding) throw new SandboxDataError('Stock building lacks its addressed holding');
			return buildHouse(record, holding);
		},
		/** Saves the editable document together with exact dated stock, including civic ground assets. */
		serialize(doc: Document) {
			const sandbox = doc.serialize();
			if (!matchesBaseline(doc, sandbox))
				throw new SandboxDataError('This document belongs to a different stock town');
			return JSON.stringify({ format: 'growth-stock/1', sandbox, stock });
		},
		/** Validates the dated baseline and delegates editable document replay to the sandbox world. */
		restore(json: string) {
			const archive = parseArchive(json);
			if (JSON.stringify(archive.stock) !== stockPayload)
				throw new SandboxDataError('This handover belongs to a different dated stock town');
			const restored = world.restore(archive.sandbox);
			if (!matchesBaseline(restored, archive.sandbox))
				throw new SandboxDataError('Handover sandbox baseline differs from dated stock');
			if (restored.readOrphans().length)
				throw new SandboxDataError('Handover contains unavailable sandbox placements');
			return restored;
		}
	});
}
