/**
 * Scenes for the chapter pages: corner module fixtures from L10 and crowns per function.
 * Reads from parametrik/ only; returns primitives for the existing vignettes.
 */
import type { Primitive, Vec3 } from '../parametrik/types';
import { createPatch } from '../parametrik/eckraster/topology';
import { fixture, phasen, zeigen, type FixtureName } from '../parametrik/eckraster/fixtures';
import { slots } from '../parametrik/eckraster/derive';
import { presentation } from '../parametrik/eckraster/presentation';
import { funktionen } from '../parametrik/eckraster/funktion';
import { accentOf, DEFAULT_TOKEN, eckModul } from '../parametrik/formen/eck';
import { formFamily } from '../parametrik/formen';
import { defaults, formOnCell } from '../parametrik/formen/zellen';

export type Vignette = { id: string; name: string; primitives: Primitive[] };
type Blick = { center: Vec3; span: number; eye?: Vec3 };

const patch = createPatch();

export function fixtureSzene(name: FixtureName, phase = 4): Primitive[] {
	const o = fixture(patch, name, phase);
	return presentation(patch, o, slots(patch, o), eckModul, false, false, zeigen(name, phase));
}

/** Frame tower in four build phases (134): frame → core → plug-in modules → crown. */
export const turmPhasen = (): Vignette[] =>
	phasen.map((p) => ({
		id: `phase-${p.value}`,
		name: `${p.value} ${p.label}`,
		primitives: fixtureSzene('geruestturm', Number(p.value))
	}));
export const turmBlick: Blick = { center: [0, 0, 13], span: 24 };

/** Interventions on existing stock from the L10 scenes. */
export const bestandSzenen = (namen: { id: FixtureName; name: string }[]): Vignette[] =>
	namen.map((n) => ({ id: n.id, name: n.name, primitives: fixtureSzene(n.id) }));
export const bestandBlick: Blick = { center: [0, 0, 7], span: 26 };

/** Crown per function (eckraster/funktion.ts): the same cell, the same seed. */
export const koepfe = (): Vignette[] =>
	funktionen.map((f) => {
		const familie = formFamily(f.kopf)!,
			main = f.token ?? DEFAULT_TOKEN,
			keep = new Set([main, '--paper', '--cat-nature']);
		return {
			id: f.id,
			name: `${f.label} · ${familie.name}`,
			primitives: [
				...formOnCell(familie, 'square', { ...defaults(familie), ...f.kopfParams }, 7, {
					token: main
				}).map((q) => ({ ...q, token: q.token && keep.has(q.token) ? q.token : accentOf(main) })),
				// Vegetation stays green; the dwelling beneath it carries the people color.
				...(f.id === 'wohnen'
					? [
							{
								id: 'wohnmodul',
								kind: 'box' as const,
								position: [-5, -5, -3] as Vec3,
								size: [10, 10, 3] as Vec3,
								role: 'neu' as const,
								material: 'concrete' as const,
								token: main
							}
						]
					: [])
			]
		};
	});
