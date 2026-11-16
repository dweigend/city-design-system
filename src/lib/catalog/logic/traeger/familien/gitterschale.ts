import { familienTexte } from '../../../data/traeger';
import { belege } from '../belegung';
import { kanal } from '../hash';
import { kantenId, type TraegerFamilie, type TraegerPlan, type Vec3 } from '../plan';

// Ported from city_game: prototype/src/lib/experiments/relaxed-shell/core/relaxed-shell.ts.
// neighbors/target/residual: Σ qᵢⱼ(pᵢ − pⱼ) = load. Here a direct Cholesky solution
// instead of a tolerance-dependent stop; q = 1 kN/m, load in kN, world z up.
const SPANNWEITE = 24;
const ANKERBOGEN = 5;
/** Allowed distance to the force-weighted neighbor mean: 1e-10 × span [m]. */
export const GLEICHGEWICHT_TOLERANZ = 1e-10 * SPANNWEITE;
const adresse = (n: number, x: number, y: number) => `gitterschale:k:n${n}:${x}:${y}`;
const rand = (n: number, zeilen: number, x: number, y: number) =>
	Math.min(x, y, n - x, zeilen - y) === 0;

/** SPD matrix of the anchored net; fixed row/summation order, no pivoting. */
function cholesky(matrix: Float64Array[]): Float64Array[] {
	const l = matrix.map(() => new Float64Array(matrix.length));
	for (let i = 0; i < l.length; i++)
		for (let j = 0; j <= i; j++) {
			let s = matrix[i][j];
			for (let k = 0; k < j; k++) s -= l[i][k] * l[j][k];
			l[i][j] = i === j ? Math.sqrt(s) : s / l[j][j];
		}
	return l;
}
function loesen(l: Float64Array[], rhs: number[]): number[] {
	const result = [...rhs];
	for (let i = 0; i < l.length; i++) {
		for (let j = 0; j < i; j++) result[i] -= l[i][j] * result[j];
		result[i] /= l[i][i];
	}
	for (let i = l.length - 1; i >= 0; i--) {
		for (let j = i + 1; j < l.length; j++) result[i] -= l[j][i] * result[j];
		result[i] /= l[i][i];
	}
	return result;
}

/**
 * Detached equilibrium data, without mutation/randomness. Internal inputs from the
 * normalized family contract: n=8/12/16 (also 9 as a reference sample), d∈[0,1],
 * grundriss=0/1/2. Free nodes row by row; the boundary stays exactly prescribed.
 * Landscape: n×3n meshes over 20×30 m, additional rise 3…4 m.
 * Square: rise 2…9 m; anchor arches: additional rise 3.2…7 m.
 * Landscape: two lateral edge arches, a constriction near the ground between them.
 * All heights follow the same equilibrium solution, no deformation afterward.
 */
export function kraftdichteNetz(
	n: number,
	d: number,
	grundriss: number
): {
	punkte: Vec3[];
	anker: number[];
	last: number;
	residuum: number;
	konvergiert: boolean;
} {
	const zeilen = grundriss === 2 ? 3 * n : n;
	const punkte: Vec3[] = [],
		anker: number[] = [],
		frei: number[] = [];
	for (let y = 0; y <= zeilen; y++)
		for (let x = 0; x <= n; x++) {
			const u = (2 * x) / n - 1,
				v = (2 * y) / zeilen - 1;
			const welle = Math.sin(Math.PI * v) ** 2;
			punkte.push([
				(grundriss === 2 ? 10 * (0.76 + 0.24 * welle) : SPANNWEITE / 2) *
					u *
					(grundriss === 1 ? 1 - 0.18 * (1 - v * v) : 1),
				(grundriss === 2 ? 15 : SPANNWEITE / 2) * v,
				grundriss === 2 ? -5 * welle : grundriss === 1 ? -ANKERBOGEN * (1 - u * u) : 0
			]);
			(rand(n, zeilen, x, y) ? anker : frei).push(y * (n + 1) + x);
		}
	const index = new Map(frei.map((id, i) => [id, i]));
	const nachbarn = (id: number) => [id - 1, id + 1, id - n - 1, id + n + 1];
	const matrix = frei.map((id, i) => {
		const row = new Float64Array(frei.length);
		row[i] = 4;
		for (const neighbor of nachbarn(id)) {
			const j = index.get(neighbor);
			if (j !== undefined) row[j] = -1;
		}
		return row;
	});
	const l = cholesky(matrix);
	const einheitslast = loesen(
		l,
		frei.map(() => 1)
	);
	const stich = grundriss === 2 ? 3 + 1 * d : grundriss === 1 ? 3.2 + 3.8 * d : 2 + 7 * d;
	const last = -stich / Math.max(...einheitslast);
	const geloest = [0, 1, 2].map((axis) =>
		loesen(
			l,
			frei.map((id) =>
				nachbarn(id).reduce(
					(sum, neighbor) => sum + (index.has(neighbor) ? 0 : punkte[neighbor][axis]),
					axis === 2 ? last : 0
				)
			)
		)
	);
	frei.forEach((id, i) => {
		punkte[id] = [geloest[0][i], geloest[1][i], geloest[2][i]];
	});
	let residuum = 0;
	for (const id of frei) {
		const abstand = [0, 1, 2].map(
			(axis) =>
				punkte[id][axis] -
				nachbarn(id).reduce(
					(sum, neighbor) => sum + punkte[neighbor][axis],
					axis === 2 ? last : 0
				) /
					4
		);
		residuum = Math.max(residuum, Math.hypot(...abstand));
	}
	return { punkte, anker, last, residuum, konvergiert: residuum < GLEICHGEWICHT_TOLERANZ };
}

