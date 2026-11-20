import { expect, test } from 'bun:test';
import { BODY_TOKEN } from '../../data/house-body';
import { buildingPalette } from './building-palette';
import { materialSheet } from './contact-sheet';

test('one ensemble keeps its construction family across programme changes', () => {
	const living = buildingPalette('living', 'court-A');
	for (const use of ['food', 'water', 'energy', 'material'] as const) {
		const palette = buildingPalette(use, 'court-A');
		expect(palette.shell).toEqual({ ...living.shell, token: BODY_TOKEN[use] });
		expect(palette.pane).toEqual(living.pane);
		expect(palette.base.finish).toBe('beton-terrazzo');
		expect(palette.fitting.finish).toBe('metall-messing');
		expect(palette.screen.finish).toBe('perforated-metal');
	}
	const families = new Set(
		Array.from({ length: 30 }, (_, i) => buildingPalette('living', String(i)).shell.finish)
	);
	expect(families.size).toBe(3);
});

test('installed materials are shown on assembled parts before the finish catalogue', () => {
	const [shells, construction, , catalogue] = materialSheet('--signal');
	for (const sample of shells.samples) {
		const parts = sample.parts();
		expect(parts.some((p) => p.kind === 'capsule')).toBe(true);
		expect(parts.some((p) => p.finish === 'metall-messing')).toBe(true);
	}
	const finishes = new Set(construction.samples.flatMap((s) => s.parts().map((p) => p.finish)));
	for (const finish of [
		'perforated-metal',
		'beton-terrazzo',
		'acryl-matt',
		'metall-messing'
	] as const)
		expect(finishes.has(finish)).toBe(true);
	for (const sample of catalogue.samples) {
		const [panel] = sample.parts();
		expect(panel.kind).toBe('mesh');
		expect(panel.token).toBe('--signal');
	}
});
