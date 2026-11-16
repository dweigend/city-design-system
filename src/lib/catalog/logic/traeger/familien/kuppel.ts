import { familienTexte } from '../../../data/traeger';
import { belege } from '../belegung';
import { einheit, kanal } from '../hash';
import {
	kantenId,
	type Flaeche,
	type Kante,
	type Knoten,
	type Parameter,
	type TraegerFamilie,
	type TraegerPlan,
	type Vec3
} from '../plan';

// Incidence principle after city_game: prototype/src/lib/experiments/hart-structures/core/hart-structures.ts.
// New class-I subdivision: addresses are integer barycentric rule paths.
const EPS = 1e-10; // relative length/latitude tolerance on the unit sphere
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const sub = (a: Vec3, b: Vec3): Vec3 => add(a, mul(b, -1));
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
const unit = (a: Vec3): Vec3 => mul(a, 1 / Math.hypot(...a));
function punkt(punkte: Map<string, Vec3>, id: string): Vec3 {
	const p = punkte.get(id);
	if (!p) throw new Error(`Missing incidence node ${id}`);
	return p;
}
type Netz = { punkte: Map<string, Vec3>; flaechen: { id: string; knoten: string[] }[] };

function ikosaeder(): { punkte: Vec3[]; dreiecke: number[][] } {
	const h = 1 / Math.sqrt(5),
		r = 2 / Math.sqrt(5);
	const punkte: Vec3[] = [[0, 0, 1]];
	for (let ring = 0; ring < 2; ring++)
		for (let i = 0; i < 5; i++) {
			const a = ((2 * i + ring) * Math.PI) / 5;
			punkte.push([r * Math.cos(a), r * Math.sin(a), h * (1 - 2 * ring)]);
		}
	punkte.push([0, 0, -1]);
	const dreiecke: number[][] = [];
	for (let i = 0; i < 5; i++) {
		const u = 1 + i,
			v = 1 + ((i + 1) % 5),
			l = 6 + i,
			m = 6 + ((i + 1) % 5);
		dreiecke.push([0, u, v], [u, l, v], [v, l, m], [11, m, l]);
	}
	return { punkte, dreiecke };
}
function teilen(frequenz: number, kugel: number): Netz {
	const ico = ikosaeder(),
		punkte = new Map<string, Vec3>(),
		flaechen: Netz['flaechen'] = [];
	ico.dreiecke.forEach((face, fi) => {
		function knoten(i: number, j: number): string {
			const weights = [frequenz - i - j, i, j];
			const address = face
				.map((v, k) => ({ v, w: weights[k] }))
				.filter((v) => v.w > 0)
				.sort((a, b) => a.v - b.v)
				.map((v) => `${v.v}x${v.w}`)
				.join('-');
			const id = `kuppel:k:f${frequenz}:${address}`;
			if (!punkte.has(id)) {
				const flat = face.reduce<Vec3>(
					(sum, v, k) => add(sum, mul(ico.punkte[v], weights[k] / frequenz)),
					[0, 0, 0]
				);
				punkte.set(id, add(mul(flat, 1 - kugel), mul(unit(flat), kugel)));
			}
			return id;
		}
		for (let i = 0; i < frequenz; i++)
			for (let j = 0; j < frequenz - i; j++) {
				flaechen.push({
					id: `kuppel:f:f${frequenz}:${fi}:${i}:${j}:a`,
					knoten: [knoten(i, j), knoten(i + 1, j), knoten(i, j + 1)]
				});
				if (i + j < frequenz - 1)
					flaechen.push({
						id: `kuppel:f:f${frequenz}:${fi}:${i}:${j}:b`,
						knoten: [knoten(i + 1, j), knoten(i + 1, j + 1), knoten(i, j + 1)]
					});
			}
	});
	return { punkte, flaechen };
}
function dual(net: Netz, kugel: number): Netz {
	const punkte = new Map<string, Vec3>(),
		inzidenz = new Map<string, string[]>();
	for (const f of net.flaechen) {
		const id = `kuppel:d:${f.id}`,
			center = mul(
				f.knoten.reduce<Vec3>((sum, k) => add(sum, punkt(net.punkte, k)), [0, 0, 0]),
				1 / 3
			);
		punkte.set(id, add(mul(center, 1 - kugel), mul(unit(center), kugel)));
		for (const k of f.knoten) inzidenz.set(k, [...(inzidenz.get(k) ?? []), id]);
	}
	const flaechen = [...inzidenz].map(([id, ids]) => {
		const normal = unit(punkt(net.punkte, id)),
			u = unit(cross(normal, Math.abs(normal[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])),
			v = cross(normal, u);
		const angle = (k: string) => Math.atan2(dot(punkt(punkte, k), v), dot(punkt(punkte, k), u));
		return { id: `kuppel:f:v:${id}`, knoten: ids.sort((a, b) => angle(a) - angle(b)) };
	});
	return { punkte, flaechen };
}
/** Clip facets, never flatten an existing spherical vertex. Shared cuts inherit edge addresses. */
function schneiden(net: Netz, breite: number): Netz {
	const punkte = new Map(net.punkte),
		flaechen: Netz['flaechen'] = [];
	function schnitt(a: string, b: string): string {
		const p = punkt(punkte, a),
			q = punkt(punkte, b);
		if (Math.abs(p[2] - breite) < EPS) return a;
		if (Math.abs(q[2] - breite) < EPS) return b;
		const id = `kuppel:schnitt:${kantenId(a, b)}`;
		if (!punkte.has(id)) {
			const t = (breite - p[2]) / (q[2] - p[2]);
			const s = add(p, mul(sub(q, p), t));
			s[2] = breite;
			punkte.set(id, s);
		}
		return id;
	}
	for (const f of net.flaechen) {
		const ids: string[] = [];
		for (let i = 0; i < f.knoten.length; i++) {
			const a = f.knoten[i],
				b = f.knoten[(i + 1) % f.knoten.length];
			const inside = punkt(punkte, a)[2] >= breite - EPS,
				next = punkt(punkte, b)[2] >= breite - EPS;
			if (inside) ids.push(a);
			if (inside !== next) ids.push(schnitt(a, b));
		}
		const unique = [...new Set(ids)];
		if (unique.length >= 3) flaechen.push({ ...f, knoten: unique });
	}
	const used = new Set(flaechen.flatMap((f) => f.knoten));
	return { punkte: new Map([...punkte].filter(([id]) => used.has(id))), flaechen };
}
function volumen(net: Netz): number {
	let sum = 0;
	for (const f of net.flaechen) {
		const a = punkt(net.punkte, f.knoten[0]);
		for (let i = 1; i + 1 < f.knoten.length; i++)
			sum += dot(a, cross(punkt(net.punkte, f.knoten[i]), punkt(net.punkte, f.knoten[i + 1]))) / 6;
	}
	return Math.abs(sum);
}

function planen(werte: Record<string, number>, saat: number): TraegerPlan {
	const phase = werte.phase ?? 3,
		frequenz = phase === 0 ? 1 : (werte.frequenz ?? 3),
		radius = werte.radius ?? 12;
	const kugel = phase === 0 || phase === 3 ? 1 : (werte.kugel ?? 1);
	const primal = teilen(frequenz, kugel);
	// Odd class-I frequencies have a zigzag equator, not a horizontal node ring.
	// The closest southern latitude gives the 5/8 cap; crossing facets get real cut vertices.
	const sphere = teilen(frequenz, 1);
	const breite =
		frequenz % 2 === 0
			? 0
			: Math.max(...[...sphere.punkte.values()].filter((p) => p[2] < -EPS).map((p) => p[2]));
	let net = werte.haut === 1 && phase >= 2 ? dual(primal, kugel) : primal;
	if (phase === 3) net = schneiden(net, breite);
	const shift = phase === 3 ? -breite : -Math.min(...[...net.punkte.values()].map((p) => p[2]));
	const knoten: Knoten[] = [...net.punkte].map(([id, p]) => ({
		id,
		p: [p[0] * radius, p[1] * radius, Math.abs(p[2] + shift) < EPS ? 0 : (p[2] + shift) * radius],
		rolle: phase === 3 && Math.abs(p[2] - breite) < EPS ? 'lager' : 'nabe'
	}));
	net = { ...net, punkte: new Map(knoten.map((k) => [k.id, k.p])) };
	if (phase === 3) {
		const ring = knoten
			.filter((k) => k.rolle === 'lager')
			.sort((a, b) => Math.atan2(b.p[1], b.p[0]) - Math.atan2(a.p[1], a.p[0]));
		net.flaechen.push({ id: 'kuppel:f:boden', knoten: ring.map((k) => k.id) });
	}
	const flaechen: Flaeche[] = net.flaechen.map((f) => ({
		...f,
		rolle: f.id === 'kuppel:f:boden' ? 'boden' : 'glas',
		zelle: 'kuppel:z:garten'
	}));
	const edges = new Map<string, Kante & { klasse?: string }>();
	for (const f of flaechen)
		for (let i = 0; i < f.knoten.length; i++) {
			const a = f.knoten[i],
				b = f.knoten[(i + 1) % f.knoten.length],
				id = kantenId(a, b);
			edges.set(id, { id, a, b, rolle: 'stab' });
		}
	const kanten = [...edges.values()];
	// Length labels describe the finished spherical members. Keep them stable during lifting.
	let klassenNet = werte.haut === 1 && phase >= 2 ? dual(sphere, 1) : sphere;
	if (phase === 3) klassenNet = schneiden(klassenNet, breite);
	const length = (e: Kante) =>
		Math.hypot(...sub(punkt(klassenNet.punkte, e.a), punkt(klassenNet.punkte, e.b)));
	const lengths: number[] = [];
	for (const e of [...kanten].sort((a, b) => length(a) - length(b))) {
		const l = length(e);
		if (!lengths.some((v) => Math.abs(v - l) < EPS)) lengths.push(l);
		e.klasse = String.fromCharCode(65 + lengths.findIndex((v) => Math.abs(v - l) < EPS));
	}
	// Sparse planting below, solar above; the interior garden remains a separate use.
	const panelTargets = flaechen.filter((f) => f.rolle !== 'boden');
	const middle =
		(Math.min(...knoten.map((k) => k.p[2])) + Math.max(...knoten.map((k) => k.p[2]))) / 2;
	const lower = panelTargets.filter(
		(f) =>
			f.knoten.reduce((sum, id) => sum + punkt(net.punkte, id)[2], 0) / f.knoten.length < middle
	);
	const lowerIds = new Set(lower.map((f) => f.id));
	const belegung = Object.assign(
		{},
		...[lower, panelTargets.filter((f) => !lowerIds.has(f.id))].map((targets, i) =>
			belege({ zellen: [], flaechen }, saat, 'kuppel', {
				anteil: 0.12,
				stroeme: [i === 0 ? 'food' : 'energy'],
				ziele: targets.map((f) => f.id)
			})
		)
	);
	for (const f of flaechen) {
		if (f.rolle === 'boden') continue;
		const glaspaneel = einheit(kanal(saat, 'kuppel', f.id, 'glas')) < (werte.glas ?? 0.85);
		if (!glaspaneel || (belegung[f.id] && belegung[f.id] !== 'leer')) f.rolle = 'paneel';
	}
	// Store only occupied shell targets alongside the neutral garden cell.
	const occupied = Object.fromEntries(
		Object.entries(belegung).filter(([, flow]) => flow !== 'leer')
	);
	return {
		version: 1,
		familie: 'kuppel',
		saat: saat >>> 0,
		werte: { ...werte },
		knoten,
		kanten,
		flaechen,
		zellen: [
			{
				id: 'kuppel:z:garten',
				flaechen: flaechen.map((f) => f.id),
				volumenM3: volumen(net),
				...(phase === 3 ? { nutzung: 'garten' as const } : {})
			}
		],
		belegung: { ...occupied, 'kuppel:z:garten': 'leer' }
	};
}
// Loop helpers are declared but omitted from reader controls.
const parameter: Parameter[] = [
	{
		art: 'diskret',
		id: 'frequenz',
		label: 'Frequency',
		optionen: [2, 3, 4].map((wert) => ({ wert, label: String(wert) })),
		start: 3
	},
	{
		art: 'diskret',
		id: 'haut',
		label: 'Skin',
		optionen: [
			{ wert: 0, label: 'Triangle' },
			{ wert: 1, label: 'Honeycomb' }
		],
		start: 0
	},
	{
		art: 'stetig',
		id: 'radius',
		label: 'Radius',
		min: 9,
		max: 15,
		schritt: 0.5,
		start: 12,
		einheit: 'm'
	},
	{
		art: 'stetig',
		id: 'glas',
		label: 'Glass share',
		min: 0,
		max: 1,
		schritt: 0.05,
		start: 0.85,
		einheit: ''
	},
	{
		art: 'stetig',
		id: 'kugel',
		label: 'Sphere projection',
		min: 0,
		max: 1,
		schritt: 0.01,
		start: 1,
		einheit: '',
		verborgen: true
	},
	{
		art: 'diskret',
		id: 'phase',
		label: 'Build phase',
		optionen: [0, 1, 2, 3].map((wert) => ({ wert, label: String(wert) })),
		start: 3,
		verborgen: true
	}
];
/** Pure class-I dome / clipped Goldberg dual in meters; defaults supplied by the public entry. */
export const kuppel: TraegerFamilie = {
	id: 'kuppel',
	parameter,
	planen,
	loop: (familienTexte.find((t) => t.id === 'kuppel')?.schritte ?? []).map((s, i) => ({
		name: s.name,
		werte: { phase: i, kugel: i === 1 ? 0 : 1 },
		ansicht: i === 3 ? 'belegt' : 'geruest',
		dauerS: 4
	}))
};
