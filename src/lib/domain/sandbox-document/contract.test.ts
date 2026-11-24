import { describe, expect, test } from 'bun:test';
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

const world = { seed: 1201, planFamily: 'square', citySize: 1800 };
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
		const other = { ...world, planFamily: 'triangular' };
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

	test('restores the current position and redo tail, with stable IDs, order and seeds', () => {
		const document = createSandboxDocument(world);
		const north = parcel('north');
		document.apply([place(parcel('west')), place(north)]);
		const first = document.readPlacement(north)!;
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
			restoreSandboxDocument(document.serialize(), { ...world, citySize: 2000 })
		).toThrow(SandboxDataError);
		expect(() =>
			restoreSandboxDocument(document.serialize().replace('"position":0', '"position":2'))
		).toThrow(SandboxDataError);
		expect(() =>
			restoreSandboxDocument(document.serialize().replace('"kind":"parcel"', '"kind":"unknown"'))
		).toThrow(SandboxDataError);
	});
});
