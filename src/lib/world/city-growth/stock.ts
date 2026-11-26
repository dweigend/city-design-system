import type { Random } from '../../core/random';
import { subdivideParcelFrontage } from '../../domain/parcels';
import { createPrismRun, type Construction } from './building';
import type { GrowthCarrier } from './carrier';
import { createCellConstruction, createWing } from './construction';
import type { createStock } from './history';
import { readEra, splitMinimums } from './recipe';
import { readBuildingStoreys, readStoreyCaps } from './skyline';
import type {
	CityGrowthBuilding,
	CityGrowthEvent,
	CityGrowthHolding,
	CityGrowthPart,
	CityGrowthRecipe,
	CityStockChange
} from './types';

type Addition = Extract<CityStockChange, { storeys: number }>;
type EventDate = Pick<CityGrowthEvent, 'year' | 'sequence'>;

function createExtension(
	carrier: GrowthCarrier,
	building: CityGrowthBuilding,
	storeys: number,
	construction: Construction,
	useOverride?: CityGrowthPart['use']
) {
	const storeyParts = building.parts.filter(({ kind }) => kind === 'storey');
	const roof = Math.max(...storeyParts.map(({ datumIndex }) => datumIndex));
	const roofParts = storeyParts.filter(({ datumIndex }) => datumIndex === roof);
	const burgage = carrier.readBurgage(building.holdingId);
	if (burgage) {
		const useByCell = new Map(
			roofParts.flatMap(({ cellId, use }) =>
				cellId === undefined ? [] : [[cellId, useOverride ?? use] as const]
			)
		);
		return createCellConstruction(
			building.id,
			burgage,
			carrier.planes,
			roof + 1,
			storeys,
			useByCell,
			construction
		);
	}
	const [{ shape, use }] = roofParts;
	if (shape.kind !== 'prism') throw Error('Expected a roof prism');
	return Object.freeze(
		createPrismRun(building.id, shape.polygon, roof + 1, storeys, carrier.planes, {
			...construction,
			use: useOverride ?? use
		})
	);
}

function createAddition(
	carrier: GrowthCarrier,
	building: CityGrowthBuilding,
	change: Addition,
	construction: Construction,
	date: EventDate
): CityGrowthEvent | undefined {
	const { id: buildingId, holdingId } = building;
	if (change.kind === 'extend') {
		const parts = createExtension(carrier, building, change.storeys, construction, change.use);
		if (parts.length)
			return Object.freeze({ kind: 'building-extended', ...date, buildingId, holdingId, parts });
		return;
	}
	const burgage = carrier.readBurgage(holdingId);
	if (!burgage || building.parts.some(({ cellId }) => cellId === burgage.rearId)) return;
	const parts = createWing(
		buildingId,
		burgage,
		burgage.rearId,
		carrier.planes,
		change.storeys,
		construction
	);
	if (parts.length)
		return Object.freeze({ kind: 'building-infill', ...date, buildingId, holdingId, parts });
}

function createSplit(
	carrier: GrowthCarrier,
	holding: CityGrowthHolding,
	date: EventDate,
	protectedHoldingIds: readonly string[]
) {
	const result = subdivideParcelFrontage(
		holding,
		holding.portal,
		splitMinimums,
		carrier.linearToleranceM
	);
	if (!result) return;
	const createChild = ({ parcel, portal }: (typeof result)[number]): CityGrowthHolding =>
		Object.freeze({
			...parcel,
			portal,
			memberCellIds: holding.memberCellIds,
			builtYear: date.year,
			protected: protectedHoldingIds.includes(parcel.id),
			parentHoldingId: holding.id,
			...(holding.centerId && { centerId: holding.centerId })
		});
	const children = Object.freeze([createChild(result[0]), createChild(result[1])] as const);
	return Object.freeze({
		kind: 'holding-split' as const,
		...date,
		predecessorId: holding.id,
		childIds: Object.freeze([children[0].id, children[1].id] as const),
		children
	});
}

function createConversion(
	building: CityGrowthBuilding,
	change: Extract<CityStockChange, { kind: 'convert' }>,
	date: EventDate
) {
	const partIds = building.parts
		.filter(
			({ id, kind, use }) =>
				kind === 'storey' &&
				use !== change.use &&
				(change.partId === undefined || change.partId === id) &&
				(change.fromUse === undefined || change.fromUse === use)
		)
		.map(({ id }) => id);
	if (!partIds.length) return;
	return Object.freeze({
		kind: 'building-converted' as const,
		...date,
		buildingId: building.id,
		holdingId: building.holdingId,
		partIds: Object.freeze(partIds),
		use: change.use,
		convertedYear: date.year
	});
}

function proposeChange(
	carrier: GrowthCarrier,
	stock: ReturnType<typeof createStock>,
	recipe: CityGrowthRecipe,
	change: CityStockChange,
	holding: CityGrowthHolding,
	date: EventDate,
	random: Random,
	readCap?: ReturnType<typeof readStoreyCaps>
): CityGrowthEvent | undefined {
	const building = stock.buildings.get(holding.id);
	switch (change.kind) {
		case 'split':
			if (!building && !holding.protected && stock.holdings.size < recipe.maximumActiveHoldings)
				return createSplit(carrier, holding, date, recipe.protectedHoldingIds ?? []);
			return;
		case 'retire':
			if (building && !holding.protected)
				return Object.freeze({
					kind: 'building-retired',
					...date,
					holdingId: holding.id,
					buildingId: building.id,
					retiredYear: date.year
				});
			return;
		case 'convert':
			if (building) return createConversion(building, change, date);
			return;
		case 'infill':
		case 'extend': {
			if (!building) return;
			const cap = readCap?.(holding) ?? Infinity;
			const existing = change.kind === 'extend' ? readBuildingStoreys(building) : 0;
			const storeys = Math.min(change.storeys, cap - existing);
			if (storeys > 0)
				return createAddition(
					carrier,
					building,
					{ ...change, storeys },
					{
						builtYear: date.year,
						era: readEra(recipe, date.year),
						seed: random.derive('massing').seed,
						use: change.use ?? building.use
					},
					date
				);
			return;
		}
	}
}

export function selectStockChange(
	carrier: GrowthCarrier,
	stock: ReturnType<typeof createStock>,
	recipe: CityGrowthRecipe,
	change: CityStockChange,
	date: EventDate,
	random: Random
) {
	const { holdingId } = change;
	const readCap =
		recipe.development &&
		(change.kind === 'infill' || change.kind === 'extend') &&
		stock.buildings.size
			? readStoreyCaps(carrier, stock)
			: undefined;
	if (holdingId !== undefined) {
		const target = stock.holdings.get(holdingId);
		return (
			target &&
			proposeChange(carrier, stock, recipe, change, target, date, random.derive(holdingId), readCap)
		);
	}
	const ranked = [...stock.holdings.values()]
		.map((holding) => ({
			holding,
			rank: random.derive(holding.id).number()
		}))
		.sort(
			(a, b) =>
				a.rank - b.rank || Number(a.holding.id > b.holding.id) - Number(a.holding.id < b.holding.id)
		);
	for (const { holding } of ranked) {
		const event = proposeChange(
			carrier,
			stock,
			recipe,
			change,
			holding,
			date,
			random.derive(holding.id),
			readCap
		);
		if (event) return event;
	}
}
