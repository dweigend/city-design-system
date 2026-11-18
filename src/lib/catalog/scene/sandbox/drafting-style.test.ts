// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { expect, test } from 'bun:test';
import { structureMaterials } from './structure-materials';
import { MASSSTAB, STRICHE } from '../../data/leitstil';
import { pruefeStil, stilFuer } from '../../logic/leitstil';
import { acceptanceScene } from '../../logic/sandbox';
import { nearestZoom, sandboxStyle } from './drafting-style';

const context = { zoom: 'quartier', modus: 'ansehen', situation: 'normal' } as const;

test('the sandbox uses the nearest bible zoom', () => {
	expect(nearestZoom(1)).toBe('stadt');
	expect(nearestZoom(8)).toBe('quartier');
	expect(nearestZoom(20)).toBe('haus');
	expect(nearestZoom(65)).toBe('nah');
	expect(nearestZoom(MASSSTAB.quartier)).toBe(context.zoom);
});

test('the Leitstil variant passes the style contract in both themes', () => {
	for (const thema of ['hell', 'dunkel'] as const) {
		const k = { ...context, thema };
		const style = sandboxStyle(k, 'leitstil');
		expect(style).toEqual(stilFuer(k));
		expect(pruefeStil(style, k)).toEqual([]);
		expect(style.rollen.huelle.strichPx).toBe(STRICHE.kontur);
		expect(style.rollen.bestand.schatten).toBe(false);
	}
});

test('the hairline exception is limited to the structural stroke and contrast', () => {
	const normal = sandboxStyle(context, 'leitstil');
	const hairline = sandboxStyle(context, 'hairline');
	const violations = pruefeStil(hairline, context).map((entry) => entry.id);
	expect(violations.sort()).toEqual(['INV-02', 'INV-03', 'INV-09']);
	expect(hairline.rollen.traeger.strichPx).toBe(STRICHE.bestand);
	expect({ ...hairline, rollen: { ...hairline.rollen, traeger: normal.rollen.traeger } }).toEqual(
		normal
	);
});

test('the fixed plate retains three eras, two rail stops, two walkway landings and a forest', () => {
	const first = acceptanceScene();
	const { world, additions } = first;
	expect(world.seed).toBe(7);
	expect(world.state.storyParts.get('78/43')?.map(({ built }) => built)).toEqual([2026, 2026]);
	expect(world.state.storyParts.get('81/41')?.at(-1)?.built).toBe(2027);
	expect(world.state.storyParts.get('86/44')?.at(-1)?.built).toBe(2028);
	expect(world.lines[0].stops).toHaveLength(2);
	expect(world.state.cover.size).toBe(9);
	expect(additions.filter((part) => /^acceptance-walkway:[05]$/.test(part.id))).toHaveLength(2);
	expect(acceptanceScene().additions).toEqual(additions);
});

test('the renderer applies role widths and switches both structural strokes', () => {
	const finishes = structureMaterials();
	const { materials } = finishes;
	const scale = MASSSTAB.quartier;
	try {
		finishes.setStyle(sandboxStyle(context, 'leitstil'), 'leitstil', scale);
		expect(materials.pencil.linewidth).toBe(STRICHE.bestand);
		expect(materials.perimeter.linewidth).toBe(STRICHE.kontur);
		expect(materials.primary.linewidth).toBeCloseTo(0.18 * scale);
		expect(materials.secondary.linewidth).toBe(STRICHE.detail);
		finishes.setStyle(sandboxStyle(context, 'hairline'), 'hairline', scale);
		expect(materials.primary.linewidth).toBe(STRICHE.bestand);
		expect(materials.secondary.linewidth).toBe(STRICHE.bestand);
	} finally {
		finishes.dispose();
	}
});