function planen(werte: Record<string, number>, saat: number): TraegerPlan {
	const n = werte.maschen ?? 12,
		phase = werte.phase ?? 2,
		grundriss = werte.grundriss ?? 2;
	const zeilen = grundriss === 2 ? 3 * n : n;
	const netz = kraftdichteNetz(n, werte.durchhang ?? 0.35, grundriss);
	const anker = new Set(netz.anker);
	// The whole net including its edge frame is inverted, not solved again.
	// Phase 0: horizontal projection. Phase 1: tension model. Phase 2: compression shell.
	const faktor = phase <= 1 ? phase : 3 - 2 * phase;
	const knoten = netz.punkte.map((p, i) => ({
		id: adresse(n, i % (n + 1), Math.floor(i / (n + 1))),
		p: [p[0], p[1], p[2] * faktor] as Vec3,
		rolle: anker.has(i) ? ('lager' as const) : ('frei' as const)
	}));
	const kanten: TraegerPlan['kanten'] = [],
		flaechen: TraegerPlan['flaechen'] = [];
	const kante = (a: string, b: string) => kanten.push({ id: kantenId(a, b), a, b, rolle: 'rippe' });
	for (let y = 0; y <= zeilen; y++)
		for (let x = 0; x <= n; x++) {
			const a = adresse(n, x, y);
			if (x < n) kante(a, adresse(n, x + 1, y));
			if (y < zeilen) kante(a, adresse(n, x, y + 1));
			if (x < n && y < zeilen)
				flaechen.push({
					id: `gitterschale:f:n${n}:${x}:${y}`,
					knoten: [a, adresse(n, x + 1, y), adresse(n, x + 1, y + 1), adresse(n, x, y + 1)],
					rolle: (werte.dach ?? 1) === 1 ? 'membran' : 'offen'
				});
		}
	// Open end arches: no closed courtyard cell and no invented room volume.
	// Occupancy only on stably addressed membrane fields, 88 % neutral.
	const plan: TraegerPlan = {
		version: 1,
		familie: 'gitterschale',
		saat: saat >>> 0,
		werte: { ...werte },
		knoten,
		kanten,
		flaechen,
		zellen: [],
		belegung: {}
	};
	// Two connected bands; the seed decides only their running direction.
	// water follows the saddle, energy the southern crest. No scatter-field hash.
	plan.belegung = Object.fromEntries(flaechen.map((f) => [f.id, 'leer']));
	const anzahl = Math.floor(flaechen.length * 0.12);
	for (const [i, strom] of (['water', 'energy'] as const).entries()) {
		const menge = i === 0 ? Math.floor(anzahl / 2) : Math.ceil(anzahl / 2);
		const spiegeln = kanal(saat, 'gitterschale', `band:${strom}`, 'belegung') % 2;
		const zeile = Math.floor(zeilen * (i === 0 ? 0.5 : 0.25));
		const ziele = Array.from({ length: menge }, (_, j) => {
			const reihe = Math.floor(j / n),
				spalte = j % n;
			const x = (reihe + spiegeln) % 2 === 0 ? spalte : n - 1 - spalte;
			return `gitterschale:f:n${n}:${x}:${zeile + reihe}`;
		});
		Object.assign(
			plan.belegung,
			belege(plan, saat, 'gitterschale', {
				anteil: 1,
				stroeme: [strom],
				ziele
			})
		);
	}
	return plan;
}

export const gitterschale: TraegerFamilie = {
	id: 'gitterschale',
	parameter: [
		{
			art: 'stetig',
			id: 'durchhang',
			label: 'Sag',
			min: 0,
			max: 1,
			schritt: 0.01,
			start: 0.35,
			einheit: ''
		},
		{
			art: 'diskret',
			id: 'maschen',
			label: 'Meshes',
			optionen: [8, 12, 16].map((wert) => ({ wert, label: String(wert) })),
			start: 12
		},
		{
			art: 'diskret',
			id: 'grundriss',
			label: 'Edge',
			optionen: [
				{ wert: 2, label: 'Landscape' },
				{ wert: 1, label: 'Anchor arches' },
				{ wert: 0, label: 'Square' }
			],
			start: 2
		},
		{
			art: 'stetig',
			id: 'phase',
			label: 'Form finding',
			min: 0,
			max: 2,
			schritt: 0.01,
			start: 2,
			einheit: '',
			verborgen: true
		},
		{
			art: 'diskret',
			id: 'dach',
			label: 'Membrane',
			optionen: [
				{ wert: 0, label: 'Net' },
				{ wert: 1, label: 'Roof' }
			],
			start: 1,
			verborgen: true
		}
	],
	planen,
	loop: (familienTexte.find((t) => t.id === 'gitterschale')?.schritte ?? []).map((s, i) => ({
		name: s.name,
		werte: { phase: Math.min(i, 2), dach: i === 3 ? 1 : 0 },
		ansicht: i === 3 ? 'belegt' : 'geruest',
		dauerS: 4
	}))
};
