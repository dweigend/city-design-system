import { expect, test } from 'bun:test';
import { createSampleBoard, familyNames, readFamily, readLight } from '../material';
import { existing, paintClad, readMaterialSurface } from './index';

const css = await Bun.file(new URL('../../../app.css', import.meta.url)).text();
const block = (selector: string) => {
	const start = css.indexOf(selector);
	return css.slice(start, css.indexOf('\n}', start));
};
const light = block(':root,');
const dark = block("[data-theme='dark'] {");
const defined = (text: string, token: string) => new RegExp(`^\\s*${token}:`, 'm').test(text);

test('the palette is complete for every family, slot and display, in light and dark', () => {
	for (const family of familyNames) {
		for (const slot of readFamily(family).slots.filter((name) => !name.startsWith('shade'))) {
			for (const display of ['normal', 'transparency'] as const) {
				const { color } = readMaterialSurface(family, slot, display);
				expect(defined(light, color)).toBe(true);
				// A material token is set again for the dark theme; stock tokens derive from paper and ink.
				if (color.startsWith('--mat-')) expect({ color, dark: defined(dark, color) }).toEqual({ color, dark: true });
			}
		}
	}
	expect(() => readMaterialSurface('render', 'trim', 'normal')).toThrow(RangeError);
});

test('material colours stay clear of the flow colours and the transparency view is neutral', () => {
	const flows = ['--cat-living', '--cat-health', '--cat-mobility', '--cat-business', '--cat-nature', '--path'];
	for (const family of familyNames)
		for (const slot of readFamily(family).slots.filter((name) => !name.startsWith('shade'))) {
			expect(flows).not.toContain(readMaterialSurface(family, slot, 'normal').color);
			expect(readMaterialSurface(family, slot, 'transparency').color).toMatch(/^--stock-/);
		}
});

test('one boundary paints a clad object: shade overprints, pencil hatches and draws joints', () => {
	const options = { light: readLight([0.6, 0.8], 0.6) };
	const board = createSampleBoard([{ family: 'masonry' }, { family: 'timber', level: 'pencil' }], options);
	const normal = paintClad(board, 'normal', { stand: existing.roof });
	expect(normal.map(({ id }) => id)).toEqual([...board.object.parts.map(({ id }) => id), 'plate-1/lines']);
	const shade = normal.find(({ id }) => id === 'plate-0/shade');
	expect(shade).toMatchObject({ color: '--mat-mortar', strokeSegments: [], visible: true });
	expect(normal.find(({ id }) => id === 'plate-1/unit')).toMatchObject({ color: '--stock-pencil', hatch: expect.any(Number) });
	expect(normal.at(-1)).toMatchObject({ fillVisible: false, strokeSegments: board.lines['plate-1'] });
	const veiled = paintClad(board, 'transparency', { stand: existing.roof });
	expect(veiled.find(({ id }) => id === 'plate-0/shade')?.visible).toBe(false);
	expect(veiled.find(({ id }) => id === 'plate-0/unit')?.color).toBe('--stock-veil');
	expect(() => paintClad(board, 'normal')).toThrow(/stand/);
});
