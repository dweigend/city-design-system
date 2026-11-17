import { it as test } from 'node:test';
import { stegPrisma } from './haengehaus';
import type { Prisma } from './plan';
import { strict as assert } from 'node:assert';
import {
	AUFLAGER_TOLERANZ_M,
	FUGE_M,
	GARTEN_LICHT_M,
	abstandZurWand,
	einsetzen,
	kandidaten,
	neuBauen,
	pruefeEinbau,
	analysiere,
	belegungVon,
	eigengewichtN,
	entfernen,
	hausParameter,
	nachrechnen,
	nutzungSetzen,
	pruefeHaus,
	schneidet,
	tuerPrisma,
	type Bauplan
} from './index';
import { kantenId, type Vec3 } from '../traeger/plan';

/** Accepted examples: the hanging house whose carrier follows from the structural simulation. */
const haus = neuBauen('raumfachwerk');
function mitStatik(h: Bauplan) {
	assert.ok(h.statik && h.bestand);
	return { statik: h.statik, bestand: h.bestand };
}

test('H1: bearings sit on the wall crowns of the existing stock, no stilts', () => {
	const { statik, bestand } = mitStatik(haus);
	const lager = haus.traeger.knoten.filter((n) => n.rolle === 'lager');
	assert.equal(lager.length, 4);
	for (const n of lager) {
		assert.equal(n.p[2], FUGE_M);
		assert.ok(abstandZurWand(n.p, bestand) <= AUFLAGER_TOLERANZ_M);
		assert.ok(n.id.startsWith('raumfachwerk:k:'), 'bearing is a lattice node, not a stilt foot');
	}
	// Nothing below the joint, no stilts: the lattice itself comes down onto the crowns.
	assert.ok(haus.traeger.knoten.every((n) => n.p[2] >= FUGE_M));
	assert.ok(haus.traeger.kanten.every((k) => k.rolle === 'stab'));
	// The stock is given: two houses with a gap. Every shoe that carries is one of the bearings.
	assert.equal(bestand.koerper.length, 2);
	for (const l of statik.lager) assert.ok(lager.some((n) => n.id === l.knotenId));
	// Old walls only get vertical load: one fixed point, at most one guide, the rest slides.
	assert.equal(statik.lager.filter((l) => l.art === 'fest').length, 1);
	assert.ok(statik.lager.filter((l) => l.art === 'gefuehrt').length <= 1);
	for (const l of statik.lager) if (l.art === 'gleitend') assert.equal(l.schubN, 0);
	// The lower chord height is found, not set: it clears the planting space of the roof garden.
	const [raum, garten] = kandidaten(haus);
	const untergurt = Math.min(
		...haus.traeger.knoten.filter((n) => n.rolle !== 'lager').map((n) => n.p[2])
	);
	assert.ok(untergurt >= garten.z + GARTEN_LICHT_M);
	assert.equal(garten.z, raum.z + raum.hoeheM);
	// A lattice that cannot stand is an error, never a house.
	assert.throws(() => neuBauen('raumfachwerk', 42, { gurthoeheM: 0 }), RangeError);
});

