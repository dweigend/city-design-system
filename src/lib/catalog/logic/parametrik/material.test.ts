import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { alphaSteps, materials } from '../../data/material';
import { materialLook, resolveMaterial, usesMaterialSystem } from './material';
import {
	allMaterialIds,
	bestandScene,
	materialForms,
	materialMatrix,
	towerScene
} from './materialSzenen';

describe('Material vocabulary', () => {
	test('alpha steps stay in sync with app.css', () => {
		const css = readFileSync('src/app.css', 'utf8');
		for (const [k, v] of Object.entries(alphaSteps))
			expect(Number(css.match(new RegExp(`--alpha-${k}:\\s*([\\d.]+)`))?.[1])).toBe(v);
	});
	test('ids unique', () => expect(new Set(allMaterialIds).size).toBe(materials.length));
	test('opacity and shares within range', () => {
		for (const m of materials)
			for (const token of ['--paper', '--cat-health'] as const) {
				const l = materialLook(m.id, token);
				expect(l.opacity).toBeGreaterThan(0);
				expect(l.opacity).toBeLessThanOrEqual(1);
				expect(l.backdrop).toBeGreaterThanOrEqual(0);
				expect(l.backdrop).toBeLessThan(1);
				expect(l.paper).toBeGreaterThanOrEqual(0);
				expect(l.paper).toBeLessThanOrEqual(1);
			}
	});
	test('opaque materials cover fully', () => {
		for (const m of materials.filter((m) => m.group === 'opak'))
			expect(materialLook(m.id, '--paper').transparent).toBe(false);
	});
});

describe('Rules color × material', () => {
	test('flow color never on clear glass', () =>
		expect(
			resolveMaterial({ material: 'glass', token: '--cat-health', role: 'neu' }).material
		).toBe('acrylic'));
	test('existing stock only white architectural model or ghost, neutral', () => {
		for (const material of allMaterialIds) {
			const r = resolveMaterial({ material, token: '--cat-living', role: 'bestand' });
			expect(['paper', 'ghost']).toContain(r.material);
			expect(r.token).toBe('--paper');
		}
	});
	test('membrane only for hulls', () => {
		expect(
			resolveMaterial({ material: 'membrane', token: '--paper', role: 'neu', kind: 'box' }).material
		).toBe('acrylic');
		expect(
			resolveMaterial({ material: 'membrane', token: '--paper', role: 'neu', kind: 'dome' })
				.material
		).toBe('membrane');
	});
	test('water carries the water color', () =>
		expect(resolveMaterial({ material: 'water', token: '--cat-business', role: 'neu' }).token).toBe(
			'--cat-health'
		));
	test('old glass flag becomes glass', () =>
		expect(
			resolveMaterial({ material: 'concrete', token: '--paper', role: 'neu', glass: true }).material
		).toBe('glass'));
	test('L1–L11 stay without the material system', () => {
		expect(usesMaterialSystem('concrete')).toBe(false);
		expect(usesMaterialSystem('wood')).toBe(false);
		expect(usesMaterialSystem('metal')).toBe(false);
		expect(usesMaterialSystem('acrylic')).toBe(true);
		expect(usesMaterialSystem('concrete', true)).toBe(true);
	});
});

describe('Scenes', () => {
	const finite = (p: unknown) => !JSON.stringify(p).includes('null');
	test('matrix: material × form, all finite', () => {
		const m = materialMatrix(
			allMaterialIds,
			materialForms.map((f) => f.id),
			'--cat-health'
		);
		expect(m.filter((p) => p.id.endsWith('-core')).length).toBe(allMaterialIds.length * 5);
		expect(m.every(finite)).toBe(true);
	});
	test('existing stock: fixed role colors; neutral is kept on line and module', () => {
		for (const token of ['--paper', '--cat-mobility', '--cat-health'] as const) {
			const byId = new Map(bestandScene(token).map((p) => [p.id, p]));
			expect(byId.get('geruest')!.token).toBe('--signal');
			expect(byId.get('steg')!.token).toBe('--cat-business');
			expect(byId.get('leitung')!.token).toBe(token);
			expect(byId.get('aufstockung-kern')!.token).toBe(token);
			expect(towerScene(token).find((p) => p.id === 'kopf-kern')!.token).toBe(token);
		}
	});
	test('tower and existing stock: unique ids', () => {
		for (const s of [towerScene('--paper'), bestandScene('--cat-nature')]) {
			expect(new Set(s.map((p) => p.id)).size).toBe(s.length);
			expect(s.every(finite)).toBe(true);
		}
	});
});
