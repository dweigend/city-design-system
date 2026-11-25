import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { bounds } from '../../core/object';
import {
	createWorldReference,
	equalRefs,
	readWorldReference,
	type Ref,
	type ReferenceResolution
} from '../../core/ref';
import { readCellStoreys } from '../../domain/cell-space';
import { readHousePartRefs } from '../../domain/house-court';
import { readHostReference } from '../../domain/sandbox-document';
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
		{ ref: railRef, geometry: { ...rail, minimumRadiusM: 'unbounded' as const } }
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

	function open(exchange: Exchange) {
		const consumer = createSandboxWorld(site, layout, columns);
		const document = consumer.restore(exchange.document);
		return exchange.refs.map((encoded) => {
			const ref = required(readWorldReference(encoded), 'exchange ref');
			if (ref.kind === 'placement') {
				const placement = resolved(document.resolveReference(ref));
				return { ref, object: consumer.build(placement), geometry: placement };
			}
			const sample = exchange.survey.find((row) => equalRefs(row.ref, ref));
			return {
				ref,
				object: undefined,
				geometry: sample?.geometry ?? resolved(consumer.resolveReference(ref, document))
			};
		});
	}

	return {
		readExchange,
		readPlan(exchange: Exchange) {
			return open(exchange).map(({ ref, geometry, object }) => {
				if (!object) return { ref, geometry };
				const { min, max } = bounds(object);
				return {
					ref,
					geometry,
					footprint: object.footprint,
					extent: [min.slice(0, 2), max.slice(0, 2)],
					parts: object.parts.map((part) => {
						const { min, max } = bounds({ ...object, parts: [part] });
						return { id: part.id, extent: [min.slice(0, 2), max.slice(0, 2)] };
					}),
					topZ: max[2]
				};
			});
		},
		readSpatial: open,
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
