import { expect, spyOn, test } from 'bun:test';
import * as sandbox from '../logic/sandbox';
import * as terrainGrid from '../logic/terrain-grid';
import type { Tool } from '../logic/sandbox';
import { gestureDriver } from './fixtures/serial-gesture.fixture.test';
import { stateDigest } from './fixtures/state-digest';
import { activateChoice, createHudCommands } from './hud-commands';

const house = { kind: 'house', use: 'living' } as const;
const material = { kind: 'house', use: 'material' } as const;
const dig = { kind: 'dig' } as const;
const erase = { kind: 'erase' } as const;
const walkway = { kind: 'line', transit: 'walkway' } as const;
const viaduct = { kind: 'line', transit: 'viaduct' } as const;
const roof: NonNullable<sandbox.World['roofBuilder']> = {
	build() {
		throw new Error('Roof geometry belongs to the scene fixtures');
	},
	reportFailure() {}
};

test('pending input acknowledges touch immediately and replays the entire buffered bend', () => {
	const d = gestureDriver(() => 500);
	try {
		d.stroke(house, '80/44');
		d.stroke(dig, '87/35', '90/35', '90/38');
		expect(d.rings).toEqual([
			{ x: 80, y: 44 },
			{ x: 87, y: 35 }
		]);
		expect(d.session.gesture).toBeUndefined();
		expect(d.events).toEqual([]);
		d.tick(499);
		expect(d.world().state.edits).toEqual([]);
		d.tick(1);
		expect(d.events.map(({ kind }) => kind)).toEqual(['house']);
		expect(d.waiting()?.cellIds).toContain('90/35');
		d.tick(500);
		expect(d.events.map(({ kind }) => kind)).toEqual(['house', 'dig']);
		expect(d.events[1].cellIds).toHaveLength(7);
		expect(d.world().state.edits).toHaveLength(7);
	} finally {
		d.dispose();
	}
});

test('a held tool, year and displayed roof stay current until the stroke commits', () => {
	const d = gestureDriver();
	try {
		d.session.tool = house;
		d.down('80/44');
		d.session.tool = dig;
		d.session.advance();
		d.session.setRoofBuilder(roof);
		expect<string>(d.session.tool.kind).toBe('house');
		expect(d.world().state.year).toBe(2026);
		expect(d.world().roofBuilder).toBeUndefined();
		d.up('80/44');
		d.finish();
		expect(d.events.map(({ kind }) => kind)).toEqual(['house', 'advance']);
		expect(d.world().state.storyParts.get('80/44')?.at(-1)?.built).toBe(2026);
		expect(d.world().state.year).toBe(2051);
		expect(d.session.tool.kind).toBe('dig');
		expect(d.world().roofBuilder).toBe(roof);
	} finally {
		d.dispose();
	}
});

test('kernel readiness cannot retarget a stationary Erase during its gesture', () => {
	const d = gestureDriver(
		() => 16,
		(world) => world.grid.cellsById.get(world.roofBuilder ? '81/38' : '81/39')?.index
	);
	try {
		d.session.tool = erase;
		d.down('321/485');
		d.session.setRoofBuilder(roof);
		d.up('321/485');
		d.finish();
		expect(d.events[0].cellIds).toEqual(['81/39']);
		const { before, after } = d.events[0];
		const picked = before.state.stacks.get('81/39');
		expect(picked?.length).toBeGreaterThan(0);
		expect(after.state.stacks.get('81/39') ?? []).toEqual(picked?.slice(0, -1) ?? []);
		expect(after.state.stacks.get('81/38')).toBe(before.state.stacks.get('81/38'));
		d.pointer('pointermove', '321/485', 'mouse');
		expect(d.hovered()).toBe('81/38');
	} finally {
		d.dispose();
	}
});

test('held zoom cancels the stroke and a redraw repicks the stationary pointer', () => {
	let city = false;
	const d = gestureDriver(
		() => 16,
		(world) => world.grid.cellsById.get(city ? '80/44' : '81/44')?.index
	);
	try {
		d.pointer('pointerdown', '600/400', 'mouse');
		expect(d.hovered()).toBe('81/44');
		d.canvas.dispatchEvent(
			Object.assign(new Event('wheel', { cancelable: true }), {
				clientX: 600,
				clientY: 400,
				deltaY: 800
			})
		);
		expect(d.session.gesture).toBeUndefined();
		city = true;
		expect(d.hovered()).toBe('81/44');
		d.draw();
		expect(d.hovered()).toBe('80/44');
		d.pointer('pointerup', '600/400', 'mouse');
		expect(d.waiting()).toBeUndefined();
		d.stroke(house, '600/400');
		d.finish();
		expect(d.events.map(({ cellIds }) => cellIds)).toEqual([['80/44']]);
	} finally {
		d.dispose();
	}
});

