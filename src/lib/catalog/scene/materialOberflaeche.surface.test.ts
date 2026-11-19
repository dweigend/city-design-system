import { expect, test } from 'bun:test';
import * as THREE from 'three/webgpu';
import { materialAusfuehrungen } from '../data/materialAusfuehrung';
import { familien } from '../data/materialSeite';
import { ausfuehrungenVon } from '../logic/material/ausfuehrung';
import { rezept, voreinstellung } from '../logic/material/rezept';
import { createMaterialLibrary } from './material-library';
import { physicalRecipe } from '../logic/material/surface';

const palette = {
	paper: '#f4f0e8',
	ink: '#32322e',
	blueprint: '#153453',
	blueprintSoft: '#456789',
	categories: { business: '#cc5422', health: '#5089bb' }
};

test('all finishes produce physical node materials with distinct identities and disposal', () => {
	const pool = createMaterialLibrary(palette);
	let disposed = 0;
	for (const f of familien)
		for (const finish of ausfuehrungenVon(f.id)) {
			const r = rezept(f.id, voreinstellung(f.id, 'neutral'));
			const m = pool.material(physicalRecipe(r, finish.id));
			expect(m).toBeInstanceOf(THREE.MeshPhysicalNodeMaterial);
			expect(m.name).toBe(finish.id);
			expect(pool.material(physicalRecipe(r, finish.id))).toBe(m);
			m.addEventListener('dispose', () => disposed++);
		}
	pool.dispose();
	expect(disposed).toBe(materialAusfuehrungen.length);
	pool.dispose();
	expect(disposed).toBe(materialAusfuehrungen.length);
});

test('transparent optics refract without alpha-erasing their highlights; stock remains pale', () => {
	const pool = createMaterialLibrary(palette);
	const glass = pool.material(physicalRecipe(rezept('glas')));
	const stock = pool.material(physicalRecipe(rezept('bestand')));
	if (
		!(glass instanceof THREE.MeshPhysicalNodeMaterial) ||
		!(stock instanceof THREE.MeshPhysicalNodeMaterial)
	)
		throw new Error('Expected physical surfaces');
	expect(glass.transmission).toBeGreaterThan(0.9);
	expect(glass.opacity).toBe(1);
	expect(stock.color.getHexString()).toBe('eeece6');
	expect(stock.metalness).toBe(0);
	pool.dispose();
});
