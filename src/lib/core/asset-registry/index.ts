/** Module: Validates asset registrations and dispatches headless builds against resolved hosts. */
import { createCatalog, type CatalogRow } from '../catalog';
import { PlaceableObject } from '../object';
import { defineParams, resolveParams, type ParameterSchema } from '../params';
import { Random } from '../random';
import type { AssetHost } from './hosts';

export type {
	/** Resolved placement inputs in world meters. */
	AssetHost,
	/** Local host address. */
	HostAddress,
	/** A rebuildable placement. */
	Placement
} from './hosts';

type Parameters = Readonly<Record<string, number>>;

/** Entry metadata. IDs use slash-separated, lowercase kebab-case segments. */
export type AssetDefinition<Host extends AssetHost = AssetHost> = Readonly<{
	id: string;
	kind: string;
	tags: readonly string[];
	params: ParameterSchema;
	hostKinds: readonly Host['kind'][];
}>;

/** Geometry with optional non-geometric data owned by its builder. */
export type AssetBuild<Metadata> = Readonly<{ object: PlaceableObject; metadata?: Metadata }>;

const assetBuild = Symbol('asset-build');
type AssetProduct<Metadata> = AssetBuild<Metadata> & Readonly<{ [assetBuild]: true }>;

/** Wraps builder-owned metadata with its geometry. The registry freezes both on publication. */
export function createAssetBuild<Metadata>(
	object: PlaceableObject,
	metadata: Metadata
): AssetProduct<Metadata> {
	return { [assetBuild]: true, object, metadata };
}

/** Definition plus its deterministic, world-meter object builder. */
export type AssetEntry<
	Host extends AssetHost = AssetHost,
	Metadata = never
> = AssetDefinition<Host> &
	Readonly<{
		validateHost?: (host: Host) => void;
		build: (
			host: Host,
			params: Parameters,
			seed: number
		) => PlaceableObject | AssetProduct<Metadata>;
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
export function createAssetRegistry<Host extends AssetHost, Metadata = never>(
	entries: readonly AssetEntry<Host, Metadata>[]
) {
	type RegisteredAsset = CatalogRow &
		Pick<AssetEntry<Host, Metadata>, 'build' | 'validateHost'> & {
			definition: AssetDefinition<Host>;
		};
	const assets = createCatalog<RegisteredAsset>({
		rows: entries.map((entry) => ({
			id: entry.id,
			definition: entry,
			build: entry.build,
			validateHost: entry.validateHost
		})),
		validateId: (id) => assetId.test(id),
		validateRow(row) {
			// Snapshot definitions only after the ID passes the catalog checks.
			const { kind, tags, params, hostKinds } = row.definition;
			row.definition = Object.freeze({
				id: row.id,
				kind,
				tags: Object.freeze([...tags]),
				params: defineParams(params),
				hostKinds: Object.freeze([...hostKinds])
			});
		},
		missingError: (id) => new UnknownAssetError(`Unknown asset "${id}"`)
	});
	function requireHost(id: string, host: Host) {
		const entry = assets.get(id);
		if (!entry.definition.hostKinds.includes(host?.kind))
			throw new WrongAssetHostError(`Asset "${id}" cannot use host "${host?.kind}"`);
		return entry;
	}

	/** Builds validated geometry, freezing the result and shallow-freezing any builder-owned metadata. */
	function buildAssetResult(
		id: string,
		host: Host,
		overrides: Parameters,
		seed: number
	): AssetBuild<Metadata> {
		const { definition, build, validateHost } = requireHost(id, host);
		validateHost?.(host);
		const inputs = readInputs(definition.params, overrides, seed);
		const product = build(host, inputs.params, inputs.seed);
		const result: AssetBuild<Metadata> = assetBuild in product ? product : { object: product };
		const { object, metadata } = result;
		const geometry = PlaceableObject.isValidated(object) ? object : PlaceableObject.create(object);
		if (metadata === undefined) return Object.freeze({ object: geometry });
		Object.freeze(metadata);
		return Object.freeze({ object: geometry, metadata });
	}

	return Object.freeze({
		/** Returns definitions matching the kind and all requested tags in registration order. */
		listAssets({ kind, tags = [] }: AssetFilter = {}): readonly AssetDefinition<Host>[] {
			return assets
				.list(
					({ definition }) =>
						(kind === undefined || kind === definition.kind) &&
						tags.every((tag) => definition.tags.includes(tag))
				)
				.map(({ definition }) => definition);
		},
		/** Returns the immutable definition of one asset or throws UnknownAssetError. */
		readAsset(id: string): AssetDefinition<Host> {
			return assets.get(id).definition;
		},
		/** Validates a resolved host's kind and asset-specific geometry, without building it. */
		validateHost(id: string, host: Host): void {
			requireHost(id, host).validateHost?.(host);
		},
		/** Builds a validated, detached object. Reuses geometry already frozen by the object factory. */
		buildAsset(id: string, host: Host, overrides: Parameters, seed: number): PlaceableObject {
			return buildAssetResult(id, host, overrides, seed).object;
		},
		buildAssetResult
	});
}
