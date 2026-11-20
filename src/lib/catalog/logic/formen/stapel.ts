/**
 * Explainer loop "What bears, stays": a structural frame in the gap between two old buildings,
 * plug-in modules like drawers. Image and position are pure functions of seed and time t (seconds).
 * Geometry from logic/parametrik/stack.ts (teaching ensemble), here only sorted by layer.
 * Meters; logic x/y plan, z up.
 */
import { stack } from '../parametrik/stack';
import { random } from '../parametrik/random';
import type { ColorToken, Primitive, Vec3 } from '../parametrik/types';
import { takt, weich } from './loops';

export type Schicht = 'bestand' | 'geruest' | 'einschub' | 'zutat';

/** Fixed form of the teaching tower: six floors, slabs slightly offset. */
export const STAPEL = { geschosse: 6, versatz: 1, saat: 19 } as const;
/** Drop height when inserting, and pull-out of the drawers, meters. */
export const HUB = { fall: 9, auszug: 3.5 } as const;
/** Center of the core in plan (stack.ts: core 25.4 + 4.2 / 2). */
const KERN: [number, number] = [27.5, 7.5];

const GERUEST = ['core', 'deck-', 'post-', 'stair-', 'landing-', 'distributor'];

/** Layer of a primitive: existing stock is gray, the frame bears, plug-in modules and additions change. */
export function schichtVon(p: Primitive): Schicht {
	if (p.role === 'bestand') return 'bestand';
	if (p.id.startsWith('module-')) return 'einschub';
	return GERUEST.some((g) => p.id.startsWith(g)) ? 'geruest' : 'zutat';
}

/** Group for offsets: each drawer on its own, otherwise the layer. */
export const stapelGruppe = (p: Primitive) =>
	schichtVon(p) === 'einschub' ? `einschub:${p.id}` : schichtVon(p);

const STROEME: ColorToken[] = [
	'--cat-business',
	'--cat-health',
	'--cat-mobility',
	'--cat-nature',
	'--cat-living'
];

/** Bridge and ring of the teaching ensemble distract here: they would sit on the old building. */
const OHNE = ['bridge', 'ring'];

/** All parts of the teaching tower in build order (deterministic per seed). */
export const stapelTeile = (saat: number = STAPEL.saat): Primitive[] =>
	stack({ floors: STAPEL.geschosse, offset: STAPEL.versatz, explosion: 0, seed: saat }).filter(
		(p) => !OHNE.includes(p.id)
	);

/**
 * Image of a step: visible layers only; in the conversion the plug-in modules carry another
 * use (another flow, fixed per module from the seed).
 */
export function stapelBild(
	teile: Primitive[],
	sichtbar: readonly Schicht[],
	umgebaut: boolean,
	saat: number = STAPEL.saat
): Primitive[] {
	return teile
		.filter((p) => sichtbar.includes(schichtVon(p)))
		.map((p, i) => {
			if (!umgebaut || schichtVon(p) !== 'einschub') return p;
			const alt = STROEME.findIndex((token) => token === p.token);
			const r = Math.floor(random(saat + i * 7919)() * (STROEME.length - 1));
			return { ...p, token: STROEME[(Math.max(0, alt) + 1 + r) % STROEME.length] };
		});
}

/** Pull-out direction of a drawer: away from the core, forward or back, never into the old buildings. */
export function auszug(p: Primitive): [number, number] {
	if (p.kind !== 'box') return [0, 0];
	return [0, p.position[1] + p.size[1] / 2 < KERN[1] ? -1 : 1];
}

export const stapelSchritte = [
	{ id: 'bestand', dauer: 2.6 },
	{ id: 'geruest', dauer: 2.8 },
	{ id: 'einschub', dauer: 2.8 },
	{ id: 'heraus', dauer: 2.6 },
	{ id: 'umbau', dauer: 3.4 }
] as const;
export type StapelSchritt = (typeof stapelSchritte)[number]['id'];
export const stapelDauern = stapelSchritte.map((s) => s.dauer);

export type StapelLage = {
	schritt: StapelSchritt;
	index: number;
	u: number;
	sichtbar: Schicht[];
	umgebaut: boolean;
	/** Drop height of the layer currently being inserted (m), 0 = seated. */
	fall: { schicht: Schicht; z: number } | null;
	/** Pull-out of the drawers, 0 … 1. */
	aus: number;
};

const unseated = (progress: number) => 1 - weich(progress);

/** Vertical offset in meters while a part seats over a positive duration in milliseconds. */
export function dropOffset(elapsedMs: number, durationMs: number): number {
	return HUB.fall * unseated(elapsedMs / durationMs);
}

/** Position at time t. Inserting and pulling out each take 60 % of their step, then hold. */
export function stapelLage(t: number): StapelLage {
	const { index, u } = takt(stapelDauern, t);
	const schritt = stapelSchritte[index].id;
	const ein = unseated(u / 0.6);
	const drop = HUB.fall * ein;
	const basis = { schritt, index, u, umgebaut: false, fall: null, aus: 0 };
	switch (schritt) {
		case 'bestand':
			return { ...basis, sichtbar: ['bestand'] };
		case 'geruest':
			return {
				...basis,
				sichtbar: ['bestand', 'geruest'],
				fall: ein > 0 ? { schicht: 'geruest', z: drop } : null
			};
		case 'einschub':
			return {
				...basis,
				sichtbar: ['bestand', 'geruest', 'einschub', 'zutat'],
				fall: ein > 0 ? { schicht: 'einschub', z: drop } : null
			};
		case 'heraus':
			return {
				...basis,
				sichtbar: ['bestand', 'geruest', 'einschub', 'zutat'],
				aus: weich(u / 0.6)
			};
		case 'umbau':
			return {
				...basis,
				sichtbar: ['bestand', 'geruest', 'einschub', 'zutat'],
				umgebaut: true,
				aus: 1 - weich((u - 0.2) / 0.55)
			};
	}
}

/** Offsets per group for a position (meters); the scene only moves, it does not rebuild. */
export function stapelVersatz(teile: Primitive[], lage: StapelLage): Map<string, Vec3> {
	const out = new Map<string, Vec3>();
	if (lage.fall?.schicht === 'geruest') out.set('geruest', [0, 0, lage.fall.z]);
	if (lage.fall?.schicht === 'einschub') out.set('zutat', [0, 0, lage.fall.z]);
	for (const p of teile) {
		if (schichtVon(p) !== 'einschub') continue;
		const [ax, ay] = auszug(p);
		const d = lage.aus * HUB.auszug;
		const z = lage.fall?.schicht === 'einschub' ? lage.fall.z : 0;
		out.set(`einschub:${p.id}`, [ax * d, ay * d, z]);
	}
	return out;
}
