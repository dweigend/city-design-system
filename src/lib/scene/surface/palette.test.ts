import { expect, test } from 'bun:test';
import * as appearance from '../material';
import { createClad, familyNames, readFamily, type Patch } from '../../domain/material';
import { functionColourDistance } from '../material';
import { existing, modelTones, paintClad, readMaterialSurface, readModelSurface } from './index';

const css = await Bun.file(new URL('../../../app.css', import.meta.url)).text();
const block = (selector: string) => {
	const start = css.indexOf(selector);
	return css.slice(start, css.indexOf('\n}', start));
};
const lightTheme = block(':root,');
const dark = block("[data-theme='dark'] {");
const defined = (text: string, token: string) => new RegExp(`^\\s*${token}:`, 'm').test(text);

/** An oklch literal of a token in one theme block as Oklab, or undefined for a derived token. */
function oklab(text: string, token: string): [number, number, number] | undefined {
	const match = new RegExp(`^\\s*${token}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`, 'm').exec(
		text
	);
	if (!match) return undefined;
	const [l, c, h] = match.slice(1).map(Number);
	const radians = (h * Math.PI) / 180;
	return [l, c * Math.cos(radians), c * Math.sin(radians)];
}

const flows = ['--cat-living', '--cat-health', '--cat-mobility', '--cat-business', '--cat-nature'];
const tones = (theme: string) => modelTones.map((tone) => `--model-${tone}`).concat(theme);

test('the palette is complete for every family, slot, tone and display, in light and dark', () => {
	for (const family of familyNames)
		for (const slot of readFamily(family).slots)
			for (const tone of [undefined, ...modelTones])
				for (const display of ['normal', 'transparency'] as const) {
					const { color, opacity } = readMaterialSurface(family, slot, display, tone);
					expect(defined(lightTheme, color)).toBe(true);
					if (color.startsWith('--model-'))
						expect({ color, dark: defined(dark, color) }).toEqual({ color, dark: true });
					if (opacity) expect(defined(lightTheme, opacity)).toBe(true);
				}
	for (const display of ['normal', 'transparency'] as const) {
		expect(() => readMaterialSurface('board', 'mark', display)).toThrow(RangeError);
		expect(() => readMaterialSurface('board', 'toString' as never, display)).toThrow(RangeError);
		expect(() => readMaterialSurface('toString' as never, 'face', display)).toThrow(RangeError);
		expect(() => readMaterialSurface('board', 'face', display, 'teal' as never)).toThrow(
			RangeError
		);
	}
});

test('every model tone stays the configured distance from every flow colour in both themes', () => {
	const flowColours = flows.map((token) => oklab(lightTheme, token));
	for (const theme of [lightTheme, dark])
		for (const token of tones('--model-ink').filter((name) => name !== '--model-ink')) {
			const tone = oklab(theme, token);
			expect({ token, literal: tone !== undefined }).toEqual({ token, literal: true });
			for (const [i, flow] of flowColours.entries()) {
				if (!tone || !flow) throw new Error(`Missing ${token} or ${flows[i]}`);
				const distance = Math.hypot(tone[0] - flow[0], tone[1] - flow[1], tone[2] - flow[2]);
				expect({ token, flow: flows[i], apart: distance >= functionColourDistance }).toEqual({
					token,
					flow: flows[i],
					apart: true
				});
			}
		}
});

test('model materials use model tones only, and the transparency view is neutral', () => {
	for (const family of familyNames)
		for (const slot of readFamily(family).slots) {
			const { color } = readMaterialSurface(family, slot, 'normal');
			expect(color).toMatch(/^--model-/);
			expect(flows).not.toContain(color);
			expect(readMaterialSurface(family, slot, 'transparency').color).toMatch(/^--stock-/);
		}
	expect(readModelSurface({ family: 'board', tone: 'blue' }, 'normal').color).toBe('--model-blue');
	expect(readModelSurface({ family: 'cork' }, 'normal').grain).toBeDefined();
	expect(readModelSurface({ family: 'cork' }, 'normal', false).grain).toBeUndefined();
});

