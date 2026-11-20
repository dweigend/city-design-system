import { forestChunk } from '../../logic/land-cover';
import { squareGrid } from '../../logic/quad-grid';
import { materialSheet } from '../../logic/material/contact-sheet';
import { expect, test } from 'bun:test';
import { assetRegistry, buildObject, type SlotAssignment } from '../../logic/assets';
import { resolveFinish } from '../../logic/material/surface';

const assignments: SlotAssignment[] = ['--signal', '--paper', '--cat-nature-2'].flatMap((token) =>
	(['holz-natur', 'glaze', 'corrugated-metal'] as const).map((finish) => ({
		token: token as SlotAssignment['token'],
		finish
	}))
);

function expectBareGeometry(part: { slot: string }) {
	for (const field of ['token', 'finish', 'material', 'topToken', 'overprint', 'printBand'])
		expect(part).not.toHaveProperty(field);
}

test('forest geometry reserves the foliage and stem slots for projection', () => {
	const grid = squareGrid(6, 6, 5, 6);
	const cover = new Map(grid.cells.map((c) => [c.id, 'forest' as const]));
	const parts = forestChunk(grid, cover, '0:0', 7);
	expect(new Set(parts.map((p) => p.slot))).toEqual(new Set(['stem', 'foliage']));
	for (const part of parts) {
		expect(part.slot).toBe(part.id.includes(':trunk') ? 'stem' : 'foliage');
		expectBareGeometry(part);
	}
});

test('every variant exposes deterministic bare geometry and independently replaceable slots', () => {
	for (const a of assetRegistry) {
		expect(a.slotNames.length).toBeGreaterThan(0);
		const used = new Set<string>();
		for (const v of a.variants) {
			checkVariant(a, v, used);
		}
		expect([...used].sort()).toEqual([...a.slotNames].sort());
	}
}, 120000);

function checkVariant(a: (typeof assetRegistry)[number], v: string, used: Set<string>) {
	const base = buildObject(a.id, v, 17);
	expect(base.defaults).toEqual(a.slotDefaults[v]);
	expect(base).toEqual(buildObject(a.id, v, 17));
	expect(buildObject(a.id, v, 17, { slots: base.defaults }).parts).toEqual(base.parts);
	for (const part of base.geometry) {
		used.add(part.slot);
		expect(base.defaults[part.slot]).toBeDefined();
		expectBareGeometry(part);
	}
	checkAssignments(a, v, base);
}

function checkAssignments(
	a: (typeof assetRegistry)[number],
	v: string,
	base: ReturnType<typeof buildObject>
) {
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

test('the three porthole samples keep the same geometry and assign different surfaces', () => {
	const samples = materialSheet('--paper').find((row) => row.id === 'slot-assignments')?.samples;
	if (!samples) throw new Error('Missing porthole material comparison');
	expect(samples).toHaveLength(3);
	const parts = samples.map((sample) => sample.parts());
	const shapes = parts.map((group) =>
		JSON.stringify(group, (key, value: unknown) =>
			['token', 'material', 'finish'].includes(key) ? undefined : value
		)
	);
	expect(shapes[1]).toEqual(shapes[0]);
	expect(shapes[2]).toEqual(shapes[0]);
	const surfaces = parts.map((group) =>
		JSON.stringify(group.map((part) => [part.token, part.finish]))
	);
	expect(new Set(surfaces).size).toBe(3);
});
