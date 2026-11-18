import type { TraegerPlan } from '../traeger';
import type { Vec3 } from './formen';
import { blockEntwurf, type HausTeil } from './hausBausteine';

const glas = { familie: 'glas', finish: 'glas-klar' } as const;
const STAB_RADIUS_M = 0.033;

/** Fits the existing structural plan to a studio-scale envelope in meters. Its topology
 * stays intact: all struts stay visible, and selected panels are glazed between them. */
export function tragwerkEntwurf(
	id: string,
	plan: TraegerPlan,
	mass: Vec3,
	lage: Vec3,
	verglast: (f: TraegerPlan['flaechen'][number], i: number) => boolean
): HausTeil[] {
	const punkte = angepassteKnoten(plan, mass);
	const felder: Vec3[][] = [];
	const scheiben: Vec3[][] = [];
	const punkt = (id: string) => {
		const p = punkte.get(id);
		if (!p) throw new RangeError(`Missing structural node: ${id}`);
		return p;
	};
	plan.flaechen.forEach((f, i) => {
		if (f.rolle === 'boden' || f.rolle === 'offen') return;
		const sammlung = verglast(f, i) ? scheiben : felder;
		sammlung.push(f.knoten.map(punkt));
	});
	const kanten = plan.kanten.map(({ a, b }) => [punkt(a), punkt(b)] as const);
	return [
		blockEntwurf(`${id}-panels`, mass, lage, 'huelle', { art: 'paneele', felder }),
		{
			...blockEntwurf(`${id}-glazing`, mass, lage, 'kern', { art: 'paneele', felder: scheiben }),
			haut: glas
		},
		blockEntwurf(`${id}-frame`, mass, lage, 'kern', {
			art: 'streben',
			kanten,
			radius: STAB_RADIUS_M
		})
	];
}

function angepassteKnoten(plan: TraegerPlan, mass: Vec3) {
	const achsen = mass.map((m, i) => {
		const werte = plan.knoten.map((k) => k.p[i]);
		const min = Math.min(...werte);
		const span = Math.max(...werte) - min;
		const rand = STAB_RADIUS_M * 2;
		return (v: number) =>
			((v - min) / span - (i < 2 ? 0.5 : 0)) * (m - 2 * rand) + (i === 2 ? rand : 0);
	});
	return new Map(plan.knoten.map(({ id, p }) => [id, achsen.map((um, i) => um(p[i])) as Vec3]));
}
