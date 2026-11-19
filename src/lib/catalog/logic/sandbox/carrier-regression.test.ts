// @ts-expect-error Bun supplies the test API.
import { expect, test } from 'bun:test';
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
const stroke = (style: 'megastructure' | 'totem', world: typeof town, cells = ['87/47', '83/47']) =>
	cells.reduce(extendStroke, beginStroke({ kind: 'house', use: 'water', style }, world)).draft;
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
		p.kind === 'pipe' ? [{ a: joint(p.points[0]), b: joint(p.points[1]), radius: p.radius }] : []
	);
	expect(rods.length).toBeGreaterThan(7);
	expect(probeFrame([...nodes.values()], bearings, rods).analysis.status).toBe('ok');
	const postFeet = new Set(
		rods.filter((r) => r.a.p[0] === r.b.p[0] && r.a.p[1] === r.b.p[1]).map((r) => r.a.id)
	);
	const lateralFeet = new Set(bearings.filter((n) => !postFeet.has(n.id)).map((n) => n.id));
	const unbraced = rods.filter((r) => !lateralFeet.has(r.a.id) && !lateralFeet.has(r.b.id));
	expect(unbraced).toHaveLength(7);
	expect(
		probeFrame(
			[...nodes.values()].filter((n) => !lateralFeet.has(n.id)),
			bearings.filter((n) => postFeet.has(n.id)),
			unbraced
		).analysis.status
	).toBe('mechanismus');
});
test('basin at 80/48 retires the tilted chord with its three capsules and refunds the owner', () => {
	const cells = ['83/47', '88/45'];
	const built = stroke('totem', stroke('megastructure', town, cells), cells);
	expect([...built.state.parts.values()].filter((p) => p.kind === 'module')).toHaveLength(3);
	const credit = [...built.state.parts.values()].reduce((sum, p) => sum + p.materials.material, 0);
	const dug = applyEdit(built, { kind: 'dig', cellId: '80/48' });
	expect(dug.state.parts.size).toBe(0);
	expect(dug.state.compositions.size).toBe(0);
	const reference = applyEdit(town, { kind: 'dig', cellId: '80/48' });
	expect(dug.state.store.material).toBe(reference.state.store.material);
	expect(built.state.store.material + credit).toBe(town.state.store.material);
});
test('a socket interpolates height along the full rod axis', () => {
	const a: Vec3 = [0, 0, 1],
		b: Vec3 = [12, 0, 2];
	const seat = atSocket({ a, b, radius: 0.09 }, 0.5, 'capsule', []);
	const moved = atSocket({ a, b, radius: 0.09 }, 0.75, 'capsule', []);
	expect(moved!.shell.center[2] - seat!.shell.center[2]).toBeCloseTo(0.25, 10);
});

test('an unstable wall layout cannot consume stock or reserve a roof', () => {
	const attempt = extendStroke(
		beginStroke({ kind: 'house', style: 'megastructure', use: 'material' }, town),
		'87/45'
	);
	expect(attempt.failure?.reason).toBe('unstable-frame');
	expect(attempt.draft).toBe(town);
});
