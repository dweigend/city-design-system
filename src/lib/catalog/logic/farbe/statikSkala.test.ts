import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { colorOf, parsePalette } from './palette';
import { contrast, inGamut, oklchToLinear } from './oklch';
import { klassenNormalkraft, leiter } from '../../data/statikSkala';

const css = readFileSync(new URL('../../../../app.css', import.meta.url), 'utf8');
const palette = parsePalette(css);

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
				const paper = colorOf(palette, mode, '--paper');
				const colors = tokens.map((t) => colorOf(palette, mode, t));
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
