import { expect, test } from 'bun:test';
import { assetRegistry } from '../assets';
import { specimen } from '../house-typology/specimens';
import { squareGrid } from '../quad-grid';
import { planHouse, sectionParts, houseSurfaces } from './index';
import { flowToken } from '../../data/focus';
import { buildingPalette } from '../material/building-palette';

test('houses leave all construction surfaces to the scene palette', () => {
	const cells = squareGrid(1, 1, 10).cells;
	const sites = [specimen(1, 'capsule-stack'), specimen(2, 'round-tower')];
	const pleated = planHouse({
		cells,
		seed: 3,
		stacks: new Map([[cells[0].id, ['living', 'living', 'living', 'living']]]),
		envelope: { system: 'pleated-sheet', finish: 'metall-gebuerstet' }
	});
	sites.push(pleated);
	const roles = ['shell', 'base', 'deck', 'screen', 'pane', 'fitting', 'frame'];
	const stock = new Map(assetRegistry.map((asset) => [asset.id, asset]));
	for (const house of sites) {
		const parts = sectionParts(house);
		for (const p of parts) {
			const role = p.buildingSurface;
			expect(role?.ensemble, p.id).toBe(house.ensemble);
			expect(roles).toContain(role?.slot);
			expect(['living', 'water', 'material', 'food', 'energy']).toContain(role?.use);
			expect(role).not.toHaveProperty('pigment');
			for (const key of ['finish', 'overprint', 'topToken', 'printBand'])
				expect(p, p.id).not.toHaveProperty(key);
			// Primitive requires the registry drafting fallback until the scene projects the role.
			const { objectId, variant, slot } = p.source;
			const fallback = stock.get(objectId)?.slotDefaults[variant][slot];
			expect(p.token).toBe(fallback?.token);
			expect(p.material).toBe(fallback?.material);
		}
	}
	const exterior = sectionParts(pleated).filter((p) => p.source.objectId === 'full-height-shell');
	expect(exterior.length).toBeGreaterThan(0);
	for (const part of exterior) {
		const role = part.buildingSurface;
		if (!role) throw Error('Missing pleated shell role');
		expect(role.slot).toBe('shell');
		const surface = buildingPalette(role.use, role.ensemble)[role.slot];
		expect(surface.token).not.toBe(flowToken.people);
		expect(surface.finish).not.toBe('metall-gebuerstet');
	}
	const override = { token: '--signal', finish: 'wood' } as const;
	const changed = sectionParts(pleated, { ...houseSurfaces, shell: override });
	for (const p of changed.filter((part) => part.source.objectId === 'full-height-shell'))
		expect(p).toMatchObject(override);
});
