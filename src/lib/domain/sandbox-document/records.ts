import type { HostAddress, Placement } from '../../core/asset-registry';
import { Random } from '../../core/random';
import { createWorldReference, encodeKey, readWorldReference, type Ref } from '../../core/ref';
import { familyNames, modelTones, type Family, type ModelTone } from '../material';
import { defaults } from '../../../config/sandbox-document';

export type WorldIdentity = Readonly<{
	id: string;
	planScope?: string;
	seed?: number;
	terrainRevision: string;
	topologyRevision: string;
	registryRevision: string;
}>;
export type FinishOverride = Readonly<{ ref: Ref<'house-part'>; family: Family; tone?: ModelTone }>;

export type PlacementOverrides = Readonly<{
	cellOverrides?: Readonly<Record<string, number>>;
	finishOverrides?: readonly FinishOverride[];
}>;

type ReplaceOverrides = Readonly<{
	cellOverrides?: PlacementOverrides['cellOverrides'] | null;
	finishOverrides?: PlacementOverrides['finishOverrides'] | null;
}>;
export type SandboxPlacement = Placement &
	PlacementOverrides &
	Readonly<{
		id: string;
		hostReference: Ref<HostAddress['kind']>;
		registryRevision: string;
	}>;
export type SandboxEdit =
	| (Omit<Placement, 'seed'> &
			PlacementOverrides & { readonly kind: 'place'; readonly seed?: number })
	| Readonly<{ kind: 'remove'; id: string }>
	| (Readonly<{ kind: 'replace'; id: string; params: Placement['params']; seed?: number }> &
			ReplaceOverrides);
export type StockEdit = Extract<SandboxEdit, { kind: 'place' }>;
export type PlacementChange = Readonly<{
	id: string;
	before: SandboxPlacement | undefined;
	after: SandboxPlacement | undefined;
}>;

export class SandboxDataError extends Error {
	override name = 'SandboxDataError';
}

export function record(value: unknown): Record<string, unknown> {
	if (
		value === null ||
		typeof value !== 'object' ||
		![Object.prototype, null].includes(Object.getPrototypeOf(value) as object | null)
	)
		throw new SandboxDataError('Expected a plain record');
	return value as Record<string, unknown>;
}

export function number(value: unknown) {
	if (typeof value !== 'number' || !Number.isFinite(value))
		throw new SandboxDataError('Expected a finite number');
	return value === 0 ? 0 : value;
}

export function name(value: unknown) {
	if (typeof value !== 'string' || !value.length) throw new SandboxDataError('Expected a name');
	return value;
}

// Exact arithmetic: a seed is a serialized unsigned 32-bit integer.
export function seedValue(value: unknown) {
	const seed = number(value);
	if (seed !== seed >>> 0) throw new SandboxDataError('Expected an unsigned 32-bit seed');
	return seed;
}

export function worldIdentity(input: unknown): WorldIdentity {
	const { id, planScope, seed, terrainRevision, topologyRevision, registryRevision } =
		record(input);
	return Object.freeze({
		id: name(id),
		...(planScope === undefined ? {} : { planScope: name(planScope) }),
		...(seed === undefined ? {} : { seed: seedValue(seed) }),
		terrainRevision: name(terrainRevision),
		topologyRevision: name(topologyRevision),
		registryRevision: name(registryRevision)
	});
}

function groundIndex(value: unknown): number {
	const index = Math.round(number(value) / defaults.groundAddressStepM);
	if (!Number.isSafeInteger(index))
		throw new SandboxDataError('Ground address is outside the safe grid');
	return index || 0;
}

function groundPoint(index: unknown): number {
	if (typeof index !== 'number' || !Number.isSafeInteger(index))
		throw new SandboxDataError('Expected an integer ground coordinate');
	const value = index * defaults.groundAddressStepM;
	if (groundIndex(value) !== index)
		throw new SandboxDataError('Ground grid coordinate cannot be represented');
	return value || 0;
}

// Exact arithmetic: ground addresses are XYZ triples in meters.
function hostAddress(input: unknown): HostAddress {
	const { kind, id, point } = record(input);
	switch (kind) {
		case 'ground':
			if (!Array.isArray(point) || point.length !== 3)
				throw new SandboxDataError('Expected an XYZ ground address');
			return Object.freeze({
				kind,
				point: Object.freeze([
					groundPoint(groundIndex(point[0])),
					groundPoint(groundIndex(point[1])),
					groundPoint(groundIndex(point[2]))
				] as const)
			});
		case 'parcel':
		case 'cell-space':
		case 'lattice-bay':
		case 'frame':
		case 'plan-edge':
		case 'graph-edge':
			return Object.freeze({ kind, id: name(id) });
		default:
			throw new SandboxDataError('Unknown host kind');
	}
}

