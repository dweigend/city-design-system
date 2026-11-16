import { it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
	KATALOG_RUHIG,
	STAHL,
	abtragen,
	loeseFachwerk,
	rundstab,
	type Aufgabe,
	type Fachwerk,
	type Kandidat,
	type Knoten,
	type BemessenerStab,
	type Lastfall,
	type Stab,
	type Vec3
} from './index';

/** Accepted examples of the contract phase "statische Simulation" (C-43). SI: m, N, Pa. */
const E = STAHL.eModulPa;
const stab = (id: string, a: string, b: string, flaecheM2 = 1e-3): Stab => ({
	id,
	a,
	b,
	flaecheM2,
	eModulPa: E
});
const FEST: [boolean, boolean, boolean] = [true, true, true];
const summe = (vs: Vec3[]): Vec3 =>
	vs.reduce<Vec3>((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]);
const kreuz = (a: Vec3, b: Vec3): Vec3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
function gleichgewicht(f: Fachwerk, lastfall: Lastfall, reaktionenN: Record<string, Vec3>) {
	const ort = new Map(f.knoten.map((n) => [n.id, n.p]));
	const kraefte = [
		...lastfall.lasten.map((l) => ({ p: ort.get(l.knotenId) as Vec3, f: l.kraftN })),
		...Object.entries(reaktionenN).map(([id, r]) => ({ p: ort.get(id) as Vec3, f: r }))
	];
	return {
		kraft: summe(kraefte.map((k) => k.f)),
		moment: summe(kraefte.map((k) => kreuz(k.p, k.f)))
	};
}

test('S1: an axial strut matches the hand calculation; without lateral restraint it is a mechanism', () => {
	const f: Fachwerk = {
		knoten: [
			{ id: 'links', p: [0, 0, 0] },
			{ id: 'rechts', p: [2, 0, 0] }
		],
		staebe: [stab('s', 'links', 'rechts')],
		lager: [
			{ knotenId: 'links', fest: FEST },
			{ knotenId: 'rechts', fest: [false, true, true] }
		]
	};
	const zug: Lastfall = { id: 'zug', lasten: [{ knotenId: 'rechts', kraftN: [10000, 0, 0] }] };
	const r = loeseFachwerk(f, [zug]);
	assert.equal(r.status, 'ok');
	if (r.status !== 'ok') return;
	const [l] = r.loesungen;
	assert.ok(Math.abs(l.verschiebungenM.rechts[0] / 9.5238095238e-5 - 1) <= 1e-8);
	assert.ok(Math.abs(l.stabkraefteN.s / 10000 - 1) <= 1e-8);
	assert.ok(Math.abs(l.reaktionenN.links[0] / -10000 - 1) <= 1e-8);
	assert.ok(l.residuumN <= 1e-8 * 10000);
	const frei = loeseFachwerk({ ...f, lager: [f.lager[0]] }, [zug]);
	assert.deepEqual(frei, { status: 'mechanismus', elementId: 'rechts' });
});

