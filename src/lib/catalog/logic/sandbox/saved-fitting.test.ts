import { savedCarrier } from './fixtures/saved-carrier.fixture.test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createWorld, beginStroke, extendStroke, withState, installationView } from './index';

// Serialized module records and SHA-256 of all projected primitives, in their original order.
// 257735d supplied tank, ring and tray. Ceramic first appears on the Q2 branch (4795c7c).
const tankSeats = [
	['p/1/4', 0.32],
	['p/1/4', 0.68],
	['p/1/4', 0.5]
] as const;
const ceramicSeats = [
	['p/1/8', 0.5],
	['p/1/8', 0.2],
	['p/1/4', 0.68]
] as const;
const fixtures = [
	[
		'tank',
		'water',
		'83/47',
		'87/47',
		tankSeats,
		'b1c19bb4321ccbbe6c4bc512370b51b7e8adc25156d9a60486fef3ecea073f0e'
	],
	[
		'solar-ring',
		'energy',
		'83/47',
		'87/47',
		tankSeats,
		'a889cfa7d8315782f01d89f4d0de26803454880c6ddb71a548e99469a5257a97'
	],
	[
		'garden',
		'food',
		'83/47',
		'87/47',
		tankSeats,
		'69bf7ca3045b0a167c062da9d890a43fa820791a873e9f8f013a322e1d8b4b18'
	],
	[
		'ceramic',
		'water',
		'90/40',
		'94/40',
		ceramicSeats,
		'f8f323b83f597c5caf6b57ddf0c0eeb43e63b6b96c51a4452b4808409a183d78'
	]
] as const;

for (const [recipe, flow, from, to, seats, hash] of fixtures)
	test('restore original ' + recipe + ' geometry', () => {
		const world = createWorld(7);
		const frame = savedCarrier(world, from);
		const parts = new Map(frame.state.parts);
		for (const [index, [attachedTo, share]] of seats.entries()) {
			const rod = parts.get(attachedTo);
			assert(rod);
			const id = `p/2/${index}` as const;
			parts.set(id, {
				kind: 'module',
				id,
				owner: 'c/1',
				built: 2026,
				flow,
				recipe: index === 2 ? recipe : 'capsule',
				pitch: 1.5,
				share,
				attachedTo,
				anchor: rod.anchor,
				materials: { material: 1 }
			});
		}
		const restored = withState(world, { ...frame.state, parts });
		// Z marks bearing dots as hidden in city view. The original hashes predate this display flag.
		const primitives = installationView(restored, 'all').map((part) => {
			if (part.kind !== 'pipe' || part.role !== 'traeger' || !part.id.startsWith('p/1/'))
				return part;
			assert.equal(part.token, '--ink-3');
			assert.equal(part.shade, undefined);
			// The historical drawing used shaded paper for carrier rods.
			return { ...part, token: '--paper', shade: 1 };
		});
		const geometry = JSON.stringify(primitives, function (key, value) {
			if (key === 'cityForm' && value === false && this.id?.endsWith('/joint')) return undefined;
			return value;
		});
		assert.equal(createHash('sha256').update(geometry).digest('hex'), hash);
		const fresh = [from, to].reduce(
			extendStroke,
			beginStroke({ kind: 'house', style: 'totem', use: flow }, frame)
		).draft;
		const modules = [...fresh.state.parts.values()].filter((p) => p.kind === 'module');
		assert.equal(modules.length, 3);
		assert(modules.every((p) => p.fit === 'profile-v1'));
		const current = installationView(fresh, 'all');
		assert.deepEqual(
			installationView(withState(world, structuredClone(fresh.state)), 'all'),
			current
		);
		if (recipe === 'solar-ring' || recipe === 'garden')
			assert.notDeepEqual(current, installationView(restored, 'all'));
	});
