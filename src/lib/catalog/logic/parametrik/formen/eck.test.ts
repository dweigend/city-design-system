// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import type { Slot } from '../eck';
import type { Primitive } from '../types';
import { canonical, eckModul, maskClasses, rotateMask } from './eck';
import { caseSlot, maskCases, patchSlots, patches, slotShapes } from './eckvorschau';

const finite = (p: Primitive) => !JSON.stringify(p).includes('null');
const contexts: Partial<Slot['context']>[] = [
	{},
	{ openAbove: false },
	{ ground: false },
	{ span: true },
	{ courtyard: true },
	{ role: 'bestand' },
	{ neighborFilled: [true, true, true, true] },
	{ centered: true },
	{ centered: true, deck: 0x5a, stilts: [{ corner: 1, from: 0 }] },
	{
		centered: true,
		tokens: ['--cat-health', null, '--cat-nature', null, null, '--cat-health', null, null]
	}
];

describe('Masks', () => {
	test('70 classes under four rotations', () => expect(maskClasses().length).toBe(70));
	test('canonical rotation is consistent', () => {
		for (let m = 0; m < 256; m++) {
			const { mask, turn } = canonical(m);
			expect(rotateMask(m, turn)).toBe(mask);
			for (let r = 0; r < 4; r++) expect(canonical(rotateMask(m, r)).mask).toBe(mask);
		}
	});
});

describe('eckModul', () => {
	test('mask 0 never yields geometry, occupancy never empty', () => {
		for (const shape of slotShapes)
			for (const ctx of contexts)
				for (let m = 0; m < 256; m++) {
					const base = caseSlot({ key: 'x', mask: m, title: '', context: ctx }, shape.value);
					const out = eckModul(base);
					if (m === 0) expect(out.length).toBe(0);
					else {
						expect(out.some((p) => p.kind !== 'polyline')).toBe(true);
						expect(out.every(finite)).toBe(true);
					}
				}
	});
	test('deterministic and existing stock gray', () => {
		for (const c of maskCases) {
			const slot = caseSlot(c, 'schief');
			expect(eckModul(slot)).toEqual(eckModul(slot));
		}
		const grey = eckModul(
			caseSlot({ key: 'b', mask: 0xff, title: '', context: { role: 'bestand' } }, 'schief')
		);
		expect(grey.every((p) => p.role === 'bestand' && p.token === '--paper')).toBe(true);
	});
	test('rotating the mask rotates only the position, not the part count', () => {
		for (let m = 1; m < 256; m++) {
			const counts = [0, 1, 2, 3].map(
				(r) => eckModul(caseSlot({ key: 'r', mask: rotateMask(m, r), title: '' }, 'quadrat')).length
			);
			expect(new Set(counts).size).toBe(1);
		}
	});
	test('inner seam disappears when the neighbor is occupied', () => {
		const open = eckModul(caseSlot({ key: 'n', mask: 0xff, title: '' }, 'quadrat'));
		const closed = eckModul(
			caseSlot(
				{ key: 'n', mask: 0xff, title: '', context: { neighborFilled: [true, true, true, true] } },
				'quadrat'
			)
		);
		expect(closed.filter((p) => p.kind === 'polyline').length).toBe(0);
		expect(open.filter((p) => p.kind === 'polyline').length).toBeGreaterThan(0);
	});
	test('bridge: deck and beam, no columns; courtyard: garden', () => {
		const bridge = eckModul(
			caseSlot({ key: 'b', mask: 0x30, title: '', context: { span: true } }, 'schief')
		);
		expect(bridge.some((p) => p.kind === 'frame')).toBe(true);
		expect(bridge.some((p) => p.kind === 'cylinder')).toBe(false);
		const stilts = eckModul(caseSlot({ key: 's', mask: 0xf0, title: '' }, 'schief'));
		expect(stilts.filter((p) => p.kind === 'cylinder').length).toBe(4);
		const court = eckModul(
			caseSlot({ key: 'h', mask: 0x0e, title: '', context: { courtyard: true } }, 'quadrat')
		);
		expect(court.some((p) => p.token === '--cat-nature')).toBe(true);
	});
	test('clusters: mixed slots separate existing stock and intervention', () => {
		for (const p of patches) {
			const out = patchSlots(p).flatMap(eckModul);
			expect(out.every(finite)).toBe(true);
		}
		const hochweg = patchSlots(patches.find((p) => p.key === 'hochweg')!).flatMap(eckModul);
		expect(hochweg.some((p) => p.role === 'bestand' && p.kind === 'prism')).toBe(true);
		expect(hochweg.some((p) => p.kind === 'frame' && p.role === 'neu')).toBe(true);
	});
});

describe('Round 1: story-centered slots', () => {
	const centered = (mask: number, ctx: Partial<Slot['context']> = {}) =>
		eckModul(
			caseSlot({ key: 'c', mask, title: '', context: { centered: true, ...ctx } }, 'quadrat')
		);
	test('joints only on zMid, never on zLow or zHigh', () => {
		for (let m = 1; m < 256; m++) {
			const flat = centered(m).flatMap((p) =>
				p.kind === 'polyline' && p.points[0][2] === p.points[1][2] ? [p.points[0][2]] : []
			);
			expect(flat.every((z) => Math.abs(z) > 1e-6 && Math.abs(z - 8) > 1e-6)).toBe(true);
		}
		const horizontal = centered(0xff).filter(
			(p) => p.kind === 'polyline' && p.points[0][2] === p.points[1][2]
		);
		expect(
			horizontal.every((p) => p.kind === 'polyline' && Math.abs(p.points[0][2] - 4) < 1e-6)
		).toBe(true);
	});
	test('no roof under another color, colors separated', () => {
		const tokens = [
			'--paper',
			'--paper',
			'--paper',
			'--paper',
			'--cat-business',
			'--cat-business',
			'--cat-business',
			'--cat-business'
		] as Slot['context']['tokens'];
		const out = centered(0xff, { tokens });
		expect(new Set(out.filter((p) => p.kind === 'prism').map((p) => p.token))).toEqual(
			new Set(['--paper', '--cat-business'])
		);
		// No attika: nothing rises above zMid inside the lower white part.
		expect(out.filter((p) => p.kind === 'prism' && p.token === '--paper').length).toBe(1);
	});
	test('columns explicit, deck with clear space below, ink without color', () => {
		const out = centered(0xf0, { stilts: [{ corner: 0, from: 0 }] });
		const c = out.filter((p) => p.kind === 'cylinder');
		expect(c.length).toBe(1);
		expect(c[0].kind === 'cylinder' && c[0].height).toBeCloseTo(4, 6);
		expect(centered(0x0f, { deck: 0x0f }).filter((p) => p.kind === 'prism').length).toBe(0);
		expect(
			centered(0xff)
				.filter((p) => p.kind === 'prism')
				.every((p) => p.token === '--paper' && p.role === 'neu')
		).toBe(true);
	});
});