test('S2: spatial bipod: node equilibrium, strut forces and energy', () => {
	// Symmetric tripod reduced to a planar pair plus one out-of-plane brace.
	const f: Fachwerk = {
		knoten: [
			{ id: 'a', p: [-3, 0, 0] },
			{ id: 'b', p: [3, 0, 0] },
			{ id: 'c', p: [0, 4, 0] },
			{ id: 'spitze', p: [0, 0, 4] }
		],
		staebe: [stab('sa', 'a', 'spitze'), stab('sb', 'b', 'spitze'), stab('sc', 'c', 'spitze')],
		lager: ['a', 'b', 'c'].map((knotenId) => ({ knotenId, fest: FEST }))
	};
	const last: Lastfall = { id: 'g', lasten: [{ knotenId: 'spitze', kraftN: [0, 0, -50000] }] };
	const r = loeseFachwerk(f, [last]);
	assert.equal(r.status, 'ok');
	if (r.status !== 'ok') return;
	const [l] = r.loesungen;
	// Node equilibrium by hand: sc carries N·4/√32 vertically and must be balanced in y by nothing
	// else, so sc = 0; the pair shares the load: N = −F / (2 · 4/5).
	assert.ok(Math.abs(l.stabkraefteN.sc) <= 1e-8 * 50000);
	for (const id of ['sa', 'sb']) assert.ok(Math.abs(l.stabkraefteN[id] / -31250 - 1) <= 1e-8);
	const g = gleichgewicht(f, last, l.reaktionenN);
	for (const v of [...g.kraft, ...g.moment]) assert.ok(Math.abs(v) <= 1e-8 * 50000 * 6);
	// Linear reference: external work equals twice the strain energy, u·f = Σ N² L / (E A).
	const arbeit = l.verschiebungenM.spitze[2] * -50000;
	const energie = (2 * 31250 ** 2 * 5) / (E * 1e-3);
	assert.ok(Math.abs(arbeit / energie - 1) <= 1e-8);
});

/** Rigid plate on four V hangers; `ebenen` chooses the vertical plane of each V. */
function plattform(ebenen: ('x' | 'y')[]): Fachwerk {
	const ecken: Vec3[] = [
		[-2, -1, 0],
		[2, -1, 0],
		[2, 1, 0],
		[-2, 1, 0]
	];
	const knoten: Knoten[] = ecken.map((p, i) => ({ id: `ecke${i}`, p }));
	const staebe = [
		...[0, 1, 2, 3].map((i) => stab(`rand${i}`, `ecke${i}`, `ecke${(i + 1) % 4}`, 1e-2)),
		stab('diagonale', 'ecke0', 'ecke2', 1e-2)
	];
	const lager = [];
	for (const [i, p] of ecken.entries())
		for (const seite of [-1, 1]) {
			const id = `anker${i}${seite > 0 ? 'p' : 'm'}`;
			const q: Vec3 =
				ebenen[i] === 'y' ? [p[0], p[1] + seite * 1.5, 3] : [p[0] + seite * 1.5, p[1], 3];
			knoten.push({ id, p: q });
			lager.push({ knotenId: id, fest: FEST });
			staebe.push({ ...stab(`haenger${i}${seite > 0 ? 'p' : 'm'}`, `ecke${i}`, id), nurZug: true });
		}
	return { knoten, staebe, lager };
}

test('S3: hanging platform: V-hangers each carry F/(2 cos α), parallel planes swing', () => {
	const f = plattform(['y', 'x', 'y', 'x']);
	const mittig: Lastfall = {
		id: 'mittig',
		lasten: [0, 1, 2, 3].map((i) => ({ knotenId: `ecke${i}`, kraftN: [0, 0, -20000] as Vec3 }))
	};
	const einseitig: Lastfall = {
		id: 'einseitig',
		lasten: [{ knotenId: 'ecke0', kraftN: [0, 0, -80000] }]
	};
	const sog: Lastfall = { id: 'sog', lasten: [{ knotenId: 'ecke0', kraftN: [0, 0, 1000] }] };
	const r = loeseFachwerk(f, [mittig, einseitig, sog]);
	assert.equal(r.status, 'ok');
	if (r.status !== 'ok') return;
	const erwartet = 20000 / (2 * (3 / Math.hypot(3, 1.5)));
	for (const [id, n] of Object.entries(r.loesungen[0].stabkraefteN))
		if (id.startsWith('haenger')) assert.ok(Math.abs(n / erwartet - 1) <= 1e-8);
	assert.deepEqual(r.loesungen[0].schlaff, []);
	for (const [i, lastfall] of [mittig, einseitig].entries()) {
		const g = gleichgewicht(f, lastfall, r.loesungen[i].reaktionenN);
		for (const v of [...g.kraft, ...g.moment]) assert.ok(Math.abs(v) <= 1e-8 * 80000 * 4);
		assert.ok(r.loesungen[i].residuumN <= 1e-8 * 80000);
	}
	// A tension-only hanger under compression is reported, never silently accepted.
	assert.ok(r.loesungen[2].schlaff.includes('haenger0m'));
	const pendel = loeseFachwerk(plattform(['y', 'y', 'y', 'y']), [mittig]);
	assert.equal(pendel.status, 'mechanismus');
});

