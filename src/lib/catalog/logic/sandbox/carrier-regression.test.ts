import { savedCarrier } from './fixtures/saved-carrier.fixture.test';
import { expect, test } from 'bun:test';
import { position } from './installation-parts';
import { atSocket } from '../house-brush';
import { probeFrame } from '../megastructure';
import type { Vec3 } from '../parametrik/types';
import {
	applyEdit,
	beginStroke,
	createWorld,
	extendStroke,
	installationView,
	withState
} from './index';

const seed = createWorld(7);
const town = withState(seed, { ...seed.state, store: { ...seed.state.store, material: 100 } });
const stroke = (
	style: 'megastructure' | 'totem',
	world: typeof town,
	cells = ['83/47', '87/47']
) =>
	style === 'megastructure'
		? savedCarrier(world, cells[0], 'water')
		: cells.reduce(extendStroke, beginStroke({ kind: 'house', use: 'water', style }, world)).draft;
const carrier = stroke('megastructure', town);

test('projected rods and wall bearings pass the K2 load case with their installed sections', () => {
	const forms = installationView(carrier, 'all');
	const nodes = new Map<string, { id: string; p: Vec3 }>();
	const joint = (p: Vec3) => {
		const n = { id: p.join('/'), p };
		nodes.set(n.id, n);
		return n;
	};
	const bearings = forms.flatMap((p) => (p.kind === 'sphere' ? [joint(p.position)] : []));
	const rods = forms.flatMap((p) =>
		p.kind === 'pipe'
			? [{ id: p.id, a: joint(p.points[0]), b: joint(p.points[1]), radius: p.radius }]
			: []
	);
	const brace = [...carrier.state.parts.values()].find(
		(p) =>
			p.recipe === 'brace' &&
			p.anchor.cellId === '87/47' &&
			p.anchor.face === 2 &&
			p.end.cellId === '86/47'
	);
	expect(brace).toBeDefined();
	const length = ({ a, b }: (typeof rods)[number]) =>
		Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
	const replacement = rods.find((rod) => rod.id === brace?.id);
	if (!replacement) throw new Error('Missing replacement diagonal');
	expect(length(replacement)).toBeCloseTo(10.637, 3);
	expect(Math.max(...rods.map(length))).toBeCloseTo(13.631, 3);
	expect(probeFrame([...nodes.values()], bearings, rods).analysis.status).toBe('ok');
	const postFeet = new Set(
		rods.filter((r) => r.a.p[0] === r.b.p[0] && r.a.p[1] === r.b.p[1]).map((r) => r.a.id)
	);
	const lateralFeet = new Set(bearings.filter((n) => !postFeet.has(n.id)).map((n) => n.id));
	const unbraced = rods.filter((r) => !lateralFeet.has(r.a.id) && !lateralFeet.has(r.b.id));
	expect(unbraced).toHaveLength(6);
	expect(
		probeFrame(
			[...nodes.values()].filter((n) => !lateralFeet.has(n.id)),
			bearings.filter((n) => postFeet.has(n.id)),
			unbraced
		).analysis.status
	).toBe('mechanismus');
});
test('basin at 80/48 retires the tilted chord with its three capsules and refunds the owner', () => {
	const cells = ['82/46', '87/44'];
	const built = stroke('totem', stroke('megastructure', town, cells), cells);
	expect([...built.state.parts.values()].filter((p) => p.kind === 'module')).toHaveLength(3);
	const credit = [...built.state.parts.values()].reduce((sum, p) => sum + p.materials.material, 0);
	const dug = applyEdit(built, { kind: 'dig', cellId: '80/48' });
	const parts = [...built.state.parts.values()];
	for (const part of parts) {
		const seats = part.kind === 'segment' ? [part.anchor, part.end] : [part.anchor];
		for (const seat of seats) expect(dug.grid.cellsById.get(seat.cellId)?.buildable).toBe(true);
	}
	expect(
		parts.some(
			(part) =>
				part.recipe === 'chord' &&
				part.anchor.cellId !== part.end.cellId &&
				Math.abs(position(dug.grid, part.anchor)[2] - position(dug.grid, part.end)[2]) > 1e-8
		)
	).toBe(true);
	expect(dug.state.parts.size).toBe(0);
	expect(dug.state.compositions.size).toBe(0);
	const reference = applyEdit(town, { kind: 'dig', cellId: '80/48' });
	expect(reference.state.store.living).toBeGreaterThan(town.state.store.living);
	expect(dug.state.store).toEqual(reference.state.store);
	expect(built.state.store.material + credit).toBe(town.state.store.material);
});
test('a socket interpolates height along the full rod axis', () => {
	const a: Vec3 = [0, 0, 1],
		b: Vec3 = [12, 0, 2];
	const seat = atSocket({ a, b, radius: 0.09 }, 0.5, 'capsule', []);
	const moved = atSocket({ a, b, radius: 0.09 }, 0.75, 'capsule', []);
	if (!seat || !moved) throw new Error('Missing capsule socket on the tilted rod');
	expect(moved.shell.center[2] - seat.shell.center[2]).toBeCloseTo(0.25, 10);
});

test('an unstable wall layout cannot consume stock or reserve a roof', () => {
	const attempt = extendStroke(
		beginStroke({ kind: 'house', style: 'megastructure', use: 'material' }, town),
		'89/44'
	);
	expect(attempt.draft.state.frameTimeline?.goals.length).toBe(1);
	expect(attempt.draft.state.parts).toBe(town.state.parts);
	expect(attempt.draft.state.store).toBe(town.state.store);
});

test('a distant basin preserves the loaded carrier on the landlocked roof at 87/50', () => {
	const roof = '87/50';
	const stacks = new Map(town.state.stacks).set(roof, ['living', 'living', 'living']);
	const stock = withState(town, { ...town.state, stacks });
	const saved = stroke('megastructure', stock, [roof]).state;
	const loaded = withState(town, saved);
	expect(loaded.grid.cellsById.get(roof)?.parcelAccess).toBe('landlocked');
	expect(loaded.state.parts.size).toBe(9);
	const dug = applyEdit(loaded, { kind: 'dig', cellId: '120/68' });
	expect(dug.grid.cellsById.get(roof)).toBe(loaded.grid.cellsById.get(roof));
	expect(dug.state.parts).toBe(loaded.state.parts);
	expect(dug.state.compositions).toBe(loaded.state.compositions);
	expect(dug.state.store.material).toBe(loaded.state.store.material);
});
