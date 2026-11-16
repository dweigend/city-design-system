// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { colorOf, parsePalette, type Mode } from './palette';
import { contrast, inGamut, oklchToLinear, type Oklch } from './oklch';
import { klassenNormalkraft, leiter } from '../../data/statikSkala';

const css = readFileSync(new URL('../../../../app.css', import.meta.url), 'utf8');
const palette = parsePalette(css);

/** Resolve the analysis-only OKLab mixes from the actual CSS, including paper and neutral hue. */
function farbe(mode: Mode, token: string): Oklch {
	const mixes = [
		...css.matchAll(
			/(--ana-[\w-]+): color-mix\(in oklab, var\((--[\w-]+)\), var\((--[\w-]+)\) (\d+)%\);/g
		)
	];
	const mix = mixes.find((m) => m[1] === token);
	if (!mix) return colorOf(palette, mode, token);
	const a = farbe(mode, mix[2]),
		b = farbe(mode, mix[3]),
		t = Number(mix[4]) / 100;
	const lab = (c: Oklch) => [
		c.l,
		c.c * Math.cos((c.h * Math.PI) / 180),
		c.c * Math.sin((c.h * Math.PI) / 180)
	];
	const x = lab(a).map((v, i) => v * (1 - t) + lab(b)[i] * t);
	return { l: x[0], c: Math.hypot(x[1], x[2]), h: (Math.atan2(x[2], x[1]) * 180) / Math.PI };
}

describe('Analysis colors', () => {
	for (const mode of ['light', 'dark'] as const) {
		for (const [name, tokens] of [
			[
				'Compression',
				klassenNormalkraft
					.slice(0, 4)
					.reverse()
					.map((k) => k.token)
			],
			['Tension', klassenNormalkraft.slice(3).map((k) => k.token)],
			['Utilization / deformation', leiter]
		] as const) {
			test(`${mode}: ${name} rises in OKLab lightness distance and paper contrast`, () => {
				const paper = farbe(mode, '--paper');
				const colors = tokens.map((t) => farbe(mode, t));
				const ratios = colors.map((c) => contrast(oklchToLinear(c), oklchToLinear(paper)));
				for (let i = 0; i < colors.length; i++) {
					expect(inGamut(oklchToLinear(colors[i]))).toBe(true);
					if (!i) continue;
					expect(Math.abs(colors[i].l - paper.l)).toBeGreaterThan(
						Math.abs(colors[i - 1].l - paper.l)
					);
					expect(ratios[i]).toBeGreaterThan(ratios[i - 1]);
				}
				expect(ratios.at(-1)).toBeGreaterThanOrEqual(3);
			});
		}
	}
});