/** Ground structure of a 8 m space bridge: every node pair up to 4.6 m is a candidate. */
function brueckenAufgabe(): Aufgabe {
	const knoten: Knoten[] = [];
	for (const x of [0, 2, 4, 6, 8])
		for (const y of [-1, 1]) knoten.push({ id: `u:${x}:${y}`, p: [x, y, 0] });
	for (const x of [1, 3, 5, 7]) knoten.push({ id: `o:${x}`, p: [x, 0, 2] });
	const kandidaten: Kandidat[] = [];
	for (const [i, a] of knoten.entries())
		for (const b of knoten.slice(i + 1))
			if (Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]) <= 4.6)
				kandidaten.push({ id: `${a.id}|${b.id}`, a: a.id, b: b.id, rolle: 'tragstab' });
	const mitte = (kraftN: Vec3) => [-1, 1].map((y) => ({ knotenId: `u:4:${y}`, kraftN }));
	return {
		knoten,
		kandidaten,
		lager: [
			{ knotenId: 'u:0:-1', fest: FEST },
			{ knotenId: 'u:0:1', fest: FEST },
			{ knotenId: 'u:8:-1', fest: [false, true, true] },
			{ knotenId: 'u:8:1', fest: [false, true, true] }
		],
		lastfaelle: [
			{ id: 'last', eigengewichtG: [0, 0, -1.35], lasten: mitte([0, 0, -60000]) },
			{ id: 'quer+', eigengewichtG: [0, 0, -1.35], lasten: mitte([0, 6000, -60000]) },
			{ id: 'quer-', eigengewichtG: [0, 0, -1.35], lasten: mitte([0, -6000, -60000]) }
		],
		werkstoff: STAHL,
		gebrauch: { lastfallId: 'last', grenzeM: 8 / 300 }
	};
}

