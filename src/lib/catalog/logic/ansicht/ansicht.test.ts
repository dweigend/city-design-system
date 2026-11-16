// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import type { Primitive } from '../parametrik/types';
import { area, bounds, chords, clipPolygon, translate } from './geometrie';
import { moduleOf, schichten, tag, tagAll } from './tags';
import { applyFokus, finalStufe, phaseState, type Darstellung } from './fokus';
import { ebene, schneiden, CAP } from './schnitt';
import { DROP, gruppen, versatz } from './explosion';
import { axes, eyes, rahmen } from './rahmen';
import { ansichten, auswahlInfo, builtBounds, schnittHoehe } from './werkbank';
import { werkbankSzene } from './szenen';

const prism = (
	id: string,
	z = 0,
	token: Primitive['token'] = '--paper',
	role: Primitive['role'] = 'neu'
): Primitive => ({
	id,
	kind: 'prism',
	polygon: [
		[0, 0],
		[4, 0],
		[4, 4],
		[0, 4]
	],
	z,
	height: 4,
	role,
	token,
	material: 'concrete'
});
const alle: Darstellung = {
	fokus: { art: 'alle' },
	transparenz: 0,
	sichtbar: new Set(schichten),
	zeit: 4
};

describe('Tags', () => {
	test('module, level, flow and layer from id, color and position', () => {
		expect(moduleOf('sector0/0/1@2-linie-3')).toBe('sector0/0/1');
		expect(moduleOf('treppe:turm:center:sector4/0:linie:0')).toBe('treppe:turm:center:sector4/0');
		expect(moduleOf('bestand:rim0:fenster:3:1:0')).toBe('bestand:rim0');
		expect(moduleOf('garden:origin@0:2#schnitt-h')).toBe('garden:origin');
		const t = tag(prism('sector0/0/1@2-flaeche', 8, '--cat-health'));
		expect(t).toMatchObject({ level: 2, flow: 'water', schicht: 'modul', phase: 3 });
		expect(tag(prism('x', 8)).level).toBe(2);
		expect(tag({ ...prism('frame', 0, '--signal'), material: 'metal' }).schicht).toBe('geruest');
		expect(tag(prism('b', 0, '--paper', 'bestand')).phase).toBe(0);
	});
});

describe('Focus', () => {
	const scene = [
		prism('a@0', 0, '--cat-health'),
		prism('b@1', 4, '--cat-mobility'),
		prism('c@0', 0, '--paper', 'bestand')
	];
	const tags = tagAll(scene);
	test('flow: selected flow in color, the rest white architectural model, existing stock ghost', () => {
		const out = applyFokus(scene, tags, { ...alle, fokus: { art: 'strom', strom: 'water' } });
		expect(out[0]).toMatchObject({ token: '--cat-health', material: 'concrete' });
		expect(out[1]).toMatchObject({ token: '--paper', material: 'paper' });
		expect(out[2]).toMatchObject({ material: 'ghost' });
	});
	test('level: above is ghost, below is context; selection always focus with edge', () => {
		const d = { ...alle, fokus: { art: 'ebene' as const, ebene: 0, auswahl: 'b@1' } };
		const out = applyFokus(scene, tags, d);
		expect(out[0].material).toBe('concrete');
		expect(out[1]).toMatchObject({ token: '--cat-mobility', emphasis: 'auswahl' });
		expect(finalStufe(tags.get('b@1')!, { ...d, fokus: { art: 'ebene', ebene: 0 } })).toBe(
			'background'
		);
	});
	test('transparency and switches: background off, layer off', () => {
		const d: Darstellung = { ...alle, fokus: { art: 'strom', strom: 'water' }, transparenz: 2 };
		// Context becomes ghost, background (existing stock) drops out.
		const out = applyFokus(scene, tags, d);
		expect(out.map((p) => p.id)).toEqual(['a@0', 'b@1']);
		expect(out[1].material).toBe('ghost');
		const off = { ...alle, sichtbar: new Set(schichten.filter((s) => s !== 'bestand')) };
		expect(applyFokus(scene, tags, off)).toHaveLength(2);
	});
	test('build time: what is still to come is planned (clear glass)', () => {
		expect(phaseState(3, 1.5)).toBe('planned');
		expect(phaseState(3, 2)).toBe('built');
		const out = applyFokus(scene, tags, { ...alle, zeit: 0 });
		expect(out[0]).toMatchObject({ material: 'glass', token: '--paper' });
		expect(out[2].material).toBe('concrete');
	});
});

