/** Module: Validates asset registrations and dispatches headless builds against resolved hosts. */
import { PlaceableObject } from '../object';
import { defineParams, resolveParams, type ParameterSchema } from '../params';
import { Random } from '../random';
import type { AssetHost } from './hosts';

export type { AssetHost, HostAddress, Placement } from './hosts';

type Parameters = Readonly<Record<string, number>>;

/** Entry metadata. IDs use slash-separated, lowercase kebab-case segments. */
export type AssetDefinition<Host extends AssetHost = AssetHost> = Readonly<{
	id: string;
	kind: string;
	tags: readonly string[];
	params: ParameterSchema;
	hostKinds: readonly Host['kind'][];
}>;

/** Definition plus its deterministic, world-meter object builder. */
export type AssetEntry<Host extends AssetHost = AssetHost> = AssetDefinition<Host> &
	Readonly<{
		validateHost?: (host: Host) => void;
		build: (host: Host, params: Parameters, seed: number) => PlaceableObject;
	}>;

/** Exact kind and all requested tags. An empty filter lists the registry in registration order. */
export type AssetFilter = Readonly<{ kind?: string; tags?: readonly string[] }>;

/** No asset is registered at the supplied ID. */
export class UnknownAssetError extends Error {
	override name = 'UnknownAssetError';
}

/** A known asset received a host of an unsupported kind. */
export class WrongAssetHostError extends Error {
	override name = 'WrongAssetHostError';
}

/** An override is malformed or the seed is invalid. */
export class InvalidAssetParamsError extends Error {
	override name = 'InvalidAssetParamsError';
}

const assetId = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*)*(?![\s\S])/;

function readInputs(schema: ParameterSchema, params: Parameters, seed: number) {
	try {
		if (params === null || typeof params !== 'object')
			throw new TypeError('Expected a parameter record');
		const prototype: unknown = Object.getPrototypeOf(params);
		if (prototype !== Object.prototype && prototype !== null)
			throw new TypeError('Expected a plain parameter record');
		if (typeof seed !== 'number') throw new TypeError('Expected a numeric seed');
		return {
			params: Object.freeze(resolveParams(schema, params)),
			seed: Random.create({ seed }).seed
		};
	} catch (cause) {
		throw new InvalidAssetParamsError('Invalid asset parameters or seed', { cause });
	}
}

/** Indexes immutable definitions, rejecting malformed or duplicate IDs. Builders receive validated
 * inputs and must only use the resolved host, parameters and seed. LIB-2, LIB-7, LIB-11. */
export function createAssetRegistry<Host extends AssetHost>(entries: readonly AssetEntry<Host>[]) {
	const byId = new Map<
		string,
		Pick<AssetEntry<Host>, 'build' | 'validateHost'> & { definition: AssetDefinition<Host> }
	>();
	for (const { id, kind, tags, params, hostKinds, build, validateHost } of entries) {
		if (!assetId.test(id) || byId.has(id))
			throw new RangeError(`Invalid or duplicate asset ID "${id}"`);
		const definition = Object.freeze({
			id,
			kind,
			tags: Object.freeze([...tags]),
			params: defineParams(params),
			hostKinds: Object.freeze([...hostKinds])
		});
		byId.set(id, { definition, build, validateHost });
	}
	const definitions = Object.freeze([...byId.values()].map(({ definition }) => definition));
	function requireAsset(id: string) {
		const entry = byId.get(id);
		if (!entry) throw new UnknownAssetError(`Unknown asset "${id}"`);
		return entry;
	}
	function requireHost(id: string, host: Host) {
		const entry = requireAsset(id);
		if (!entry.definition.hostKinds.includes(host?.kind))
			throw new WrongAssetHostError(`Asset "${id}" cannot use host "${host?.kind}"`);
		return entry;
	}

	return Object.freeze({
		/** Returns definitions matching the kind and all requested tags in registration order. */
		listAssets({ kind, tags = [] }: AssetFilter = {}): readonly AssetDefinition<Host>[] {
			return definitions.filter(
				(entry) =>
					(kind === undefined || kind === entry.kind) &&
					tags.every((tag) => entry.tags.includes(tag))
			);
		},
		/** Returns the immutable definition of one asset or throws UnknownAssetError. */
		readAsset(id: string): AssetDefinition<Host> {
			return requireAsset(id).definition;
		},
		/** Validates a resolved host's kind and asset-specific geometry, without building it. */
		validateHost(id: string, host: Host): void {
			requireHost(id, host).validateHost?.(host);
		},
		/** Checks ID, host kind, parameter record and seed in order, then builds a detached object. */
		buildAsset(id: string, host: Host, overrides: Parameters, seed: number): PlaceableObject {
			const { definition, build, validateHost } = requireHost(id, host);
			validateHost?.(host);
			const inputs = readInputs(definition.params, overrides, seed);
			return PlaceableObject.create(build(host, inputs.params, inputs.seed));
		}
	});
}
