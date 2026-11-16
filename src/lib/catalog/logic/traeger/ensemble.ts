import { hausAst } from './integration/hochwegnetz';
import type { Bauplan, HausFamilie, Stufe } from '../haus-tragwerk';
import {
	neuBauen,
	kandidaten,
	einsetzen,
	hausBelegung,
	nachrechnen,
	ZUGANG_LAENGE_M
} from '../haus-tragwerk';
/** The single composition of the five autonomous structural families (A-42). Dimensions in meters. */
import { familie, loopZiel, planen, type TraegerPlan, type Vec3 } from './index';
import { box, type Primitive } from '../parametrik/types';
import { bestandDetails } from '../parametrik/formen/eckbestand';
import type { TraegerFamilieText } from '../../data/traeger';
export type EnsembleFokus = 'alle' | TraegerFamilieText;
export type EnsemblePlan = {
	plan: TraegerPlan;
	familie: TraegerFamilieText;
	lage: { versatz: Vec3; drehungRad: number };
	fokus: boolean;
};
const ids: TraegerFamilieText[] = ['faltwerk', 'kuppel', 'wabe', 'raumfachwerk', 'gitterschale'];
const HOCHWEG_M = 8;
function grenzen(plan: TraegerPlan, drehungRad = 0) {
	const punkte = plan.knoten.map(({ p: [x, y, z] }) => [
		x * Math.cos(drehungRad) - y * Math.sin(drehungRad),
		x * Math.sin(drehungRad) + y * Math.cos(drehungRad),
		z
	]);
	const min = [0, 1, 2].map((i) => Math.min(...punkte.map((p) => p[i])));
	const max = [0, 1, 2].map((i) => Math.max(...punkte.map((p) => p[i])));
	return { min, breite: max[0] - min[0], tiefe: max[1] - min[1] };
}
/** Four reading cases and seed/focus invariance are executable in ensemble.test.ts. */
export function stadtstueck(saat = 42, fokus: EnsembleFokus = 'alle') {
	const plaene: EnsemblePlan[] = ids.map((id) => {
		const f = familie(id);
		const original = planen(id, loopZiel(f, f.loop.length - 1), saat);
		// The shared city image shows three flows; the single experiments show all
		// uses of their family. Uses not shown stay neutral.
		const plan = {
			...original,
			belegung: Object.fromEntries(
				Object.entries(original.belegung).map(([ziel, strom]) => [
					ziel,
					strom === 'material' || strom === 'water' ? 'leer' : strom
				])
			)
		};
		return {
			familie: id,
			plan,
			lage: { versatz: [0, 0, 0], drehungRad: 0 },
			fokus: fokus === 'alle' || fokus === id
		};
	});
	// The longer shell axis lies across the image; a new wavy
	// footprint, too, is rotated solely by its supplied extent.
	const schalenMass = grenzen(plaene[4].plan);
	if (schalenMass.tiefe > schalenMass.breite) plaene[4].lage.drehungRad = Math.PI / 2;
	const masse = plaene.map((p) => grenzen(p.plan, p.lage.drehungRad));
	// Offset courtyards: the shell stands outside on the left, the truss behind it in
	// the middle. All distances follow the actual footprints.
	const hofY = Math.max(masse[0].tiefe, masse[1].tiefe) + 22;
	const kuppelX = masse[0].breite + 18;
	const wabeX = kuppelX + masse[1].breite + 18;
	const wabeY = Math.min(0, hofY - masse[2].tiefe - 3);
	const orte = [
		[0, 0],
		[kuppelX, 0],
		[wabeX, wabeY],
		[masse[4].breite + 18, hofY],
		[0, hofY]
	];
	plaene.forEach((p, i) => {
		p.lage.versatz = [orte[i][0] - masse[i].min[0], orte[i][1] - masse[i].min[1], i === 0 ? 8 : 0];
	});
	const bestand: Primitive[] = [];
	function haus(
		id: string,
		x: number,
		y: number,
		w: number,
		d: number,
		geschosse = 2,
		dach = false
	) {
		const outline: [number, number][] = [
			[x, y],
			[x + w, y],
			[x + w, y + d],
			[x, y + d]
		];
		bestand.push(box(`bestand:${id}`, [x, y, 0], [w, d, geschosse * 4], '--paper', 'bestand'));
		// Existing punched-facade/roof primitives from parametrik/formen/eckbestand.
		bestand.push(
			...bestandDetails({
				id,
				cells: [],
				outline,
				center: [x + w / 2, y + d / 2],
				levels: geschosse,
				first: 0,
				dach: dach ? 'sattel' : null,
				fassaden: outline.map((a, i) => ({
					a,
					b: outline[(i + 1) % 4],
					out: (
						[
							[0, -1],
							[1, 0],
							[0, 1],
							[-1, 0]
						] as [number, number][]
					)[i],
					levels: Array.from({ length: geschosse }, (_, j) => j)
				}))
			})
		);
	}
	const [falt, , wabe, raum, schale] = plaene.map((p, i) => ({
		x: p.lage.versatz[0] + masse[i].min[0],
		y: p.lage.versatz[1] + masse[i].min[1],
		...masse[i]
	}));
	haus('faltwerk', falt.x, falt.y, falt.breite, falt.tiefe);
	haus('wabe-links', wabe.x - 6, wabe.y, 5, wabe.tiefe, 3, true);
	haus('wabe-rechts', wabe.x + wabe.breite + 1, wabe.y, 4, wabe.tiefe, 2, true);
	haus(
		'bruecke-links',
		raum.x + 2,
		raum.y + 1,
		Math.max(3, raum.breite * 0.28),
		Math.max(3, raum.tiefe - 2),
		1
	);
	haus(
		'bruecke-rechts',
		raum.x + raum.breite * 0.63,
		raum.y + 1,
		Math.max(3, raum.breite * 0.28),
		Math.max(3, raum.tiefe - 2),
		1
	);
	haus('hof-links', schale.x - 4, schale.y, 3, schale.tiefe, 2, true);
	haus('hof-hinten', schale.x - 4, schale.y + schale.tiefe + 1, schale.breite + 8, 5, 3, true);
	haus('hof-vorne', falt.x, falt.y + falt.tiefe + 3, 10, Math.max(4, hofY - falt.tiefe - 6), 2);
	haus('fachwerk-hinten', raum.x, raum.y + raum.tiefe + 3, raum.breite, 6, 2, true);
	haus('wabe-hinten', wabe.x + 10, wabe.y + wabe.tiefe + 3, 10, 8, 2, true);
	const hochweg: Primitive[] = [];
	const mitteY = hofY - 2.5;
	function steg(id: string, x: number, y: number, w: number, d: number) {
		hochweg.push(box(`hochweg:${id}`, [x, y, HOCHWEG_M - 0.25], [w, d, 0.25], '--paper'));
		for (const seite of [0, 1])
			hochweg.push({
				id: `hochweg:${id}:handlauf:${seite}`,
				kind: 'polyline',
				role: 'neu',
				token: '--cat-business',
				material: 'metal',
				points: [
					[x, y + seite * d, 9],
					[x + w, y + seite * d, 9]
				]
			});
	}
	const gesamtBreite = wabeX + masse[2].breite;
	steg('quer', 0, mitteY, gesamtBreite, 1.6);
	plaene.forEach((p, i) => {
		const m = masse[i],
			x = p.lage.versatz[0] + m.min[0] + m.breite / 2,
			y = p.lage.versatz[1] + m.min[1] + (i < 3 ? m.tiefe : 0);
		const start = Math.min(y, mitteY),
			ende = Math.max(y, mitteY + 1.6);
		hochweg.push(
			box(`hochweg:ast:${p.familie}`, [x - 0.8, start, 7.75], [1.6, ende - start, 0.25], '--paper')
		);
		for (const [seite, s] of [-0.8, 0.8].entries())
			hochweg.push({
				id: `hochweg:ast:${p.familie}:handlauf:${seite}`,
				kind: 'polyline',
				role: 'neu',
				token: '--cat-business',
				material: 'metal',
				points: [
					[x + s, start, 9],
					[x + s, ende, 9]
				]
			});
	});
	const figuren: Vec3[] = [
		[4, mitteY + 0.8, 8],
		[gesamtBreite * 0.5, mitteY + 0.8, 8],
		[gesamtBreite - 4, mitteY + 0.8, 8],
		[plaene[1].lage.versatz[0] + masse[1].min[0], -1.2, 0]
	];
	return { plaene, bestand, hochweg, figuren, view: undefined };
}

