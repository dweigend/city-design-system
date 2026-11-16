/**
 * Workbench scenes: corner module fixtures from L10 (read only) plus subsoil for the section (40).
 * The view layer itself knows no scene; any list of primitives works.
 */
import type { Primitive } from '../parametrik/types';
import { createPatch } from '../parametrik/eckraster/topology';
import { fixture, zeigen, type FixtureName } from '../parametrik/eckraster/fixtures';
import { slots } from '../parametrik/eckraster/derive';
import { presentation } from '../parametrik/eckraster/presentation';
import { eckModul } from '../parametrik/formen/eck';

export type WerkbankSzene = Extract<FixtureName, 'geruestturm' | 'aufstockung' | 'quartier'>;

/** Subsoil: earth mass below the ground, hatched gray in section. */
export function untergrund(ground: Primitive | undefined, depth = 3): Primitive[] {
	if (!ground || ground.kind !== 'prism') return [];
	return [
		{
			id: 'untergrund',
			kind: 'prism',
			polygon: ground.polygon,
			z: ground.z - depth,
			height: depth,
			role: 'bestand',
			token: '--paper',
			material: 'concrete',
			edges: false
		}
	];
}

const patch = createPatch();
const cache = new Map<WerkbankSzene, Primitive[]>();

export function werkbankSzene(name: WerkbankSzene): Primitive[] {
	const hit = cache.get(name);
	if (hit) return hit;
	const o = fixture(patch, name);
	const model = presentation(patch, o, slots(patch, o), eckModul, false, false, zeigen(name));
	const out = [...untergrund(model.find((p) => p.id === 'ground')), ...model];
	cache.set(name, out);
	return out;
}