test('S4: pruning: of the full candidate grid what carries force remains; utilization ≤ 1, load path to the bearing', () => {
	const aufgabe = brueckenAufgabe();
	const r = abtragen(aufgabe);
	assert.equal(r.status, 'ok');
	if (r.status !== 'ok') return;
	assert.ok(r.staebe.length <= 0.6 * aufgabe.kandidaten.length);
	assert.equal(r.kennzahlen.kandidaten, aufgabe.kandidaten.length);
	assert.equal(r.kennzahlen.nullstaebe, 0);
	for (const s of r.staebe) {
		assert.ok(s.ausnutzung <= 1 + 1e-9, `${s.id} ${s.ausnutzung}`);
		assert.ok(Math.max(s.zugN, s.druckN) > 1e-6 * 120000, `zero-force member ${s.id}`);
		// Compression needs a tube; a rod is only ever in tension.
		assert.equal(s.querschnitt.art, s.druckN > 0 ? 'rohr' : 'rundstab');
	}
	// Problem and loads mirror in y, so does the form: ties leave together.
	const spiegel = (id: string) =>
		id.split('|').map((k) => {
			const [lage, x, y] = k.split(':');
			return lage === 'u' ? `u:${x}:${-Number(y)}` : k;
		});
	for (const s of r.staebe) {
		const [a, b] = spiegel(s.id);
		const partner: BemessenerStab | undefined = r.staebe.find(
			(x) => x.id === `${a}|${b}` || x.id === `${b}|${a}`
		);
		assert.equal(partner?.querschnitt.durchmesserM, s.querschnitt.durchmesserM, s.id);
	}
	assert.ok(r.kennzahlen.durchbiegungM <= 8 / 300);
	assert.ok(r.kennzahlen.residuumN <= 1e-8 * 120000);
	// Every loaded node reaches a bearing through remaining members.
	const nachbarn = new Map<string, string[]>();
	for (const s of r.staebe) {
		nachbarn.set(s.a, [...(nachbarn.get(s.a) ?? []), s.b]);
		nachbarn.set(s.b, [...(nachbarn.get(s.b) ?? []), s.a]);
	}
	const erreicht = new Set(['u:4:-1']);
	const offen = ['u:4:-1'];
	for (let id = offen.pop(); id; id = offen.pop())
		for (const n of nachbarn.get(id) ?? [])
			if (!erreicht.has(n)) {
				erreicht.add(n);
				offen.push(n);
			}
	for (const l of aufgabe.lager) assert.ok(erreicht.has(l.knotenId));
	// Vertical reactions carry the load and the self weight; sliding bearings take no thrust.
	const reaktion = r.reaktionenN.last;
	const vertikal = Object.values(reaktion).reduce((s, v) => s + v[2], 0);
	assert.ok(Math.abs(vertikal - 120000 - 1.35 * 9.81 * r.kennzahlen.masseKg) <= 1e-6 * 120000);
	assert.equal(reaktion['u:8:1'][0], 0);
	// The sized full grid is heavier than what remains after removal.
	const voll = abtragen(aufgabe, { stufe: 'kraefte' });
	assert.equal(voll.status, 'ok');
	if (voll.status === 'ok') {
		assert.equal(voll.staebe.length, aufgabe.kandidaten.length);
		assert.ok(r.kennzahlen.masseKg < voll.kennzahlen.masseKg);
	}
	// A domain without any member at the loaded node fails explicitly.
	const ohne = abtragen({
		...aufgabe,
		kandidaten: aufgabe.kandidaten.filter((k) => !k.id.includes('u:4:1'))
	});
	assert.deepEqual(ohne, { status: 'lastpfad-fehlt', elementId: 'u:4:1' });
});

test('S5: determinism: repetition and permuted input are byte-identical', () => {
	const aufgabe = brueckenAufgabe();
	const erwartet = JSON.stringify(abtragen(aufgabe));
	assert.equal(JSON.stringify(abtragen(brueckenAufgabe())), erwartet);
	const gedreht = <T>(liste: T[]) => [...liste.slice(7), ...liste.slice(0, 7)].reverse();
	const permutiert: Aufgabe = {
		...aufgabe,
		knoten: gedreht(aufgabe.knoten),
		kandidaten: gedreht(aufgabe.kandidaten),
		lager: [...aufgabe.lager].reverse(),
		lastfaelle: aufgabe.lastfaelle.map((l) => ({ ...l, lasten: [...l.lasten].reverse() }))
	};
	assert.equal(JSON.stringify(abtragen(permutiert)), erwartet);
	// Catalog sizes are monotone: a thicker rod is never weaker.
	assert.ok(rundstab(0.02).flaecheM2 > rundstab(0.016).flaecheM2);
});

/** Mirror image of a bridge member about the long axis (y → −y), as an order-free key. */
const gespiegelt = (id: string) =>
	id
		.split('|')
		.map((k) => {
			const [lage, x, y] = k.split(':');
			return lage === 'u' ? `u:${x}:${-Number(y)}` : k;
		})
		.sort()
		.join('|');
const paar = (id: string) => [id.split('|').sort().join('|'), gespiegelt(id)].sort()[0];

