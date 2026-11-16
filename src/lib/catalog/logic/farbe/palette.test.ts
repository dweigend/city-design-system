// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { contrast, deltaE, inGamut, oklchToLinear, type Oklch } from './oklch';
import { colorOf, parsePalette, STEPS, stepToken, type Mode } from './palette';
import { flowToken } from '../../data/focus';

const css: string = readFileSync(new URL('../../../../app.css', import.meta.url), 'utf8');
const p = parsePalette(css);
const MODES: Mode[] = ['light', 'dark'];
const rgb = (mode: Mode, token: string) => oklchToLinear(colorOf(p, mode, token));
const ratio = (mode: Mode, a: string, b: string) => contrast(rgb(mode, a), rgb(mode, b));
const FLOWS = Object.values(flowToken);
const FAMILIES = [...FLOWS, '--signal', '--cat-hazard'];

describe('Palette in app.css', () => {
	test('example: water has five steps, step 4 is the base tone', () => {
		expect(STEPS.map((s) => stepToken('--cat-health', s))).toEqual([
			'--cat-health-1',
			'--cat-health-2',
			'--cat-health-3',
			'--cat-health',
			'--cat-health-5'
		]);
		for (const s of [1, 2, 3, 5] as const)
			expect(p.ladder.some((x) => x.token === `--cat-health-${s}`)).toBe(true);
	});

	test('every flow color has five steps, signal and hazard at least light and dark', () => {
		for (const f of FLOWS)
			for (const s of STEPS) expect(() => colorOf(p, 'light', stepToken(f, s))).not.toThrow();
		for (const f of ['--signal', '--cat-hazard'])
			for (const s of [1, 4, 5] as const)
				expect(() => colorOf(p, 'light', stepToken(f, s))).not.toThrow();
	});

	test('steps are monotonic: 1 sits near paper, 5 near ink, in both modes', () => {
		for (const mode of MODES)
			for (const f of FLOWS) {
				const l = STEPS.map((s) => colorOf(p, mode, stepToken(f, s)).l);
				const dir = mode === 'light' ? -1 : 1;
				for (let i = 1; i < l.length; i++) expect((l[i] - l[i - 1]) * dir).toBeGreaterThan(0);
			}
	});

	test('all tones lie in the sRGB gamut, no clipping by the browser', () => {
		for (const mode of MODES) {
			for (const [token, c] of Object.entries(p.base[mode]))
				expect([token, inGamut(oklchToLinear(c))]).toEqual([token, true]);
			for (const { token } of p.ladder)
				expect([mode, token, inGamut(rgb(mode, token))]).toEqual([mode, token, true]);
		}
	});

	test('text contrast per WCAG 2.2 in both modes', () => {
		for (const mode of MODES) {
			expect(ratio(mode, '--ink', '--paper')).toBeGreaterThanOrEqual(7);
			for (const bg of ['--paper', '--paper-2', '--paper-3'])
				expect(ratio(mode, '--ink-2', bg)).toBeGreaterThanOrEqual(4.5);
			// Gray of the existing-stock line: graphics, at least 3:1 (1.4.11).
			expect(ratio(mode, '--ink-3', '--paper')).toBeGreaterThanOrEqual(3);
			// Core (step 5) is legible as text on paper.
			for (const f of FAMILIES)
				expect([mode, f, ratio(mode, `${f}-5`, '--paper') >= 4.5]).toEqual([mode, f, true]);
			// Type on color surfaces.
			for (const f of [
				'--cat-living',
				'--cat-health',
				'--cat-mobility',
				'--cat-business',
				'--cat-nature'
			])
				expect([mode, f, ratio(mode, '--on-cat', f) >= 4.5]).toEqual([mode, f, true]);
			for (const f of ['--signal', '--blueprint', '--cat-hazard'])
				expect([mode, f, ratio(mode, '--on-accent', f) >= 4.5]).toEqual([mode, f, true]);
		}
	});

	test('meanings stay distinguishable: flows among each other, signal against hazard', () => {
		const all = [...FLOWS, '--signal', '--cat-hazard'];
		for (const mode of MODES) {
			const c = (t: string): Oklch => colorOf(p, mode, t);
			for (let i = 0; i < all.length; i++)
				for (let j = i + 1; j < all.length; j++)
					expect([mode, all[i], all[j], deltaE(c(all[i]), c(all[j])) >= 0.08]).toEqual([
						mode,
						all[i],
						all[j],
						true
					]);
			// Hazard stays visible as a surface on paper (1.4.11).
			expect(ratio(mode, '--cat-hazard', '--paper')).toBeGreaterThanOrEqual(3);
		}
	});
});