test('H2: equilibrium and load path: the capsule hangs from its floor on tension rods', () => {
	const { statik } = mitStatik(haus);
	assert.ok(statik.kennzahlen.residuumN <= 1e-8 * statik.lastN);
	// The shoes together press at least as hard as the hanging load weighs.
	assert.ok(statik.lager.reduce((s, l) => s + l.druckN, 0) >= statik.lastN);
	const nachbarn = new Map<string, string[]>();
	for (const k of haus.traeger.kanten) {
		nachbarn.set(k.a, [...(nachbarn.get(k.a) ?? []), k.b]);
		nachbarn.set(k.b, [...(nachbarn.get(k.b) ?? []), k.a]);
	}
	const lager = new Set(statik.lager.map((l) => l.knotenId));
	const [raum] = kandidaten(haus);
	const haenger = statik.haenger.filter((h) => !h.druck);
	const halter = statik.haenger.filter((h) => h.druck);
	for (const h of statik.haenger) {
		const erreicht = new Set([h.knotenId]);
		const offen = [h.knotenId];
		for (let id = offen.pop(); id !== undefined; id = offen.pop())
			for (const n of nachbarn.get(id) ?? [])
				if (!erreicht.has(n)) {
					erreicht.add(n);
					offen.push(n);
				}
		assert.ok([...lager].some((id) => erreicht.has(id)));
	}
	// Hangers run outside the shell from the capsule floor up to a carrier node above the roof.
	const halbeBreite = Math.max(...raum.polygon.map((p) => p[1]));
	for (const h of haenger) {
		const oben = haus.traeger.knoten.find((n) => n.id === h.knotenId);
		assert.ok(oben);
		assert.equal(h.p[2], raum.z);
		assert.ok(oben.p[2] > raum.z + raum.hoeheM);
		assert.ok(Math.abs(h.p[1]) >= halbeBreite - 1e-9 && Math.abs(oben.p[1]) > halbeBreite);
		assert.ok(h.zugN > 0);
		assert.equal(h.druckN, 0);
	}
	// Every floor rib hangs by itself, at both ends: the shell is no beam.
	assert.equal(statik.rippen.length, haus.traeger.werte.felder);
	for (const rippe of statik.rippen)
		for (const fuss of rippe)
			assert.ok(
				haenger.some((h) => h.p.every((v, i) => v === fuss[i])),
				`Rippe ${fuss}`
			);
	// Hangers carry the weight: their vertical pull under full load is the hanging load. The wind
	// holders are level and carry none of it.
	assert.ok(halter.length >= 2 && halter.length <= 4);
	for (const h of halter) {
		const oben = haus.traeger.knoten.find((n) => n.id === h.knotenId);
		assert.equal(oben?.p[2], h.p[2]);
	}
});

test('H3: sizing: utilization ≤ 1, tension as rod, compression as tube, few cross-sections', () => {
	const { statik } = mitStatik(haus);
	const alle = [...Object.values(statik.staebe), ...statik.haenger];
	assert.equal(statik.belegung, 'bemessung');
	assert.equal(Object.keys(statik.staebe).length, haus.traeger.kanten.length);
	for (const s of alle) {
		assert.ok(s.ausnutzung <= 1 + 1e-9);
		assert.equal(s.druck, s.druckN > 0);
		assert.equal(s.schlaff, undefined);
	}
	// The largest utilization is close to the limit: the catalog is used, not padded.
	assert.ok(statik.kennzahlen.ausnutzungMax > 0.8);
	// One kit: a handful of section sizes for the whole house (measured: 5 to 7; fine catalog 9 to 13).
	assert.ok(new Set(alle.map((s) => `${s.druck}:${s.durchmesserM}`)).size <= 8);
	assert.ok(statik.kennzahlen.durchbiegungM <= statik.spannweiteM / 300);
});

test('H4: from full candidate grid to form: forces change no topology, pruning only removes', () => {
	const block = neuBauen('raumfachwerk', 42, {}, 'block');
	const kraefte = neuBauen('raumfachwerk', 42, {}, 'kraefte');
	assert.equal(block.statik, undefined);
	assert.deepEqual(
		kraefte.traeger.kanten.map((k) => k.id),
		block.traeger.kanten.map((k) => k.id)
	);
	const ids = new Set(block.traeger.kanten.map((k) => k.id));
	assert.ok(haus.traeger.kanten.every((k) => ids.has(k.id)));
	// The trapezoid lattice of version 3 starts lean: the removal takes about a sixth (71 of 86).
	assert.ok(haus.traeger.kanten.length < 0.9 * block.traeger.kanten.length);
	assert.ok(
		mitStatik(haus).statik.kennzahlen.masseKg < mitStatik(kraefte).statik.kennzahlen.masseKg
	);
	// The room keeps its identity through all stages; infills survive a change of stage.
	for (const h of [block, kraefte]) assert.equal(kandidaten(h)[0].id, kandidaten(haus)[0].id);
	assert.equal(JSON.stringify(neuBauen('raumfachwerk')), JSON.stringify(haus));
});