test('S6: group: mirror images are one component even when bearings and load are not', () => {
	// One-sided wind only and a single fixed bearing: the problem no longer mirrors in y.
	const schief = (): Aufgabe => {
		const a = brueckenAufgabe();
		return {
			...a,
			lager: a.lager.map((l, i) => (i === 1 ? { ...l, fest: [false, false, true] } : l)),
			lastfaelle: a.lastfaelle.filter((l) => l.id !== 'quer-')
		};
	};
	const pruefe = (aufgabe: Aufgabe) => {
		const r = abtragen(aufgabe);
		assert.equal(r.status, 'ok');
		if (r.status !== 'ok') return { spiegelt: false, r };
		const nach = new Map(r.staebe.map((s) => [s.id.split('|').sort().join('|'), s]));
		const spiegelt = r.staebe.every((s) => {
			const partner = nach.get(gespiegelt(s.id));
			return (
				partner?.querschnitt.durchmesserM === s.querschnitt.durchmesserM &&
				partner.zugN === s.zugN &&
				partner.druckN === s.druckN
			);
		});
		return { spiegelt, r };
	};
	assert.equal(pruefe(schief()).spiegelt, false);
	const aufgabe = schief();
	const gruppiert = pruefe({
		...aufgabe,
		kandidaten: aufgabe.kandidaten.map((k) => ({ ...k, gruppe: paar(k.id) }))
	});
	assert.equal(gruppiert.spiegelt, true);
	// Still a valid structure for the real, one-sided problem.
	if (gruppiert.r.status === 'ok')
		for (const s of gruppiert.r.staebe) assert.ok(s.ausnutzung <= 1 + 1e-9);
});

test('S7: state: a carrier that only stands with its load is a mechanism', () => {
	// A stiff body hangs below the bridge and ties the two lower chord nodes at midspan. Guides
	// keep it from swinging; they are part of the body and absent with it.
	const mitKoerper = (ohneQuerstab: boolean): Aufgabe => {
		const a = brueckenAufgabe();
		const k = (y: number): Knoten => ({ id: `k:${y}`, p: [4, y, -2] });
		return {
			...a,
			knoten: [...a.knoten, k(-1), k(1)],
			kandidaten: [
				...a.kandidaten.filter((c) => !ohneQuerstab || c.id !== 'u:4:-1|u:4:1'),
				{ id: 'k', a: 'k:-1', b: 'k:1', rolle: 'starr' },
				{ id: 'k:x', a: 'k:-1', b: 'u:4:1', rolle: 'starr' },
				{ id: 'h:-1', a: 'u:4:-1', b: 'k:-1', rolle: 'haenger' },
				{ id: 'h:1', a: 'u:4:1', b: 'k:1', rolle: 'haenger' }
			],
			lager: [
				...a.lager,
				...[-1, 1].map((y) => ({
					knotenId: `k:${y}`,
					fest: [true, true, false] as [boolean, boolean, boolean]
				}))
			],
			lastfaelle: [
				{
					id: 'last',
					eigengewichtG: [0, 0, -1.35],
					lasten: [-1, 1].map((y) => ({ knotenId: `k:${y}`, kraftN: [0, 0, -60000] as Vec3 }))
				}
			],
			gebrauch: undefined
		};
	};
	const zustand = { ohneKnoten: ['k:-1', 'k:1'], lastfaelle: [{ id: 'leer', lasten: [] }] };
	const voll = abtragen({ ...mitKoerper(false), zustaende: [zustand] }, { stufe: 'kraefte' });
	assert.equal(voll.status, 'ok');
	// With the state, removal keeps a carrier that stands without the body.
	const form = abtragen({ ...mitKoerper(false), zustaende: [zustand] });
	assert.equal(form.status, 'ok');
	if (form.status === 'ok') {
		const allein = loeseFachwerk(
			{
				knoten: brueckenAufgabe().knoten,
				staebe: form.staebe
					.filter((s) => s.rolle === 'tragstab')
					.map((s) => ({
						id: s.id,
						a: s.a,
						b: s.b,
						flaecheM2: s.querschnitt.flaecheM2,
						eModulPa: STAHL.eModulPa
					})),
				lager: brueckenAufgabe().lager
			},
			[{ id: 'leer', lasten: [] }]
		);
		assert.equal(allein.status, 'ok');
		// A state adds solver runs; the count stays a deterministic work measure.
		assert.ok(form.kennzahlen.laeufe > 0);
	}
});