/**
 * One inhabited house: rooms set in, a roof garden on top, entrance at the first room.
 * `stufe` only concerns families whose carrier follows from the structural simulation.
 */
export function bewohntesHaus(familie: HausFamilie, saat = 42, stufe: Stufe = 'abtrag'): Bauplan {
	let haus = neuBauen(familie, saat, {}, stufe);
	const rooms = kandidaten(haus).filter((a) => a.art === 'raum');
	const chosen =
		familie === 'wabe'
			? rooms
					.filter((a) => a.z === 8)
					.sort((a, b) => a.tuer.p[0] + a.tuer.p[1] - b.tuer.p[0] - b.tuer.p[1])
					.slice(0, 3)
			: rooms.slice(0, 1);
	for (const a of chosen) haus = einsetzen(haus, a.id, 'people').plan;
	const roof = kandidaten(haus).find((a) => a.art === 'garten');
	if (roof) {
		const below = rooms.find((a) => `${a.elementId}/einbau` === roof.traegt);
		if (below) haus = einsetzen(haus, below.id, 'people').plan;
		haus = einsetzen(haus, roof.id, 'food').plan;
	}
	const first = chosen[0];
	// Where the form was simulated, the forces shown belong to this occupancy.
	haus = nachrechnen(haus);
	return first ? { ...haus, eingang: { ...haus.eingang, p: first.tuer.p } } : haus;
}

