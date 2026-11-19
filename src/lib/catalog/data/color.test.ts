import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { flowColor, flowSteps, flowToken } from './focus';
import { akzente, designregeln, enden, grau, reihen, shares } from './color';
import { colorOf, parsePalette, type Mode } from '../logic/farbe/palette';
import { funktionen } from '../logic/parametrik/eckraster/funktion';
import { accentOf, GERUEST_TOKEN } from '../logic/parametrik/formen/eck';

/** Meaning contract, set by the author on 2026-11-11. Change only with the author. */
const FEST = {
	water: '--cat-health',
	energy: '--cat-mobility',
	food: '--cat-nature',
	material: '--cat-living',
	people: '--cat-business'
};

describe('Meaning contract', () => {
	test('flowToken matches the fixed table', () => {
		expect<Record<string, string>>({ ...flowToken }).toEqual(FEST);
	});

	test('Every flow has its own color; none is signal or hazard', () => {
		const tokens = Object.values(flowToken);
		expect(new Set(tokens).size).toBe(tokens.length);
		for (const t of tokens)
			expect(['--signal', '--cat-hazard', '--paper', '--ink']).not.toContain(t);
	});

	test('Functions, steps and contract table read the same source', () => {
		for (const f of funktionen)
			if (f.token) expect<readonly string[]>(Object.values(flowToken)).toContain(f.token);
		for (const r of reihen)
			if (r.id !== 'grau') expect(r.tokens[3]).toBe(FEST[r.id as keyof typeof FEST]);
		expect(flowColor('water')).toBe('var(--cat-health)');
	});

	test('Accents are only ink or signal; the structural frame is signal', () => {
		const streams = new Set<string>(Object.values(flowToken));
		for (const main of ['--paper', ...streams] as Parameters<typeof accentOf>[0][]) {
			expect(['--paper', '--signal']).toContain(accentOf(main));
			expect(streams.has(accentOf(main))).toBe(false);
		}
		expect(GERUEST_TOKEN).toBe('--signal');
	});
});

const css: string = readFileSync(new URL('../../../app.css', import.meta.url), 'utf8');
const palette = parsePalette(css);

describe('Palette as ramps (page /farben)', () => {
	test('Example: Water runs from --cat-health-1 to --cat-health-5; step 4 is the base tone', () => {
		expect(reihen.find((r) => r.id === 'water')?.tokens).toEqual([
			'--cat-health-1',
			'--cat-health-2',
			'--cat-health-3',
			'--cat-health',
			'--cat-health-5'
		]);
	});

	test('Example: Gray comes first and uses the same five steps as every flow color', () => {
		expect(reihen[0]).toBe(grau);
		expect(reihen.map((r) => r.tokens.length)).toEqual(reihen.map(() => flowSteps.length));
		expect(flowSteps.map((s) => s.name)).toEqual([
			'Surroundings',
			'Surface',
			'Volume',
			'Network',
			'Core'
		]);
	});

	test('Every ramp runs from background to ink, light and dark', () => {
		const MODES: Mode[] = ['light', 'dark'];
		for (const mode of MODES) {
			const bg = colorOf(palette, mode, enden.hintergrund).l;
			const ink = colorOf(palette, mode, enden.schrift).l;
			for (const r of reihen) {
				const dist = r.tokens.map((t) => Math.abs(colorOf(palette, mode, t).l - bg));
				for (let i = 1; i < dist.length; i++) expect(dist[i]).toBeGreaterThan(dist[i - 1]);
				expect(dist[4]).toBeLessThan(Math.abs(ink - bg));
			}
		}
	});

	test('Accents are neither flows nor a ramp', () => {
		const flowTokens = new Set<string>(Object.values(flowToken));
		for (const a of akzente) {
			expect(flowTokens.has(a.token)).toBe(false);
			expect(reihen.some((r) => r.tokens.includes(a.token))).toBe(false);
		}
	});

	test('Example: design rules name every flow once with its fixed base tone', () => {
		const zuordnung = designregeln.filter((r) => r.bereich === 'Mapping');
		for (const [strom, token] of Object.entries(FEST)) {
			const name = reihen.find((r) => r.id === strom)?.name;
			expect(zuordnung.filter((r) => r.regel === name).map((r) => r.token)).toEqual([token]);
		}
	});

	test('Example: the table quantity values come from the 75/20/5 quantity rule', () => {
		const menge = designregeln.filter((r) => r.bereich === 'Quantity');
		for (const s of shares) expect(menge.some((r) => r.wert.includes(`${s.share}%`))).toBe(true);
		expect(shares.reduce((sum, s) => sum + s.share, 0)).toBe(100);
	});

	test('Design rules: every row complete and unique, tokens exist in app.css', () => {
		expect(new Set(designregeln.map((r) => `${r.bereich}/${r.regel}`)).size).toBe(
			designregeln.length
		);
		for (const r of designregeln)
			for (const feld of [r.bereich, r.regel, r.wert, r.token])
				expect(feld.length).toBeGreaterThan(0);
		const tokens = designregeln.flatMap((r) => r.token.match(/--[a-z][\w-]*/g) ?? []);
		for (const t of tokens.filter((t) => !t.startsWith('--step')))
			expect([t, css.includes(`${t}:`)]).toEqual([t, true]);
	});
});