test('S8: check: same struts, new load; a round rod in compression goes slack', () => {
	const aufgabe = brueckenAufgabe();
	const form = abtragen(aufgabe);
	assert.equal(form.status, 'ok');
	if (form.status !== 'ok') return;
	const querschnitte = Object.fromEntries(form.staebe.map((s) => [s.id, s.querschnitt]));
	const pruefe = (faktor: number) =>
		abtragen(
			{
				...aufgabe,
				lastfaelle: aufgabe.lastfaelle.map((l) => ({
					...l,
					lasten: l.lasten.map((x) => ({
						...x,
						kraftN: x.kraftN.map((v) => v * faktor) as Vec3
					}))
				}))
			},
			{ stufe: 'nachweis', querschnitte }
		);
	// The same load: same members, same sections, utilization as sized.
	const gleich = pruefe(1);
	assert.equal(gleich.status, 'ok');
	if (gleich.status !== 'ok') return;
	assert.deepEqual(
		gleich.staebe.map((s) => [s.id, s.querschnitt.durchmesserM]),
		form.staebe.map((s) => [s.id, s.querschnitt.durchmesserM])
	);
	assert.ok(Math.abs(gleich.kennzahlen.ausnutzungMax - form.kennzahlen.ausnutzungMax) < 1e-9);
	// Half the load uses less, three times the load is reported as overloaded, never resized.
	const halb = pruefe(0.5),
		dreifach = pruefe(3);
	assert.ok(
		halb.status === 'ok' && halb.kennzahlen.ausnutzungMax < gleich.kennzahlen.ausnutzungMax
	);
	assert.ok(dreifach.status === 'ok' && dreifach.kennzahlen.ausnutzungMax > 1);
	if (dreifach.status === 'ok')
		assert.equal(dreifach.kennzahlen.masseKg, gleich.kennzahlen.masseKg);
	// Reversed load: rods cannot push. Either they go slack and are reported, or the rest is no
	// structure any more and the check fails explicitly.
	const umgekehrt = pruefe(-1);
	if (umgekehrt.status === 'ok') {
		assert.ok(umgekehrt.staebe.some((s) => s.schlaff));
		for (const s of umgekehrt.staebe)
			if (s.querschnitt.art === 'rundstab') assert.equal(s.druckN, 0);
		assert.equal(umgekehrt.staebe.length, form.staebe.length);
	} else
		assert.ok(['mechanismus', 'zugstab-unter-druck', 'lager-hebt-ab'].includes(umgekehrt.status));
});

test('S9: pretension and a calm catalog', () => {
	// A hanger that a load case relieves a little stays taut if it was tightened by more.
	const haengend = (druckN: number, vorspannungN?: number): Aufgabe => ({
		knoten: [
			{ id: 'oben', p: [0, 0, 3] },
			{ id: 'unten', p: [0, 0, 0] }
		],
		kandidaten: [
			{
				id: 'h',
				a: 'oben',
				b: 'unten',
				rolle: 'haenger',
				...(vorspannungN ? { vorspannungN } : {})
			}
		],
		lager: [
			{ knotenId: 'oben', fest: FEST },
			{ knotenId: 'unten', fest: [true, true, false] }
		],
		lastfaelle: [
			{ id: 'last', lasten: [{ knotenId: 'unten', kraftN: [0, 0, -40000] }] },
			{ id: 'sog', lasten: [{ knotenId: 'unten', kraftN: [0, 0, druckN] }] }
		],
		werkstoff: STAHL
	});
	assert.equal(abtragen(haengend(2000)).status, 'zugstab-unter-druck');
	const gespannt = abtragen(haengend(2000, 5000));
	assert.equal(gespannt.status, 'ok');
	if (gespannt.status === 'ok') {
		// Sized for load plus pretension, no compression reported.
		assert.equal(gespannt.staebe[0].zugN, 45000);
		assert.equal(gespannt.staebe[0].druckN, 0);
	}
	assert.notEqual(abtragen(haengend(8000, 5000)).status, 'ok');
	// The calm catalog is a subset in steps: fewer sizes, never lighter.
	const fein = abtragen(brueckenAufgabe());
	const ruhig = abtragen(brueckenAufgabe(), { katalog: KATALOG_RUHIG });
	assert.ok(fein.status === 'ok' && ruhig.status === 'ok');
	if (fein.status !== 'ok' || ruhig.status !== 'ok') return;
	const stufen = (r: typeof fein) =>
		new Set(r.staebe.map((s) => `${s.querschnitt.art}:${s.querschnitt.durchmesserM}`));
	for (const s of stufen(ruhig)) {
		const [art, d] = s.split(':');
		assert.ok(
			(art === 'rohr' ? KATALOG_RUHIG.rohreM : KATALOG_RUHIG.rundstaebeM).includes(Number(d))
		);
	}
	assert.ok(stufen(ruhig).size <= stufen(fein).size);
	for (const s of ruhig.staebe) assert.ok(s.ausnutzung <= 1 + 1e-9);
});