/** Same composition, occupied houses are a separate view of the retained carrier fixtures. */
export function hausStadtstueck(saat = 42, fokus: EnsembleFokus = 'alle') {
	const stadt = stadtstueck(saat, fokus);
	const plaene = stadt.plaene.map((e) => {
		if (e.familie === 'gitterschale') return e;
		const haus = bewohntesHaus(e.familie, saat);
		return {
			...e,
			haus,
			plan: { ...haus.traeger, belegung: hausBelegung(haus) },
			lage: { ...e.lage, versatz: [e.lage.versatz[0], e.lage.versatz[1], 0] as Vec3 }
		};
	});
	return { ...stadt, plaene };
}

/** Two-story existing houses, with wall axes retained independently of their rendering. */
export function hausKontext(haus: Bauplan) {
	const supports = haus.traeger.knoten.filter((n) => n.rolle === 'lager');
	const min = [0, 1].map((i) => Math.min(...supports.map((n) => n.p[i])));
	const max = [0, 1].map((i) => Math.max(...supports.map((n) => n.p[i])));
	// Where the stock is an input of the design it is drawn as given, never derived from bearings.
	const bodies: [number, number, number, number][] = haus.bestand
		? haus.bestand.koerper.map((k) => [k.x, k.y, k.breiteM, k.tiefeM])
		: [
				[
					min[0],
					min[1] - (haus.familie === 'faltwerk' ? 4 : 0),
					max[0] - min[0],
					max[1] - min[1] + (haus.familie === 'faltwerk' ? 4 : 0)
				]
			];
	const bestand: Primitive[] = [];
	const wandachsen: [Vec3, Vec3][] = [];
	for (const [i, [x, y, w, d]] of bodies.entries()) {
		const outline: [number, number][] = [
			[x, y],
			[x + w, y],
			[x + w, y + d],
			[x, y + d]
		];
		bestand.push(box(`bestand:haus:${i}`, [x, y, 0], [w, d, 8], '--paper', 'bestand'));
		bestand.push(
			...bestandDetails({
				id: `haus:${i}`,
				cells: [],
				outline,
				center: [x + w / 2, y + d / 2],
				levels: 2,
				first: 0,
				dach: null,
				fassaden: outline.map((a, j) => ({
					a,
					b: outline[(j + 1) % 4],
					out: [
						[0, -1],
						[1, 0],
						[0, 1],
						[-1, 0]
					][j] as [number, number],
					levels: [0, 1]
				}))
			})
		);
		for (const z of [4, 8])
			bestand.push({
				id: `bestand:gesims:${i}:${z}`,
				kind: 'polyline',
				points: outline.map(([a, b]) => [a, b, z]),
				closed: true,
				token: '--paper',
				role: 'bestand',
				material: 'concrete'
			});
		// Bearing wall lines follow actual crowns; internal party walls are valid wall axes.
		for (const a of outline) {
			const b = outline[(outline.indexOf(a) + 1) % 4];
			wandachsen.push([
				[...a, 8],
				[...b, 8]
			]);
		}
	}
	// Party-wall crowns follow the carrier's ground-floor plan, independently of bearing labels.
	const nodes = new Map(haus.traeger.knoten.map((n) => [n.id, n.p]));
	for (const f of haus.traeger.flaechen.filter((f) => f.rolle === 'boden')) {
		const ring = f.knoten.flatMap((id) => {
			const p = nodes.get(id);
			return p && Math.abs(p[2] - 8) < 1e-8 ? [p] : [];
		});
		if (ring.length !== f.knoten.length) continue;
		ring.forEach((a, i) => wandachsen.push([a, ring[(i + 1) % ring.length]]));
	}

	const door = haus.anschluesse.find((a) => a.art === 'raum' && a.z === 8)?.tuer;
	const tangente = door?.tangente ?? [1, 0];
	const figur: Vec3 = [
		haus.eingang.p[0] + tangente[1] * 1.3,
		haus.eingang.p[1] - tangente[0] * 1.3,
		8
	];
	return {
		bestand,
		wandachsen,
		figur,
		hochweg: hausAst(
			haus.eingang.p,
			tangente as [number, number],
			haus.familie === 'kuppel' ? 14 : ZUGANG_LAENGE_M
		)
	};
}
