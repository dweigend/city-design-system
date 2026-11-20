import { describe, expect, test } from 'bun:test';
import { designPrinciples, principlesFor, type PrinciplePage } from './design-principles';

const PREFIX: Record<PrinciplePage, string> = {
	city: 'CITY',
	forms: 'FORM',
	grid: 'GRID',
	growth: 'GROW',
	color: 'COLOR',
	material: 'MAT',
	interface: 'UI',
	library: 'LIB'
};
const PAGES = Object.keys(PREFIX) as PrinciplePage[];

describe('Design principles register', () => {
	test('ids are unique and carry the prefix of their page', () => {
		const ids = designPrinciples.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const p of designPrinciples) expect(p.id).toMatch(new RegExp(`^${PREFIX[p.page]}-\\d+$`));
	});

	test('every page owns principles and together they are the whole register', () => {
		const perPage = PAGES.map((page) => principlesFor(page));
		for (const principles of perPage) expect(principles.length).toBeGreaterThan(0);
		expect(perPage.flat()).toEqual([...designPrinciples]);
	});

	test('a rule is one sentence with a name, a reason and a decision day', () => {
		for (const p of designPrinciples) {
			expect(p.title.length).toBeGreaterThan(0);
			expect(p.rule).toMatch(/^[A-Z0-9].*\.$/);
			// One sentence: no sentence end followed by more text ("three.js" is fine).
			expect(p.rule).not.toMatch(/[.!?]\s/);
			expect(p.reason.length).toBeGreaterThan(0);
			expect(Number.isNaN(Date.parse(p.decided))).toBe(false);
			expect(p.decided).toMatch(/^2026-\d{2}-\d{2}$/);
		}
	});

	test('no principle states a color value; values belong to the palette', () => {
		for (const p of designPrinciples)
			expect(`${p.rule} ${p.reason}`).not.toMatch(/#[0-9a-f]{3,8}\b|oklch\(|rgb\(/i);
	});

	test('a demo anchor is a plain fragment id', () => {
		for (const p of designPrinciples)
			if (p.demo?.anchor !== undefined) expect(p.demo.anchor).toMatch(/^[a-z][a-z0-9-]*$/);
	});
});