export function readParams(input: unknown): Placement['params'] {
	return Object.freeze(
		Object.fromEntries(
			Object.entries(record(input))
				.sort(([a], [b]) => (a < b ? -1 : Number(a > b)))
				.map(([key, value]) => [key, number(value)])
		)
	);
}

const reservedCellKeys = new Set(['__proto__', 'constructor', 'prototype']);

function readCells(input: unknown) {
	const cells = Object.entries(record(input)).sort(([a], [b]) => (a < b ? -1 : Number(a > b)));
	for (const [id, count] of cells)
		if (
			!id ||
			reservedCellKeys.has(id) ||
			typeof count !== 'number' ||
			!Number.isSafeInteger(count) ||
			count < 0
		)
			throw new SandboxDataError('Expected a nonnegative integer storey count for a fine cell');
	return Object.freeze(Object.fromEntries(cells.map(([id, count]) => [id, number(count)])));
}

function readFinishes(input: unknown): readonly FinishOverride[] {
	if (!Array.isArray(input)) throw new SandboxDataError('Expected a list of part finishes');
	const keys = new Set<string>();
	const finishes = input.map((item: unknown): FinishOverride => {
		const { ref: inputRef, family, tone } = record(item);
		const ref = readWorldReference(inputRef);
		if (ref?.kind !== 'house-part' || keys.has(ref.key))
			throw new SandboxDataError('Expected a distinct house-part reference for each finish');
		if (!familyNames.some((id) => id === family))
			throw new SandboxDataError('Unknown material family');
		if (tone !== undefined && !modelTones.some((id) => id === tone))
			throw new SandboxDataError('Unknown material tone');
		keys.add(ref.key);
		return Object.freeze({
			ref: createWorldReference(ref.world, 'house-part', ref.key),
			family: family as Family,
			...(tone === undefined ? {} : { tone: tone as ModelTone })
		});
	});
	return Object.freeze(
		finishes.sort(({ ref: a }, { ref: b }) => (a.key < b.key ? -1 : Number(a.key > b.key)))
	);
}

function overrideOf<T>(input: unknown, read: (input: unknown) => T, kind: unknown) {
	if (input === undefined) return undefined;
	if (input === null && kind === 'replace') return null;
	return read(input);
}

export function edit(input: unknown): SandboxEdit {
	const { kind, assetId, host, params, seed, id, cellOverrides, finishOverrides } = record(input);
	const cells = overrideOf(cellOverrides, readCells, kind);
	const finishes = overrideOf(finishOverrides, readFinishes, kind);
	const explicit = seed === undefined ? {} : { seed: seedValue(seed) };
	switch (kind) {
		case 'place':
			return Object.freeze({
				kind,
				assetId: name(assetId),
				host: hostAddress(host),
				params: readParams(params),
				...(cells && Object.keys(cells).length ? { cellOverrides: cells } : {}),
				...(finishes?.length ? { finishOverrides: finishes } : {}),
				...explicit
			});
		case 'remove':
			return Object.freeze({ kind, id: name(id) });
		case 'replace':
			return Object.freeze({
				kind,
				id: name(id),
				params: readParams(params),
				...explicit,
				...(cells === undefined
					? {}
					: { cellOverrides: cells && Object.keys(cells).length ? cells : null }),
				...(finishes === undefined ? {} : { finishOverrides: finishes?.length ? finishes : null })
			});
		default:
			throw new SandboxDataError('Unknown sandbox edit');
	}
}

/** Scopes a local host address for storage or transfer. Ground keys are integer XYZ grid indices. */
export function readHostReference(world: WorldIdentity, host: HostAddress) {
	return createWorldReference(
		world.id,
		host.kind,
		host.kind === 'ground' ? encodeKey(host.point.map(groundIndex)) : host.id
	);
}

export function savedEdit(operation: SandboxEdit, world: WorldIdentity) {
	return operation.kind === 'place'
		? { ...operation, host: readHostReference(world, operation.host) }
		: operation;
}