test('H5: clear spaces stay clear; a strut in the planting space rejects the garden', () => {
	const [raum, garten] = kandidaten(haus);
	assert.equal(garten.art, 'garten');
	const ort = new Map(haus.traeger.knoten.map((n) => [n.id, n.p]));
	const pflanzraum = { ...garten, hoeheM: GARTEN_LICHT_M };
	for (const k of haus.traeger.kanten) {
		const a = ort.get(k.a),
			b = ort.get(k.b);
		assert.ok(a && b);
		for (const frei of [raum, pflanzraum, tuerPrisma(raum.tuer)])
			assert.equal(schneidet(a, b, frei), false);
	}
	const bewohnt = einsetzen(haus, raum.id, 'people').plan;
	const mitGarten = einsetzen(bewohnt, garten.id, 'food');
	assert.equal(mitGarten.fehler, undefined);
	assert.deepEqual(pruefeHaus(mitGarten.plan), []);
	// Lower one chord node into the planting space: the garden rule moves with the chord.
	const tief = raum.elementId;
	const mitte = raum.polygon.reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]);
	const gesenkt: Bauplan = {
		...bewohnt,
		traeger: {
			...bewohnt.traeger,
			knoten: bewohnt.traeger.knoten.map((n) =>
				n.id === tief
					? {
							...n,
							p: [
								mitte[0] / raum.polygon.length,
								mitte[1] / raum.polygon.length,
								garten.z + GARTEN_LICHT_M / 2
							] as [number, number, number]
						}
					: n
			)
		}
	};
	assert.equal(pruefeEinbau(gesenkt, garten), 'kollision');
	const abgewiesen = einsetzen(gesenkt, garten.id, 'food');
	assert.equal(abgewiesen.fehler, 'kollision');
	assert.equal(abgewiesen.plan, gesenkt);
});

/** Mirror image of a segment about midspan (`sx`) and about the capsule axis (`sy`), as a key. */
const bild = (a: Vec3, b: Vec3, sx: number, sy: number) =>
	[a, b]
		.map((p) => [sx * p[0], sy * p[1], p[2]].map((v) => Math.round(v * 1e6) + 0).join(','))
		.sort()
		.join('|');

test('H6: a mirrored lattice stays mirrored: struts, cross-sections and forces in pairs', () => {
	for (const saat of [42, 7, 1234]) {
		const h = neuBauen('raumfachwerk', saat);
		const { statik } = mitStatik(h);
		const ort = new Map(h.traeger.knoten.map((n) => [n.id, n.p]));
		const teile = [
			...h.traeger.kanten.map((k) => ({
				a: ort.get(k.a) as Vec3,
				b: ort.get(k.b) as Vec3,
				s: statik.staebe[k.id]
			})),
			// The two wind holders sit on one side of the axis by rule; they mirror about midspan only.
			...statik.haenger.map((x) => ({ a: ort.get(x.knotenId) as Vec3, b: x.p, s: x }))
		];
		const nach = new Map(teile.map((t) => [bild(t.a, t.b, 1, 1), t.s]));
		for (const t of teile)
			for (const [sx, sy] of [
				[-1, 1],
				[1, -1],
				[-1, -1]
			]) {
				const einseitig = t.s.druck && Math.abs(t.a[2] - t.b[2]) < 1e-9 && t.a[0] === t.b[0];
				if (einseitig && sy < 0 && 'knotenId' in t.s) continue;
				const partner = nach.get(bild(t.a, t.b, sx, sy));
				assert.ok(partner, `seed ${saat}: no mirror partner`);
				assert.equal(partner.durchmesserM, t.s.durchmesserM);
				assert.equal(partner.druck, t.s.druck);
				assert.equal(partner.zugN, t.s.zugN);
				assert.equal(partner.druckN, t.s.druckN);
			}
		// The lattice is centered over the gap and parallel to the span.
		const [links, rechts] = mitStatik(h).bestand.koerper;
		assert.ok(Math.abs(links.x + links.breiteM + rechts.x) < 1e-9);
		for (const l of h.traeger.knoten.filter((n) => n.rolle === 'lager'))
			assert.ok(Math.abs(Math.abs(l.p[0]) - statik.spannweiteM / 2) < 1e-9);
	}
});