test('buffered picks run on the new city, including its updated stock and year', () => {
	const d = gestureDriver();
	try {
		d.stroke(material, '80/44');
		d.finish();
		d.stroke(erase, '80/44');
		d.session.advance();
		d.stroke(walkway, '30/35', '35/37');
		d.drain();
		expect(d.events.map(({ kind }) => kind)).toEqual(['house', 'erase', 'advance', 'line']);
		const parts = [...d.world().state.parts.values()];
		expect(parts).toHaveLength(29);
		expect(parts.every(({ built }) => built === 2051)).toBe(true);
		expect(parts.reduce((sum, part) => sum + (part.materials.material ?? 0), 0)).toBe(1);
	} finally {
		d.dispose();
	}
});

test('two digs, a multi-basin erase and Q each survey once from touchdown to disposal', () => {
	const d = gestureDriver();
	const planner = spyOn(sandbox, 'planStroke');
	const grid = spyOn(terrainGrid, 'regrid');
	try {
		d.stroke(dig, '22/35');
		d.stroke(dig, '76/41');
		expect(planner).toHaveBeenCalledTimes(0);
		expect(grid).toHaveBeenCalledTimes(0);
		d.finish();
		expect(planner).toHaveBeenCalledTimes(1);
		expect(grid).toHaveBeenCalledTimes(1);
		d.finish();
		expect(planner).toHaveBeenCalledTimes(2);
		expect(grid).toHaveBeenCalledTimes(2);
		d.stroke(dig, '30/35');
		d.stroke(dig, '39/35');
		d.drain();
		expect(d.world().state.edits).toHaveLength(4);
		d.stroke(erase, '30/35', '39/35');
		d.finish();
		expect(planner).toHaveBeenCalledTimes(5);
		expect(grid).toHaveBeenCalledTimes(5);
		expect(d.world().state.edits).toHaveLength(2);
		d.stroke(walkway, '30/35', '35/37');
		d.finish();
		expect(planner).toHaveBeenCalledTimes(6);
		expect(grid).toHaveBeenCalledTimes(5);
	} finally {
		grid.mockRestore();
		planner.mockRestore();
		d.dispose();
	}
});

type HudInput =
	| { kind: 'hud-tool'; id: 'house' | 'dig' }
	| { kind: 'hud-use'; id: 'living' | 'water' }
	| { kind: 'hud-method'; id: 'composed' | 'totem' }
	| { kind: 'plan' };

const click = () => new Event('click', { cancelable: true }) as MouseEvent;

for (const delay of [0, 500]) {
	for (const last of ['hud', 'keyboard'] as const) {
		test(`tool choice survives keyboard/HUD order with ${delay} ms delay and ${last} last`, () => {
			const d = gestureDriver(() => delay);
			const hud = createHudCommands(d.session);
			try {
				d.stroke(house, '80/44');
				const selectHouse = () => activateChoice(() => hud.pickTool('house')).onclick(click());
				if (last === 'hud') {
					hud.pickTool('dig');
					selectHouse();
				} else {
					selectHouse();
					hud.pickTool('dig');
				}
				expect(d.session.requestedChoice).toBe(
					delay ? (last === 'hud' ? 'House' : 'Dig') : undefined
				);
				d.down('81/44');
				d.up('81/44');
				d.drain();
				const expected = last === 'hud' ? 'house' : 'dig';
				expect(d.events.map(({ kind }) => kind)).toEqual(['house', expected]);
				expect(d.session.tool.kind).toBe(expected);
				expect(d.session.requestedChoice).toBeUndefined();
				expect(d.world().state.stacks.has('81/44')).toBe(expected === 'house');
				expect(d.world().state.edits).toHaveLength(expected === 'dig' ? 1 : 0);
			} finally {
				d.dispose();
			}
		});
	}
}

type RawInput =
	| HudInput
	| { kind: 'tap'; cell: string }
	| { kind: 'stroke'; tool: Tool; cells: readonly [string, ...string[]] }
	| { kind: 'advance' | 'undo' | 'redo' | 'restart' | 'kernel' };

const samples: RawInput[] = [
	{ kind: 'stroke', tool: house, cells: ['80/44', '81/44'] },
	{ kind: 'stroke', tool: material, cells: ['82/44'] },
	{ kind: 'stroke', tool: erase, cells: ['80/44', '82/44'] },
	{ kind: 'stroke', tool: dig, cells: ['76/41'] },
	{ kind: 'stroke', tool: dig, cells: ['90/35'] },
	{ kind: 'stroke', tool: walkway, cells: ['30/35', '35/37'] },
	{ kind: 'stroke', tool: viaduct, cells: ['87/35', '96/35'] },
	{ kind: 'undo' },
	{ kind: 'redo' },
	{ kind: 'advance' },
	{ kind: 'hud-tool', id: 'dig' },
	{ kind: 'hud-tool', id: 'house' },
	{ kind: 'hud-use', id: 'water' },
	{ kind: 'hud-use', id: 'living' },
	{ kind: 'hud-method', id: 'totem' },
	{ kind: 'hud-method', id: 'composed' },
	{ kind: 'plan' },
	{ kind: 'tap', cell: '81/44' },
	{ kind: 'kernel' }
];

