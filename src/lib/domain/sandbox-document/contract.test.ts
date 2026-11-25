import { describe, expect, test } from 'bun:test';
import { defaults } from '../../../config/sandbox-document';
import type { HostAddress } from '../../core/asset-registry';
import {
	createSandboxDocument,
	MissingPlacementError,
	OccupiedHostError,
	readPlacementId,
	restoreSandboxDocument,
	SandboxDataError,
	type SandboxEdit
} from './index';

const world = {
	seed: 1201,
	id: 'square-plan',
	registryRevision: 'registry-test',
	terrainRevision: 'terrain-test',
	topologyRevision: 'topology-test'
};
const parcel = (id: string): HostAddress => ({ kind: 'parcel', id });
const place = (host: HostAddress): SandboxEdit => ({
	kind: 'place',
	host,
	assetId: 'house/neutral',
	params: { height: 10 }
});

describe('sandbox document', () => {
	test('rejects duplicate occupancy atomically and gives different host kinds separate slots', () => {
		const document = createSandboxDocument(world);
		const north = parcel('north');
		expect(() => document.apply([place(north), place(north)])).toThrow(OccupiedHostError);
		expect(document.readHistory()).toEqual({ placements: 0, strokes: 0, position: 0 });
		const edge = { kind: 'graph-edge', id: 'north' } as const;
		document.apply([place(north), { ...place(edge), assetId: 'access/walkway' } as SandboxEdit]);
		expect(document.readPlacements()).toHaveLength(2);
		expect(() => document.apply([place(edge)])).toThrow(OccupiedHostError);
		expect(() => document.apply([{ kind: 'remove', id: 'missing' }])).toThrow(
			MissingPlacementError
		);
		const other = { ...world, id: 'triangle-plan' };
		expect(readPlacementId(world, north)).not.toBe(readPlacementId(other, north));
	});

	test('erases, replaces parameters and restores an entire gesture in one undo', () => {
		const document = createSandboxDocument(world);
		const [north, south] = [parcel('north'), parcel('south')];
		document.apply([place(north), place(south)]);
		const initial = document.readPlacements();
		const [first, second] = initial;
		const changes = document.apply([
			{ kind: 'replace', id: first.id, params: { height: 12 }, seed: 400 },
			{ kind: 'remove', id: second.id }
		]);
		expect(changes.map(({ id }) => id)).toEqual([first.id, second.id]);
		expect(document.readPlacements()).toEqual([{ ...first, params: { height: 12 }, seed: 400 }]);
		document.undo();
		expect(document.readPlacements()).toEqual(initial);
		document.redo();
		expect(document.readPlacements()).toHaveLength(1);
		document.undo();
		document.apply([place(parcel('west'))]);
		expect(document.redo()).toEqual([]);
		expect(document.readHistory()).toEqual({ placements: 3, strokes: 2, position: 2 });
	});

	test('amends a growing gesture into one undo step that saves and restores alike', () => {
		const document = createSandboxDocument(world);
		document.apply([place(parcel('a'))]);
		document.amend([place(parcel('b'))]);
		const third = document.amend([place(parcel('c'))]);
		expect(third.map(({ after }) => after?.host)).toEqual([parcel('c')]);
		expect(document.readHistory()).toEqual({ placements: 3, strokes: 1, position: 1 });
		const restored = restoreSandboxDocument(document.serialize(), world);
		expect(restored.readPlacements()).toEqual(document.readPlacements());
		expect(document.undo()).toHaveLength(3);
		expect(document.readHistory()).toEqual({ placements: 0, strokes: 1, position: 0 });
		document.redo();
		const ids = document.readPlacements().map(({ id }) => id);
		document.amend(ids.map((id) => ({ kind: 'remove', id }) as const));
		expect(document.readHistory()).toEqual({ placements: 0, strokes: 0, position: 0 });
	});

	test('restores the current position and redo tail, with stable IDs, order and seeds', () => {
		const document = createSandboxDocument(world);
		const north = parcel('north');
		document.apply([place(parcel('west')), place(north)]);
		const first = document.readPlacement(north);
		if (!first) throw new Error('Expected the north placement');
		document.apply([{ kind: 'remove', id: first.id }]);
		document.apply([place(north)]);
		expect(document.readPlacement(north)).toEqual(first);
		document.undo();
		const restored = restoreSandboxDocument(document.serialize(), world);
		expect(restored.serialize()).toEqual(document.serialize());
		expect(restored.readHistory()).toEqual(document.readHistory());
		expect(restored.readPlacements()).toEqual(document.readPlacements());
		restored.redo();
		expect(restored.readPlacement(north)).toEqual(first);
		const replay = createSandboxDocument(world);
		replay.apply([place(north), place(parcel('west'))]);
		expect(replay.readPlacements()).toEqual(restored.readPlacements());
	});

	test('rejects malformed replay and preserves history if preparation fails', () => {
		const document = createSandboxDocument(world);
		const north = parcel('north');
		document.apply([place(north)]);
		document.undo();
		const fail = () => {
			throw new Error('Build failed');
		};
		expect(() => document.apply([place(parcel('south'))], fail)).toThrow('Build failed');
		expect(() => document.redo(fail)).toThrow('Build failed');
		expect(document.readHistory()).toEqual({ placements: 0, strokes: 1, position: 0 });
		expect(() =>
			restoreSandboxDocument(document.serialize(), { ...world, id: 'different-plan' })
		).toThrow(SandboxDataError);
		expect(() =>
			restoreSandboxDocument(document.serialize().replace('"position":0', '"position":2'))
		).toThrow(SandboxDataError);
		expect(() =>
			restoreSandboxDocument(document.serialize().replace('"kind":"parcel"', '"kind":"unknown"'))
		).toThrow(SandboxDataError);
	});
});