test('H7: the seed decides gap, division, chord height and house depth, nothing else', () => {
	const p42 = hausParameter(42);
	assert.deepEqual(hausParameter(42), p42);
	assert.deepEqual(neuBauen('raumfachwerk', 42).traeger.werte, p42);
	// Three seeds, three different houses; before version 2 they were identical.
	const kennzahlen = [42, 7, 1234].map((saat) => {
		const h = neuBauen('raumfachwerk', saat);
		return `${h.statik?.spannweiteM}:${h.traeger.kanten.length}:${h.statik?.kennzahlen.masseKg}`;
	});
	assert.equal(new Set(kennzahlen).size, 3);
	// Within the rules for every seed: fields between 3 and 4.2 m, the capsule fills the gap.
	const klassen = new Map<string, number>();
	for (let saat = 0; saat < 300; saat++) {
		const p = hausParameter(saat);
		assert.ok(p.lueckeM / p.felder >= 3 && p.lueckeM / p.felder <= 4.2);
		klassen.set(JSON.stringify(p), saat);
	}
	assert.ok(klassen.size > 20);
	// Same parameters, same house, whatever the seed.
	const zwilling = [...Array(2000).keys()].find(
		(saat) => saat !== 42 && JSON.stringify(hausParameter(saat)) === JSON.stringify(p42)
	);
	assert.ok(zwilling !== undefined);
	const a = neuBauen('raumfachwerk', 42),
		b = neuBauen('raumfachwerk', zwilling);
	assert.deepEqual(b.statik, a.statik);
	assert.deepEqual(b.traeger.kanten, a.traeger.kanten);
	// A parameter can be set against the seed.
	assert.equal(neuBauen('raumfachwerk', 42, { lueckeM: 12, felder: 4 }).statik?.spannweiteM, 12);
});

test('H8: conversion changes the load, not the form: recheck per occupancy', () => {
	const [raum, garten] = kandidaten(haus);
	const bemessung = mitStatik(haus).statik;
	const bewohnt = nachrechnen(
		einsetzen(einsetzen(haus, raum.id, 'people').plan, garten.id, 'food').plan
	);
	const wohnen = mitStatik(bewohnt).statik;
	assert.deepEqual(wohnen.belegung, { raum: 'people', garten: true });
	assert.deepEqual(belegungVon(bewohnt), wohnen.belegung);
	// Same carrier, same sections; carrier and infills keep their identity.
	assert.equal(bewohnt.traeger, haus.traeger);
	for (const [id, s] of Object.entries(wohnen.staebe)) {
		assert.equal(s.durchmesserM, bemessung.staebe[id].durchmesserM);
		assert.equal(s.druck, bemessung.staebe[id].druck);
	}
	// Dwelling is lighter than the sizing load, so nothing is used more than it was sized for.
	assert.ok(wohnen.lastN < bemessung.lastN);
	assert.ok(wohnen.kennzahlen.ausnutzungMax <= bemessung.kennzahlen.ausnutzungMax + 1e-9);
	// A workshop is the sizing load itself.
	const einbau = bewohnt.einbauten.find((e) => e.anschlussId === raum.id);
	assert.ok(einbau);
	const werkstatt = mitStatik(nachrechnen(nutzungSetzen(bewohnt, einbau.id, 'material').plan));
	assert.ok(Math.abs(werkstatt.statik.lastN - bemessung.lastN) < 1e-6);
	assert.ok(werkstatt.statik.kennzahlen.ausnutzungMax <= 1 + 1e-9);
	assert.ok(werkstatt.statik.kennzahlen.ausnutzungMax > wohnen.kennzahlen.ausnutzungMax);
	// The action alone leaves the old forces in place; they name the occupancy they belong to.
	const ohneGarten = entfernen(bewohnt, `${garten.elementId}/einbau`).plan;
	assert.equal(ohneGarten.statik, bewohnt.statik);
	assert.notDeepEqual(belegungVon(ohneGarten), ohneGarten.statik?.belegung);
	assert.ok(mitStatik(nachrechnen(ohneGarten)).statik.lastN < wohnen.lastN);
	// Capsule taken out: the carrier stands by itself, the hangers stay and carry nothing.
	const leer = mitStatik(nachrechnen(entfernen(bewohnt, einbau.id).plan)).statik;
	assert.deepEqual(leer.belegung, { raum: 'leer', garten: false });
	assert.equal(leer.lastN, 0);
	assert.equal(leer.haenger.length, bemessung.haenger.length);
	assert.ok(leer.haenger.every((h) => h.zugN === 0 && h.druckN === 0));
	assert.ok(leer.lager.reduce((s, l) => s + l.druckN, 0) > 0);
	assert.ok(leer.kennzahlen.ausnutzungMax < wohnen.kennzahlen.ausnutzungMax);
	// Every seed class stands under every occupancy the page offers.
	for (const saat of [7, 1234]) {
		const h = neuBauen('raumfachwerk', saat);
		const [r, g] = kandidaten(h);
		let plan = einsetzen(einsetzen(h, r.id, 'material').plan, g.id, 'food').plan;
		assert.ok(mitStatik(nachrechnen(plan)).statik.kennzahlen.ausnutzungMax <= 1 + 1e-9);
		plan = entfernen(plan, `${r.elementId}/einbau`).plan;
		assert.equal(mitStatik(nachrechnen(plan)).statik.lastN, 0);
	}
});