function play(inputs: RawInput[], delays: number[], checkProgress: (step: string) => void) {
	const events: unknown[] = [];
	const d = gestureDriver(
		(stroke) => delays[stroke % delays.length],
		(world, x, y, plan) => world.grid.cellsById.get(`${x + Number(plan)}/${y}`)?.index,
		{
			checkProgress,
			record: ({ kind, before, after, cellIds }) => {
				events.push([
					kind,
					before.seed,
					after.seed,
					stateDigest(before.state),
					stateDigest(after.state),
					[...cellIds]
				]);
			}
		}
	);
	const hud = createHudCommands(d.session);
	const snapshot = () => stateDigest(d.world().state);
	const walk = (direction: 'undo' | 'redo') => {
		const observed: string[] = [];
		const available = () => (direction === 'undo' ? d.session.canUndo : d.session.canRedo);
		while (available()) {
			checkProgress(direction);
			if (observed.length >= inputs.length) throw new Error(`Too many ${direction} steps`);
			const before = d.world().state;
			d.session[direction]();
			if (d.world().state === before) throw new Error(`${direction} made no progress`);
			observed.push(snapshot());
		}
		return observed;
	};
	try {
		for (const [index, input] of inputs.entries()) {
			checkProgress(`input ${index} (${input.kind})`);
			replayInput(input, d, hud);
			d.tick(8);
			if (d.session.failure?.reason === 'stroke-failed')
				throw new Error(`Unexpected stroke exception after input ${index}`);
		}
		d.drain();
		if (d.waiting() || d.session.hasPendingStroke || d.session.gesture)
			throw new Error('Input still active after draining the sequence');
		const { reason, marks } = d.session.failure ?? {};
		const final = {
			state: snapshot(),
			seed: d.world().seed,
			reason,
			marks,
			tool: d.session.tool,
			plan: d.session.plan
		};
		const future = walk('redo');
		const past = walk('undo');
		return { final, future, past, events };
	} finally {
		d.dispose();
	}
}

function replayInput(
	input: RawInput,
	d: ReturnType<typeof gestureDriver>,
	hud: ReturnType<typeof createHudCommands>
) {
	switch (input.kind) {
		case 'stroke':
			d.stroke(input.tool, ...input.cells);
			break;
		case 'kernel':
			d.session.setRoofBuilder(roof);
			break;
		case 'hud-tool':
			activateChoice(() => hud.pickTool(input.id)).onclick(click());
			break;
		case 'hud-use':
			activateChoice(() => hud.pickValue('house', input.id, input.id)).onclick(click());
			break;
		case 'hud-method':
			activateChoice(() => hud.pickMethod(input.id)).onclick(click());
			break;
		case 'tap':
			d.down(input.cell);
			d.up(input.cell);
			break;
		case 'plan':
			d.session.togglePlan();
			break;
		default:
			d.session[input.kind]();
	}
}

test('random raw input matches zero-latency execution in city, history and event order', () => {
	const seeds = [103, 491, 2026, 3341].slice(0, 200);
	for (const seed of seeds) {
		console.info(`Serial input seed ${seed}`);
		const deadline = performance.now() + 30000;
		let steps = 0;
		const checkProgress = (step: string) => {
			if (++steps > 512 || performance.now() > deadline)
				throw new Error(`Serial input seed ${seed} exceeded its budget at ${step}`);
		};
		let state = seed;
		const pick = (n: number) => {
			state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
			return Math.floor((state / 0x100000000) * n);
		};
		const choices = [0, 16, 32, 500];
		const inputs = Array.from({ length: 26 }, () => samples[pick(samples.length)]);
		inputs.splice(12, 0, { kind: 'restart' });
		inputs.splice(1, 0, { kind: 'kernel' });
		inputs.push(
			{ kind: 'hud-tool', id: 'dig' },
			{ kind: 'hud-tool', id: 'house' },
			{ kind: 'hud-use', id: 'water' },
			{ kind: 'hud-method', id: 'composed' },
			{ kind: 'plan' },
			{ kind: 'tap', cell: '81/44' }
		);
		const timings = choices.map((_, i) => choices[(i + pick(4)) % 4]);
		timings.push(0, 16, 32, 500);
		expect(play(inputs, timings, checkProgress)).toEqual(play(inputs, [0], checkProgress));
		checkProgress('compare');
	}
}, 125000);
