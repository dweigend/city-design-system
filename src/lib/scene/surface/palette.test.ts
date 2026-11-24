import { expect, test } from 'bun:test';
import { createClad, familyNames, readFamily, type Patch } from '../material';
import { existing, paintClad, readMaterialSurface } from './index';

const css = await Bun.file(new URL('../../../app.css', import.meta.url)).text();
const block = (selector: string) => {
	const start = css.indexOf(selector);
	return css.slice(start, css.indexOf('\n}', start));
};
const lightTheme = block(':root,');
const dark = block("[data-theme='dark'] {");
const defined = (text: string, token: string) => new RegExp(`^\\s*${token}:`, 'm').test(text);

test('the palette is complete for every family, slot and display, in light and dark', () => {
	for (const family of familyNames) {
		for (const slot of readFamily(family).slots) {
			for (const display of ['normal', 'transparency'] as const) {
				const { color } = readMaterialSurface(family, slot, display);
				expect(defined(lightTheme, color)).toBe(true);
				// A material token is set again for the dark theme; stock tokens derive from paper and ink.
				if (color.startsWith('--mat-'))
					expect({ color, dark: defined(dark, color) }).toEqual({ color, dark: true });
			}
		}
	}
	for (const display of ['normal', 'transparency'] as const) {
		expect(() => readMaterialSurface('render', 'trim', display)).toThrow(RangeError);
		expect(() => readMaterialSurface('render', 'toString' as never, display)).toThrow(RangeError);
		expect(() => readMaterialSurface('toString' as never, 'unit', display)).toThrow(RangeError);
		for (const family of familyNames) {
			expect(readMaterialSurface(family, 'shade', display)).toBe(
				readMaterialSurface(family, 'joint', display)
			);
			expect(readMaterialSurface(family, 'shade-unit', display)).toBe(
				readMaterialSurface(family, 'unit', display)
			);
		}
	}
});

test('material colours stay clear of the flow colours and the transparency view is neutral', () => {
	const flows = [
		'--cat-living',
		'--cat-health',
		'--cat-mobility',
		'--cat-business',
		'--cat-nature',
		'--path'
	];
	for (const family of familyNames)
		for (const slot of readFamily(family).slots) {
			expect(flows).not.toContain(readMaterialSurface(family, slot, 'normal').color);
			expect(readMaterialSurface(family, slot, 'transparency').color).toMatch(/^--stock-/);
		}
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
const light = [0.36, 0.48, -1] as const;

test('one role paints timber trim and render with their own palettes', () => {
	const clad = createClad(
		object,
		[
			{ role: 'wall', family: 'timber', patch },
			{ role: 'wall', family: 'render', patch: { ...patch, origin: [2, 0, 0] } },
			{ role: 'wall', family: 'timber', patch: { ...patch, origin: [4, 0, 0] } }
		],
		{ light }
	);
	const normal = paintClad(clad, 'normal');
	expect(clad.groups.map(({ family }) => family)).toEqual(['timber', 'render']);
	expect(normal.find(({ id }) => id === 'wall/trim')).toMatchObject({ color: '--mat-timber-trim' });
	expect(normal.find(({ id }) => id === 'wall/1/unit')).toMatchObject({ color: '--mat-render' });
	expect(normal.find(({ id }) => id === 'wall/shade')).toMatchObject({
		color: '--mat-timber-gap',
		strokeSegments: [],
		visible: true
	});

	const veiled = paintClad(clad, 'transparency');
	expect(veiled.find(({ id }) => id === 'wall/shade')?.visible).toBe(false);
	for (const [id, color] of [
		['wall/unit', '--stock-veil'],
		['wall/joint', '--stock-pencil'],
		['wall/trim', '--stock-line']
	])
		expect(veiled.find((drawable) => drawable.id === id)).toMatchObject({
			color,
			preserveColor: true
		});
});

test('pencil hatching and joint lines survive relief under the same role and family', () => {
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
			{ role: 'wall', family: 'timber', patch, level: 'pencil' },
			{ role: 'wall', family: 'timber', patch: { ...patch, origin: [2, 0, 0] } }
		],
		{ light }
	);
	expect(() => paintClad(clad, 'normal')).toThrow(/wall\/foot/);
	for (const display of ['normal', 'transparency'] as const) {
		const drawables = paintClad(clad, display, { 'wall/foot': existing.plinth });
		expect(drawables.find(({ id }) => id === 'footing')?.color).toBe(existing.plinth.color);
		expect(drawables.find(({ id }) => id === 'wall/unit')).toMatchObject({
			color: '--stock-pencil',
			preserveColor: true,
			hatch: expect.any(Number)
		});
		expect(drawables.find(({ id }) => id === 'wall/1/unit')?.hatch).toBeUndefined();
		expect(clad.groups[0].lines.length).toBeGreaterThan(0);
		expect(drawables.at(-1)).toMatchObject({
			id: 'wall/lines',
			fillVisible: false,
			strokeSegments: clad.groups[0].lines
		});
	}
});