test('H9: trapezoid truss: raking end posts, no plumb strut at the shoe, mirroring stays', () => {
	for (const saat of [42, 7, 1234]) {
		const h = neuBauen('raumfachwerk', saat);
		const { statik } = mitStatik(h);
		const ort = new Map(h.traeger.knoten.map((n) => [n.id, n.p]));
		const { lueckeM, felder } = hausParameter(saat);
		const feldM = lueckeM / felder;
		const schuhe = h.traeger.knoten.filter((n) => n.rolle === 'lager');
		const obergurtZ = Math.max(...h.traeger.knoten.map((n) => n.p[2]));
		// Bridge silhouette: nothing overhangs the shoes, the upper chord starts one field inside.
		for (const n of h.traeger.knoten) {
			assert.ok(Math.abs(n.p[0]) <= lueckeM / 2 + 1e-9, `seed ${saat}: overhang`);
			if (n.p[2] === obergurtZ)
				assert.ok(
					Math.abs(n.p[0]) <= lueckeM / 2 - feldM + 1e-9,
					`seed ${saat}: upper chord at the shoe`
				);
		}
		const segmente = new Set<string>();
		for (const k of h.traeger.kanten)
			segmente.add(bild(ort.get(k.a) as Vec3, ort.get(k.b) as Vec3, 1, 1));
		for (const schuh of schuhe) {
			const anSchuh = h.traeger.kanten.filter((k) => k.a === schuh.id || k.b === schuh.id);
			let stiele = 0;
			for (const k of anSchuh) {
				const p = ort.get(k.a === schuh.id ? k.b : k.a) as Vec3;
				// No member at a shoe is plumb: each leans into the span by at least half a field.
				assert.ok(
					Math.abs(schuh.p[0]) - Math.abs(p[0]) >= feldM / 2 - 1e-9,
					`seed ${saat}: plumb strut at the shoe`
				);
				// The end post is the member to the upper chord: a tube that only pushes.
				if (p[2] !== obergurtZ) continue;
				stiele++;
				assert.equal(statik.staebe[k.id].druck, true);
				assert.ok(statik.staebe[k.id].druckN > statik.staebe[k.id].zugN);
			}
			assert.equal(stiele, 1, `seed ${saat}: one end post per shoe`);
			// A sliding shoe takes no thrust: a member in tension ties the raking post back.
			assert.ok(anSchuh.some((k) => !statik.staebe[k.id].druck));
		}
		// Mirrored about midspan and about the capsule axis, member for member.
		for (const k of h.traeger.kanten)
			for (const [sx, sy] of [
				[-1, 1],
				[1, -1]
			])
				assert.ok(
					segmente.has(bild(ort.get(k.a) as Vec3, ort.get(k.b) as Vec3, sx, sy)),
					`seed ${saat}: no mirror image`
				);
	}
});

test('H10: deformation classes follow the span; an empty house states its dead load', () => {
	for (const saat of [42, 7, 1234]) {
		const h = neuBauen('raumfachwerk', saat);
		const [raum, garten] = kandidaten(h);
		const bewohnt = nachrechnen(
			einsetzen(einsetzen(h, raum.id, 'people').plan, garten.id, 'food').plan
		);
		const analyse = analysiere(bewohnt, 'verformung');
		assert.ok(analyse);
		// Eighths of the permitted deflection (span / 300), in whole millimeters.
		const zulaessigM = mitStatik(bewohnt).statik.spannweiteM / 300;
		const schritt = analyse.klassen[0].bis;
		assert.equal(Math.round(schritt * 1e3), Math.round((zulaessigM * 1e3) / 8));
		assert.equal(analyse.klassen.length, 5);
		assert.equal(analyse.klassen.at(-1)?.bis, Infinity);
		assert.equal(analyse.automatisch, false);
		// The picture uses the scale: at least three classes carry members (R2: only two did).
		assert.ok(new Set(analyse.strecken.map((s) => s.klasse)).size >= 3, `Saat ${saat}`);
	}
	const kurz = analysiere(neuBauen('raumfachwerk', 1234), 'verformung');
	const lang = analysiere(haus, 'verformung');
	assert.ok(kurz && lang && kurz.klassen[1].von < lang.klassen[1].von);
	// Capsule taken out: no hanging load, but the shoes still carry the steel.
	const [raum] = kandidaten(haus);
	const leer = mitStatik(
		nachrechnen(entfernen(einsetzen(haus, raum.id, 'people').plan, `${raum.elementId}/einbau`).plan)
	).statik;
	assert.equal(leer.lastN, 0);
	assert.ok(eigengewichtN(leer) > 0);
	assert.ok(Math.abs(eigengewichtN(leer) - leer.kennzahlen.masseKg * 9.81) < 1e-6);
	assert.ok(leer.lager.reduce((s, l) => s + l.druckN, 0) >= eigengewichtN(leer));
});

