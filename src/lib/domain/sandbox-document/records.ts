import type { HostAddress, Placement } from '../../core/asset-registry';
import { Random } from '../../core/random';
import { createWorldReference, encodeKey, readWorldReference, type Ref } from '../../core/ref';
import { defaults } from '../../../config/sandbox-document';

export type WorldIdentity = Readonly<{
	id: string;
	seed?: number;
	terrainRevision: string;
	topologyRevision: string;
	registryRevision: string;
}>;
export type SandboxPlacement = Placement &
	Readonly<{
		id: string;
		hostReference: Ref<HostAddress['kind']>;
		registryRevision: string;
	}>;
export type SandboxEdit =
	| (Omit<Placement, 'seed'> & { readonly kind: 'place'; readonly seed?: number })
	| Readonly<{ kind: 'remove'; id: string }>
	| Readonly<{ kind: 'replace'; id: string; params: Placement['params']; seed?: number }>;
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
	const { id, seed, terrainRevision, topologyRevision, registryRevision } = record(input);
	return Object.freeze({
		id: name(id),
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

export function edit(input: unknown): SandboxEdit {
	const { kind, assetId, host, params, seed, id } = record(input);
	const explicit = seed === undefined ? {} : { seed: seedValue(seed) };
	switch (kind) {
		case 'place':
			return Object.freeze({
				kind,
				assetId: name(assetId),
				host: hostAddress(host),
				params: readParams(params),
				...explicit
			});
		case 'remove':
			return Object.freeze({ kind, id: name(id) });
		case 'replace':
			return Object.freeze({ kind, id: name(id), params: readParams(params), ...explicit });
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

export function replayEdit(input: unknown, world: WorldIdentity) {
	const operation = record(input);
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
const defaultPlacementSeed = 0;

export function placement(
	world: WorldIdentity,
	{ assetId, host, params, seed }: Extract<SandboxEdit, { kind: 'place' }>
): SandboxPlacement {
	const reference = readHostReference(world, host);
	return Object.freeze({
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

export function replace(
	before: SandboxPlacement,
	{ params, seed = before.seed }: Extract<SandboxEdit, { kind: 'replace' }>
) {
	if (seed === before.seed && JSON.stringify(params) === JSON.stringify(before.params))
		return before;
	return Object.freeze({ ...before, params, seed });
}
