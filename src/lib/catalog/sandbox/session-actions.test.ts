import assert from 'node:assert/strict';
import { expect, test } from 'bun:test';
import { STORY } from '../data/grid';
import { sandboxGenerationYears } from '../data/sandbox';
import { storedModules, type Completion } from './feedback';
import { gestureDriver } from './fixtures/serial-gesture.fixture.test';

const house = { kind: 'house', use: 'living' } as const;
const dig = { kind: 'dig' } as const;
const erase = { kind: 'erase' } as const;
const walkway = { kind: 'line', transit: 'walkway' } as const;
const viaduct = { kind: 'line', transit: 'viaduct' } as const;

test('the second viaduct and the buffered dig both commit in input order', () => {
	const d = gestureDriver();
	try {
		const initialLines = d.world().state.lines;
		d.stroke(viaduct, '87/35', '96/35');
		d.finish();
		d.stroke(viaduct, '30/35', '38/35');
		d.stroke(dig, '90/35');
		expect(d.rings).toHaveLength(3);
		expect(d.events.map(({ kind }) => kind)).toEqual(['line']);
		d.finish();
		const builtLines = d.world().state.lines;
		expect(builtLines.slice(0, initialLines.length)).toEqual([...initialLines]);
		expect(
			builtLines.slice(initialLines.length).map(({ cellIds }) => [cellIds[0], cellIds.at(-1)])
		).toEqual([
			['87/35', '96/35'],
			['30/35', '38/35']
		]);
		expect(d.world().lines).toHaveLength(initialLines.length + 2);
		d.finish();
		expect(d.events.map(({ kind }) => kind)).toEqual(['line', 'line', 'dig']);
		expect(d.world().state.edits).toHaveLength(1);
		expect(d.world().state.lines).toEqual(builtLines);
		expect(d.world().lines).toHaveLength(builtLines.length);
	} finally {
		d.dispose();
	}
});

function topStory(d: ReturnType<typeof gestureDriver>, cellId: string) {
	return d.world().state.storyParts.get(cellId)?.at(-1)?.id;
}

test('Undo pressed during Erase waits until the floor under the brush has been erased', () => {
	const d = gestureDriver();
	try {
		d.stroke(house, '80/44');
		d.finish();
		const original = topStory(d, '80/44');
		d.stroke(erase, '80/44');
		d.finish();
		const firstErase = d.world().state.storyParts;
		d.stroke(house, '80/44');
		d.finish();
		const rebuilt = topStory(d, '80/44');
		expect(rebuilt).toBeDefined();
		expect(rebuilt).not.toBe(original);

		d.session.tool = erase;
		d.down('80/44');
		d.session.undo();
		d.session.undo();
		expect(topStory(d, '80/44')).toBe(rebuilt);
		d.up('80/44');
		d.finish();
		const event = d.events.at(-1);
		assert.equal(event?.kind, 'erase');
		const before = event.before.state.storyParts.get('80/44');
		assert.ok(before);
		expect(before.at(-1)?.id).toBe(rebuilt);
		expect(event.after.state.storyParts.get('80/44') ?? []).toEqual(before.slice(0, -1));
		expect(d.world().state.storyParts).toEqual(firstErase);
		expect(d.session.canRedo).toBe(true);
	} finally {
		d.dispose();
	}
});

test('a short-span warning survives a later rejected survey and clears on dismissal or success', () => {
	const d = gestureDriver();
	try {
		d.stroke(walkway, '30/35', '35/37');
		d.stroke(walkway, '75/38');
		d.stroke(walkway, '30/35', '35/37');
		d.finish();
		d.finish();
		const warning = d.session.failure;
		expect(warning?.reason).toBe('short-span');
		expect(warning?.marks).toHaveLength(1);
		const built = d.world();
		d.finish();
		expect(d.world()).toBe(built);
		expect(d.session.failure).toBe(warning);
		expect(d.events.map(({ kind }) => kind)).toEqual(['line']);

		d.session.dismissRejection();
		expect(d.session.failure).toBeUndefined();
		d.stroke(walkway, '75/38');
		d.finish();
		expect(d.session.failure?.reason).toBe('short-span');
		d.stroke(house, '80/44');
		d.finish();
		expect(d.session.failure).toBeUndefined();
	} finally {
		d.dispose();
	}
});

test('Undo and Redo directly after a second release replay behind both placements', () => {
	const d = gestureDriver();
	try {
		d.stroke(house, '80/44');
		d.stroke(house, '81/44');
		d.session.undo();
		d.drain();
		expect(d.events.map(({ kind, cellIds }) => [kind, cellIds])).toEqual([
			['house', ['80/44']],
			['house', ['81/44']]
		]);
		const [first, second] = d.events;
		expect(d.world().state.storyParts).toEqual(first.after.state.storyParts);
		d.session.redo();
		expect(d.world().state.storyParts).toEqual(second.after.state.storyParts);
	} finally {
		d.dispose();
	}
});

test('New terrain and subsequent raw input target the new seed in order', () => {
	const d = gestureDriver();
	try {
		d.stroke(house, '80/44');
		d.session.restart();
		d.stroke(dig, '76/41');
		d.session.restart();
		d.drain();
		expect(d.events.map(({ kind, after }) => [kind, after.seed])).toEqual([
			['house', 7],
			['dig', 8]
		]);
		expect(d.world().seed).toBe(9);
		expect(d.world().state.edits).toEqual([]);
		expect(d.session.canUndo).toBe(false);
	} finally {
		d.dispose();
	}
});

test('completion listeners receive Dig and its store credit before a reentrant Advance', () => {
	const d = gestureDriver();
	try {
		const records: Completion[][] = [[], [], []];
		d.session.onCompletion((event) => records[0].push(event));
		d.session.onCompletion((event) => {
			records[1].push(event);
			if (event.kind === 'dig') d.session.advance();
		});
		d.session.onCompletion((event) => records[2].push(event));
		const year = d.world().state.year;
		d.stroke(dig, '76/41');
		d.drain();
		for (const record of records) {
			expect(record.map(({ kind }) => kind)).toEqual(['dig', 'advance']);
			expect(record[0]).toBe(d.events[0]);
			expect(record[1]).toBe(d.events[1]);
			expect(record[0].after).toBe(record[1].before);
		}
		const digEvent = records[0][0];
		const { before, after } = digEvent;
		const credit =
			Object.values(after.state.store).reduce((sum, count) => sum + count, 0) -
			Object.values(before.state.store).reduce((sum, count) => sum + count, 0);
		const centers = storedModules(digEvent);
		expect(credit).toBeGreaterThan(0);
		expect(centers).toHaveLength(credit);
		expect(centers.map((center) => [...center])).toEqual(
			[...before.state.storyParts].flatMap(([id, stories]) => {
				const cell = before.grid.cellsById.get(id);
				if (!cell) throw new Error(`Missing story cell ${id}`);
				return stories
					.slice(after.state.storyParts.get(id)?.length ?? 0)
					.map(({ anchor }) => [
						cell.center[0],
						cell.center[1],
						cell.pad + (anchor.level + 0.5) * STORY
					]);
			})
		);
		expect(d.world().state.year).toBe(year + sandboxGenerationYears);
	} finally {
		d.dispose();
	}
});