// H11 builds and solves 83 houses (about 5 s on an idle machine), so the default 5 s budget is
// too tight on loaded hosts and CI runners. The budget covers runtime only; the assertions are unchanged.
const H11_TIMEOUT_MS = 60_000;

test(
	'H11: the upper chord stays continuous and mirrored in all 81 seed classes',
	{ timeout: H11_TIMEOUT_MS },
	() => {
		const klassen = new Map<string, number>();
		for (let saat = 0; saat < 10000; saat++) {
			const key = JSON.stringify(hausParameter(saat));
			if (!klassen.has(key)) klassen.set(key, saat);
		}
		assert.equal(klassen.size, 81);
		for (const saat of new Set([7, 3, ...klassen.values()])) {
			const h = neuBauen('raumfachwerk', saat);
			const ort = new Map(h.traeger.knoten.map((n) => [n.id, n.p]));
			const ids = new Set(h.traeger.kanten.map((k) => k.id));
			for (const j of [-1, 0, 1])
				for (let i = 1; i < hausParameter(saat).felder - 1; i++) {
					const id = kantenId(`raumfachwerk:k:o:${i}:${j}`, `raumfachwerk:k:o:${i + 1}:${j}`);
					assert.ok(ids.has(id), `seed ${saat}: upper chord missing ${id}`);
				}
			const teile = new Map(
				h.traeger.kanten.map((k) => [bild(ort.get(k.a) as Vec3, ort.get(k.b) as Vec3, 1, 1), k])
			);
			const { statik } = mitStatik(h);
			for (const k of h.traeger.kanten)
				for (const [sx, sy] of [
					[-1, 1],
					[1, -1]
				]) {
					const partner = teile.get(bild(ort.get(k.a) as Vec3, ort.get(k.b) as Vec3, sx, sy));
					assert.ok(partner, `seed ${saat}: mirror partner missing`);
					assert.deepEqual(statik.staebe[partner.id], statik.staebe[k.id]);
				}
			assert.ok(statik.kennzahlen.ausnutzungMax <= 1 + 1e-9);
		}
	}
);

test('H12: the footbridge reserve used by the generator detects a strut through its middle', () => {
	for (const saat of [42, 7, 1234]) {
		const [raum] = kandidaten(neuBauen('raumfachwerk', saat));
		const steg = stegPrisma(raum.tuer);
		const flaeche = (r: Prisma) =>
			r.polygon.reduce((sum, a, i) => {
				const b = r.polygon[(i + 1) % r.polygon.length];
				return sum + a[0] * b[1] - b[0] * a[1];
			}, 0) / 2;
		assert.ok(Math.abs(Math.abs(flaeche(steg)) - 1.6 * 4) < 1e-9);
		assert.equal(steg.z, FUGE_M);
		const [tx, ty] = raum.tuer.tangente;
		const [x, y] = steg.polygon.reduce(([x, y], p) => [x + p[0] / 4, y + p[1] / 4], [0, 0]);
		// Positive control: this must hit even though accepted carrier members miss the prism.
		assert.equal(schneidet([x, y, 7], [x, y, 11], steg), true);
		assert.ok(flaeche(steg) > 0, 'world polygon runs counterclockwise');
		assert.equal(steg.hoeheM, 2.1);
		// Just outside the existing width and just beyond the existing length must stay clear.
		assert.equal(
			schneidet([x + tx * 0.81, y + ty * 0.81, 7], [x + tx * 0.81, y + ty * 0.81, 11], steg),
			false
		);
		assert.equal(
			schneidet([x + ty * 2.01, y - tx * 2.01, 7], [x + ty * 2.01, y - tx * 2.01, 11], steg),
			false
		);
	}
});