describe('Section', () => {
	test('clips a polygon and finds cut segments, also in a non-convex polygon', () => {
		const sq: [number, number][] = [
			[0, 0],
			[4, 0],
			[4, 4],
			[0, 4]
		];
		expect(area(clipPolygon(sq, { normal: [1, 0], d: 1 }))).toBeCloseTo(4);
		const u: [number, number][] = [
			[0, 0],
			[3, 0],
			[3, 3],
			[2, 3],
			[2, 1],
			[1, 1],
			[1, 3],
			[0, 3]
		];
		expect(chords(u, { normal: [0, 1], d: 2 })).toHaveLength(2);
	});
	test('prism: body shortened, caps closed at both planes', () => {
		const out = schneiden([prism('a@0')], { hoehe: 2, vertikal: ebene('x', 1) });
		const body = out.find((p) => p.id === 'a@0')!;
		expect(body.kind === 'prism' && body.height).toBe(2);
		expect(bounds(body).min[0]).toBeCloseTo(1);
		const h = out.find((p) => p.id.endsWith('#schnitt-h'))!;
		expect(h).toMatchObject({ section: 'neu', z: 2 });
		expect(h.kind === 'prism' && area(h.polygon)).toBeCloseTo(12);
		const v = out.find((p) => p.id.endsWith('#schnitt-v0'))!;
		expect(v.kind === 'prism' && v.height).toBe(2);
		expect(bounds(v).min[0]).toBeCloseTo(1 - CAP);
	});
	test('existing stock gray in section; lines clipped; anything cut away entirely drops out', () => {
		const line: Primitive = {
			id: 'l',
			kind: 'polyline',
			points: [
				[0, 0, 1],
				[4, 0, 1],
				[4, 4, 1]
			],
			role: 'neu',
			token: '--paper',
			material: 'concrete'
		};
		const out = schneiden([prism('b', 0, '--paper', 'bestand'), line, prism('weg', 9)], {
			hoehe: 6,
			vertikal: ebene('x', 2)
		});
		expect(out.find((p) => p.id.includes('#schnitt-v'))!.section).toBe('bestand');
		const cut = out.filter((p) => p.id.startsWith('l'));
		expect(cut).toHaveLength(1);
		expect(cut[0].kind === 'polyline' && cut[0].points[0]).toEqual([2, 0, 1]);
		expect(out.some((p) => p.id === 'weg')).toBe(false);
	});
});

describe('Explosion and frame', () => {
	test('levels rise per floor, modules move out radially, ground stays', () => {
		const scene = [prism('ground'), prism('a@0'), prism('b@2', 8)];
		const g = gruppen(scene, tagAll(scene));
		const off = versatz(g, { ebenen: 3, module: 0.5 }, 4, [0, 0]);
		expect(off.get('ground@0#0')).toEqual([0, 0, 0]);
		expect(off.get('b@2#2')).toEqual([1, 1, 6]);
		// Build phase: during installation the group drops in from DROP meters.
		const t = versatz(g, { ebenen: 0, module: 0 }, 1, [0, 0]);
		expect(t.get('a@0#2')![2]).toBeCloseTo(DROP);
	});
	test('frame holds the box; plan view with north up', () => {
		const b = {
			min: [0, 0, 0] as [number, number, number],
			max: [10, 20, 4] as [number, number, number]
		};
		expect(rahmen(b, eyes.plan, 1, 1).span).toBeCloseTo(10);
		expect(rahmen(b, eyes.plan, 4, 1).span).toBeCloseTo(10);
		expect(axes(eyes.plan).up[1]).toBeCloseTo(1);
		expect(axes(eyes['schnitt-x']).up[2]).toBeCloseTo(1);
		expect(axes(eyes['schnitt-x']).right[1]).toBeCloseTo(-1);
	});
	test('translate moves every form', () => {
		expect(bounds(translate(prism('a'), [1, 2, 3])).min).toEqual([1, 2, 3]);
	});
});

describe('Workbench on L10 scenes', () => {
	for (const name of ['geruestturm', 'aufstockung', 'quartier'] as const)
		test(`${name}: three views, closed caps, selection with three metrics`, () => {
			const base = werkbankSzene(name);
			const tags = tagAll(base);
			const v = ansichten(base, tags, alle, {
				horizontal: true,
				vertikal: true,
				geschoss: 1,
				achse: 'x',
				lage: (builtBounds(base, tags).min[0] + builtBounds(base, tags).max[0]) / 2
			});
			for (const list of [v.haupt, v.plan, v.schnitt]) {
				expect(list.length).toBeGreaterThan(50);
				for (const p of list)
					for (const n of [...bounds(p).min, ...bounds(p).max])
						expect(Number.isFinite(n)).toBe(true);
			}
			expect(v.plan.some((p) => p.section === 'neu')).toBe(true);
			expect(v.schnitt.some((p) => p.section === 'bestand')).toBe(true);
			const solid = v.plan.filter((p) => p.kind === 'prism' || p.kind === 'polyline');
			expect(solid.every((p) => bounds(p).max[2] <= schnittHoehe(1) + CAP + 1e-6)).toBe(true);
			const module = [...tags.values()].find((t) => t.schicht === 'modul')!;
			const info = auswahlInfo(base, tags, `${module.module}@${module.level}`)!;
			expect(info.kennzahlen).toHaveLength(3);
			expect(Number(info.kennzahlen[1].value)).toBeGreaterThan(0);
		});
});
