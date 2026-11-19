import { expect, test } from 'bun:test';
import { assetRegistry, buildObject, type SlotAssignment } from '../../logic/assets';
import { resolveFinish } from '../../logic/material/surface';

const assignments: SlotAssignment[] = ['--signal', '--paper', '--cat-nature-2'].flatMap((token) =>
	(['holz-natur', 'glaze', 'corrugated-metal'] as const).map((finish) => ({
		token: token as SlotAssignment['token'],
		finish
	}))
);

test('every variant exposes deterministic bare geometry and independently replaceable slots', () => {
	for (const a of assetRegistry) {
		expect(a.slotNames.length).toBeGreaterThan(0);
		const used = new Set<string>();
		for (const v of a.variants) {
			const base = buildObject(a.id, v, 17);
			expect(base).toEqual(buildObject(a.id, v, 17));
			for (const part of base.geometry) {
				used.add(part.slot);
				expect(base.defaults[part.slot]).toBeDefined();
				for (const field of ['token', 'finish', 'material', 'topToken', 'overprint', 'printBand'])
					expect(part).not.toHaveProperty(field);
			}
			for (const [i, assignment] of assignments.entries()) {
				const slots = Object.fromEntries(
					a.slotNames.map((slot, j) => [slot, assignments[(i + j) % assignments.length]])
				);
				const dressed = buildObject(a.id, v, 17, { slots });
				expect(dressed.geometry).toEqual(base.geometry);
				for (const [k, p] of dressed.parts.entries()) {
					const expected = slots[base.geometry[k].slot];
					expect([p.token, p.finish]).toEqual([expected.token, expected.finish]);
				}
				expect(resolveFinish(assignment.finish, assignment.token)).toBeDefined();
			}
		}
		expect([...used].sort()).toEqual([...a.slotNames].sort());
	}
}, 120000);
