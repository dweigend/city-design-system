import type { HostAddress, Placement } from '../../core/asset-registry';
import { Random } from '../../core/random';

export type WorldIdentity = Readonly<{
	seed: number;
	planFamily: string;
	citySize: number;
	terrainRevision: string;
	topologyRevision: string;
}>;
export type SandboxPlacement = Placement & Readonly<{ id: string }>;
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
	const { seed, planFamily, citySize, terrainRevision, topologyRevision } = record(input);
	if (number(citySize) <= 0) throw new SandboxDataError('City size must be positive');
	return Object.freeze({
		seed: seedValue(seed),
		planFamily: name(planFamily),
		citySize: number(citySize),
		terrainRevision: name(terrainRevision),
		topologyRevision: name(topologyRevision)
	});
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
				point: Object.freeze([number(point[0]), number(point[1]), number(point[2])] as const)
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

export function hostKey(host: HostAddress): string {
	return JSON.stringify([host.kind, host.kind === 'ground' ? host.point : host.id]);
}

export function worldKey({
	seed,
	planFamily,
	citySize,
	terrainRevision,
	topologyRevision
}: WorldIdentity): string {
	return JSON.stringify([seed, planFamily, citySize, terrainRevision, topologyRevision]);
}

/** Keys the single occupancy slot of an exact address by its full world identity. */
export function readPlacementId(world: WorldIdentity, host: HostAddress): string {
	return JSON.stringify([worldKey(world), hostKey(host)]);
}

export function placement(
	world: WorldIdentity,
	{ assetId, host, params, seed }: Extract<SandboxEdit, { kind: 'place' }>
): SandboxPlacement {
	const id = readPlacementId(world, host);
	return Object.freeze({
		id,
		assetId,
		host,
		params,
		seed: seed ?? Random.create({ seed: world.seed }).derive(hostKey(host)).seed
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