export function replayEdit(input: unknown, world: WorldIdentity, readsOverrides = true) {
	const source = record(input);
	const operation: Record<string, unknown> = readsOverrides
		? source
		: { ...source, cellOverrides: undefined, finishOverrides: undefined };
	if (operation.kind !== 'place') return edit(operation);
	const host = readWorldReference(operation.host);
	if (!host || host.world !== world.id) throw new SandboxDataError('Invalid saved host reference');
	const local =
		host.kind === 'ground'
			? { kind: host.kind, point: groundKey(host.key) }
			: { kind: host.kind, id: host.key };
	return edit({ ...operation, host: local });
}

// Exact arithmetic: a serialized ground key has three integer coordinates.
function groundKey(key: string) {
	try {
		const indices: unknown = JSON.parse(key);
		if (Array.isArray(indices) && indices.length === 3) return indices.map(groundPoint);
	} catch (cause) {
		if (cause instanceof SandboxDataError) throw cause;
	}
	throw new SandboxDataError('Invalid ground reference');
}

/** Keys the single slot of an address in one world across revisions. */
export function readPlacementId(world: WorldIdentity, host: HostAddress): string {
	return placementId(readHostReference(world, host));
}

function placementId({ world, kind, key }: Ref) {
	return encodeKey([world, kind, key]);
}

// Exact arithmetic: deterministic initial seed for worlds that omit a seed.
const defaultPlacementSeed = /* Exact arithmetic: default seed in the placement wire format. */ 0;

export function placement(
	world: WorldIdentity,
	{ assetId, host, params, seed, ...operation }: StockEdit
): SandboxPlacement {
	const reference = readHostReference(world, host);
	return Object.freeze({
		...placementOverrides(world, host, operation),
		id: placementId(reference),
		assetId,
		hostReference: reference,
		registryRevision: world.registryRevision,
		host,
		params,
		// Ground placements retain the nested coordinate tuple in the seed input.
		seed:
			seed ??
			Random.create({ seed: world.seed ?? defaultPlacementSeed }).derive(
				host.kind === 'ground'
					? JSON.stringify([host.kind, host.point])
					: encodeKey([host.kind, host.id])
			).seed
	});
}

function placementOverrides(
	world: Pick<WorldIdentity, 'id'>,
	host: HostAddress,
	overrides: PlacementOverrides
) {
	const { cellOverrides, finishOverrides } = overrides;
	if ((cellOverrides || finishOverrides) && host.kind !== 'parcel')
		throw new SandboxDataError('House overrides require a parcel');
	for (const { ref } of finishOverrides ?? []) {
		let key: unknown;
		try {
			key = JSON.parse(ref.key);
		} catch {
			throw new SandboxDataError('Invalid house-part key');
		}
		// A house-part key is the house owner and a local part ID.
		if (
			ref.world !== world.id ||
			!Array.isArray(key) ||
			key.length !== 2 ||
			host.kind !== 'parcel' ||
			key[0] !== 'house/' + host.id ||
			typeof key[1] !== 'string' ||
			!key[1] ||
			encodeKey(key) !== ref.key
		)
			throw new SandboxDataError('Finish reference does not belong to this parcel and world');
	}
	return {
		...(cellOverrides ? { cellOverrides } : {}),
		...(finishOverrides ? { finishOverrides } : {})
	};
}

export function hasSamePlacementStructure(a: SandboxPlacement, b: SandboxPlacement) {
	return (
		a.id === b.id &&
		a.assetId === b.assetId &&
		a.seed === b.seed &&
		JSON.stringify(a.params) === JSON.stringify(b.params) &&
		JSON.stringify(a.cellOverrides) === JSON.stringify(b.cellOverrides)
	);
}

export function hasSamePlacement(a: SandboxPlacement, b: SandboxPlacement) {
	return (
		hasSamePlacementStructure(a, b) &&
		JSON.stringify(a.finishOverrides) === JSON.stringify(b.finishOverrides)
	);
}

export function replace(
	before: SandboxPlacement,
	{
		params,
		seed = before.seed,
		cellOverrides = before.cellOverrides,
		finishOverrides = before.finishOverrides
	}: Extract<SandboxEdit, { kind: 'replace' }>
): SandboxPlacement {
	const after = { ...before, params, seed };
	delete after.cellOverrides;
	delete after.finishOverrides;
	Object.assign(
		after,
		placementOverrides({ id: before.hostReference.world }, before.host, {
			cellOverrides: cellOverrides ?? undefined,
			finishOverrides: finishOverrides ?? undefined
		})
	);
	return hasSamePlacementStructure(before, after) &&
		JSON.stringify(before.finishOverrides) === JSON.stringify(after.finishOverrides)
		? before
		: Object.freeze(after);
}