const patch: Patch = {
	origin: [0, 0, 0],
	across: [1, 0, 0],
	normal: [0, -1, 0],
	size: [2, 2],
	thickness: 0.1,
	budget: 6000
};
const object = { id: 'wall-run', footprint: { width: 4, depth: 1 }, anchors: [] };

test('one role paints tinted boards by tone and stripes with unoutlined marks', () => {
	const clad = createClad(object, [
		{ role: 'wall', family: 'board', tone: 'blue', patch },
		{ role: 'wall', family: 'stripe', patch: { ...patch, origin: [2, 0, 0] } },
		{ role: 'wall', family: 'board', tone: 'yellow', patch: { ...patch, origin: [4, 0, 0] } }
	]);
	const normal = paintClad(clad, 'normal');
	expect(clad.groups.map(({ family, tone }) => [family, tone])).toEqual([
		['board', 'blue'],
		['stripe', undefined],
		['board', 'yellow']
	]);
	expect(normal.find(({ id }) => id === 'wall/face')).toMatchObject({ color: '--model-blue' });
	expect(normal.find(({ id }) => id === 'wall/1/mark')).toMatchObject({
		color: '--model-ink',
		strokeSegments: []
	});
	expect(normal.find(({ id }) => id === 'wall/2/face')).toMatchObject({ color: '--model-yellow' });
	const veiled = paintClad(clad, 'transparency');
	for (const [id, color] of [
		['wall/face', '--stock-veil'],
		['wall/1/mark', '--stock-line']
	])
		expect(veiled.find((drawable) => drawable.id === id)).toMatchObject({
			color,
			preserveColor: true
		});
});

test('grain shows only near; pencil hatching and joint lines survive beside another level', () => {
	const cork = createClad(object, [{ role: 'wall', family: 'cork', patch }], { level: 'near' });
	expect(paintClad(cork, 'normal')[0].grain).toBeDefined();
	const mid = createClad(object, [{ role: 'wall', family: 'cork', patch }], { level: 'mid' });
	expect(paintClad(mid, 'normal')[0].grain).toBeUndefined();
	const wide = { ...patch, size: [8, 7] as const, budget: 6000 };
	const clad = createClad(
		{
			...object,
			slots: ['wall/foot'],
			parts: [
				{
					id: 'footing',
					slot: 'wall/foot',
					shape: { kind: 'box', center: [1, 0, 0], size: [2, 1, 0.1], rotation: 0 }
				}
			]
		},
		[
			{ role: 'wall', family: 'card', patch: wide, level: 'pencil' },
			{ role: 'wall', family: 'card', patch: { ...wide, origin: [8, 0, 0] } }
		],
		{ level: 'mid' }
	);
	expect(() => paintClad(clad, 'normal')).toThrow(/wall\/foot/);
	for (const display of ['normal', 'transparency'] as const) {
		const drawables = paintClad(clad, display, { 'wall/foot': existing.plinth });
		expect(drawables.find(({ id }) => id === 'footing')?.color).toBe(existing.plinth.color);
		expect(drawables.find(({ id }) => id === 'wall/face')).toMatchObject({
			color: '--stock-pencil',
			preserveColor: true,
			hatch: expect.any(Number)
		});
		expect(drawables.find(({ id }) => id === 'wall/1/face')?.hatch).toBeUndefined();
		expect(clad.groups[0].lines.length).toBeGreaterThan(0);
		expect(drawables.at(-1)).toMatchObject({
			id: 'wall/lines',
			fillVisible: false,
			strokeSegments: clad.groups[0].lines
		});
	}
});

test('the scene material entry exposes only appearance settings', () => {
	expect(Object.keys(appearance).sort()).toEqual([
		'functionColourDistance',
		'modelGrain',
		'pencilStroke'
	]);
});