for (const gruppiert of [false, true])
	test(`S10: bleibt protects ${gruppiert ? 'the whole mirror group' : 'a strut that would otherwise be removed'}`, () => {
		const aufgabe = brueckenAufgabe();
		if (gruppiert)
			aufgabe.kandidaten = aufgabe.kandidaten.map((s) => ({ ...s, gruppe: paar(s.id) }));
		const vorher = abtragen(aufgabe);
		assert.equal(vorher.status, 'ok');
		if (vorher.status !== 'ok') return;
		const ids = new Set(vorher.staebe.map((s) => s.id));
		const weg = aufgabe.kandidaten.find((s) => !ids.has(s.id));
		assert.ok(weg);
		weg.bleibt = true;
		const eingabe = JSON.stringify(aufgabe);
		const nachher = abtragen(aufgabe);
		assert.equal(nachher.status, 'ok');
		if (nachher.status !== 'ok') return;
		const nachIds = new Set(nachher.staebe.map((s) => s.id));
		for (const s of aufgabe.kandidaten)
			if (s.id === weg.id || (gruppiert && s.gruppe === weg.gruppe)) assert.ok(nachIds.has(s.id));
		assert.equal(JSON.stringify(aufgabe), eingabe);
		assert.deepEqual(
			abtragen({ ...aufgabe, kandidaten: [...aufgabe.kandidaten].reverse() }),
			nachher
		);
	});

test('S11: bleibt invents no stability for an unrestrained strut', () => {
	const aufgabe: Aufgabe = {
		knoten: [
			{ id: 'a', p: [0, 0, 0] },
			{ id: 'b', p: [1, 0, 0] }
		],
		kandidaten: [{ id: 'ab', a: 'a', b: 'b', rolle: 'tragstab', bleibt: true }],
		lager: [{ knotenId: 'a', fest: FEST }],
		lastfaelle: [{ id: 'g', lasten: [{ knotenId: 'b', kraftN: [0, 0, -1000] }] }],
		werkstoff: STAHL
	};
	assert.deepEqual(abtragen(aufgabe), { status: 'mechanismus', elementId: 'ab' });
});

test('S12: bleibt does not make a compressed hanger load-bearing', () => {
	const aufgabe: Aufgabe = {
		knoten: [
			{ id: 'a', p: [0, 0, 0] },
			{ id: 'b', p: [1, 0, 0] }
		],
		kandidaten: [{ id: 'ab', a: 'a', b: 'b', rolle: 'haenger', bleibt: true }],
		lager: [
			{ knotenId: 'a', fest: FEST },
			{ knotenId: 'b', fest: [false, true, true] }
		],
		lastfaelle: [{ id: 'druck', lasten: [{ knotenId: 'b', kraftN: [-1000, 0, 0] }] }],
		werkstoff: STAHL
	};
	assert.deepEqual(abtragen(aufgabe), { status: 'zugstab-unter-druck', elementId: 'ab' });
});