test('ground slots round XYZ independently to the configured millimetre grid', () => {
	const ground = (x: number, y: number, z: number): HostAddress => ({
		kind: 'ground',
		point: [x, y, z]
	});
	const document = createSandboxDocument(world);
	const first = ground(-0.0005, 0.00049, 0.001);
	const second = ground(0, 0, 0.001);
	document.apply([place(first)]);
	expect(document.readPlacement(second)?.host).toEqual(second);
	expect(document.readPlacement(first)?.hostReference.key).toBe('[0,0,1]');
	expect(() => document.apply([place(second)])).toThrow(OccupiedHostError);
	document.apply([place(ground(0, 0.00051, 0.001))]);
	expect(document.readPlacements()).toHaveLength(2);
	expect(restoreSandboxDocument(document.serialize()).serialize()).toBe(document.serialize());
	const incompatible = { ...world, registryRevision: 'new-builders' };
	expect(() => restoreSandboxDocument(document.serialize(), incompatible)).toThrow(
		'different asset registry revision'
	);
});

test('opaque identity needs no city size, family or seed', () => {
	const identity = {
		id: world.id,
		terrainRevision: world.terrainRevision,
		topologyRevision: world.topologyRevision,
		registryRevision: world.registryRevision
	};
	const document = createSandboxDocument(identity);
	document.apply([place(parcel('a|b\nc'))]);
	const rebuilt = restoreSandboxDocument(document.serialize(), {
		...identity,
		terrainRevision: 'later'
	});
	expect(rebuilt.readPlacements()).toEqual(document.readPlacements());
	expect(rebuilt.world.terrainRevision).toBe('later');
});

test('rejects a nested placement before a prepare callback can publish the same host twice', () => {
	const document = createSandboxDocument(world);
	const edit = place(parcel('north'));
	const before = document.serialize();
	expect(() =>
		document.apply([edit], () => {
			expect(document.readPlacements()).toEqual([]);
			document.apply([edit]);
		})
	).toThrow('Sandbox document write already in progress');
	expect(document.serialize()).toBe(before);
	expect(document.readPlacements()).toEqual([]);

	document.apply([edit]);
	expect(restoreSandboxDocument(document.serialize()).readHistory()).toEqual({
		placements: 1,
		strokes: 1,
		position: 1
	});
});

test('guards staging, amendment, history changes and projection initialization', () => {
	let duringResolve = () => {};
	const document = createSandboxDocument(world, (_id, _host, params) => {
		duringResolve();
		return params;
	});
	const edit = place(parcel('north'));
	const south = place(parcel('south'));
	const expectRejected = (write: () => unknown) => {
		const before = document.serialize();
		const placements = document.readPlacements();
		expect(write).toThrow('Sandbox document write already in progress');
		expect(document.serialize()).toBe(before);
		expect(document.readPlacements()).toEqual(placements);
	};
	duringResolve = () => document.undo();
	expectRejected(() => document.amend([edit]));
	duringResolve = () => {};
	document.apply([edit]);

	expectRejected(() => document.amend([south], () => document.attach(() => {})));
	expectRejected(() => document.undo(() => document.amend([south])));
	document.undo();
	expectRejected(() => document.redo(() => document.redo()));
	expectRejected(() => document.attach(() => document.apply([south])));

	document.attach(() => {});
	document.redo();
	expect(restoreSandboxDocument(document.serialize()).serialize()).toBe(document.serialize());
});

test('rejects oversized UTF-8 saves and excessive redo edits before starting replay', () => {
	const document = createSandboxDocument(world);
	const saved = JSON.parse(document.serialize());
	const resolver = () => {
		throw new Error('Replay must never start');
	};
	const bytes = defaults.maxRestoreBytes;
	expect(() => restoreSandboxDocument(' '.repeat(bytes + 1), world, resolver)).toThrow(
		'restore byte limit'
	);
	const oversizedUtf8 = JSON.stringify({ ...saved, padding: '田'.repeat(Math.floor(bytes / 2)) });
	expect(oversizedUtf8.length).toBeLessThan(bytes);
	expect(() => restoreSandboxDocument(oversizedUtf8, world, resolver)).toThrow(
		'restore byte limit'
	);
	const edits = Array.from({ length: defaults.maxRestoreEdits + 1 }, () => ({
		kind: 'remove',
		id: 'test'
	}));
	expect(() =>
		restoreSandboxDocument(JSON.stringify({ ...saved, strokes: [edits] }), world, resolver)
	).toThrow('restore edit limit');

	// Reject reserved prototype keys in cellOverrides even without a domain validator.
	for (const key of ['__proto__', 'constructor', 'prototype']) {
		expect(() =>
			document.apply([
				{
					...place(parcel('proto-guard')),
					cellOverrides: JSON.parse(`{"${key}":1}`)
				}
			])
		).toThrow('nonnegative integer storey count');
	}

	// Refuse to serialize locally authored history that restore() would reject.
	const big = createSandboxDocument(world);
	big.apply([place(parcel('north'))]);
	const placed = big.readPlacement(parcel('north'));
	if (!placed) throw new Error('Expected initial placement');
	const batch = Array.from({ length: 201 }, (_, i) => ({
		kind: 'replace' as const,
		id: placed.id,
		params: placed.params,
		seed: i + 1
	}));
	for (let s = 0; s < 100; s++) big.apply(batch);
	expect(() => big.serialize()).toThrow('restore edit limit');
});
