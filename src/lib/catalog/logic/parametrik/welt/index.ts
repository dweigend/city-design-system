/**
 * L11 · World, round 3 "District on existing stock". One system: the world is an occupancy on
 * a quad grid (raster.ts → belegung.ts → wege.ts); every volume, every frame and
 * every path is drawn by the corner modules of L10 (eckraster/, formen/eck.ts). This adds only
 * ground surfaces, trees, figures and the balance. Pure function of the parameters.
 */
import { random } from '../random';
import { clamp, type ColorToken, type Primitive, type Vec3 } from '../types';
import type { Cell, Point2 } from '../vocab';
import { eckModul } from '../formen/eck';
import { bestandDetails } from '../formen/eckbestand';
import { haeuser } from '../eckraster/bestand';
import { courtyards, LEVELS, slots } from '../eckraster/derive';
import { groupToken, type Farben } from '../eckraster/funktion';
import { heads, headZ } from '../eckraster/koepfe';
import { garden, head, treppen } from '../eckraster/presentation';
import { BAHN, BESTAND, GERUEST, HEIGHT_STEP, WEG, type Occupancy } from '../eckraster/state';
import { belegung, KERN } from './belegung';
import { lage, type Lage } from './lage';
import { wege } from './wege';
import { zugangSichern } from './zugang';
import { wegeKern } from './ports';
import { lageKern } from './kernlage';
import type { FarbcodeId, FokusId, Welt, WeltParams } from './typen';

export { weltDefaults } from './typen';
export type { Welt, WeltParams, FarbcodeId, FokusId, Bilanz } from './typen';
export { rasterarten, type RasterId } from './netze';

type Code = {
	id: FarbcodeId;
	name: string;
	/** Function → color; `null` = ink. Without an entry the color of the flow applies. */
	funktion?: (group: string) => ColorToken | null;
	weg: ColorToken;
	geruest: ColorToken;
};
/**
 * "Flows" is the rule: color = meaning after flowToken (data/focus.ts). Water blue,
 * energy yellow, food green, material orange (incl. deconstruction), people (housing, paths, stairs)
 * pink; core, frame and track are ink. The other entries are
 * style studies after references 45, 36 and 43: there the color carries no meaning.
 */
export const farbcodes: Code[] = [
	{ id: 'strom', name: 'Flows', weg: '--cat-business', geruest: '--signal' },
	{
		id: '45',
		name: 'Study 45',
		funktion: (g) => (g === 'nahrung' ? '--cat-nature' : g === 'tinte' ? null : '--cat-business'),
		weg: '--cat-mobility',
		geruest: '--cat-business'
	},
	{
		id: '36',
		name: 'Study 36',
		funktion: (g) =>
			g === 'wohnen' || g === 'nahrung'
				? '--cat-business'
				: g === 'material' || g === 'energie'
					? '--cat-mobility'
					: g === 'tinte'
						? null
						: '--cat-health',
		weg: '--cat-business',
		geruest: '--cat-health'
	},
	{
		id: '43',
		name: 'Study 43',
		funktion: () => null,
		weg: '--cat-hazard',
		geruest: '--cat-hazard'
	}
];
export const fokusse: { id: FokusId; name: string }[] = [
	{ id: 'alle', name: 'Everything' },
	{ id: 'netze', name: 'Networks' },
	{ id: 'volumen', name: 'Volumes' }
];

/** Color code and focus as coloring of the corner modules: whatever is not meant becomes ink. */
export function farben(farbcode: FarbcodeId, fokus: FokusId): Farben {
	const code = farbcodes.find((f) => f.id === farbcode) ?? farbcodes[0];
	return {
		token: (group) =>
			group === BAHN
				? '--paper'
				: group === WEG
					? fokus === 'volumen'
						? '--paper'
						: code.weg
					: fokus === 'netze' || !group || group === KERN
						? null
						: code.funktion
							? code.funktion(group)
							: groupToken(group),
		frame: fokus === 'netze' ? '--paper' : code.geruest,
		treppe: fokus === 'volumen' ? '--paper' : code.weg
	};
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const N = { role: 'neu', material: 'concrete' } as const;

/** Tree: thin trunk, ball crown without outline (calm, many). */
function baum(id: string, [x, y]: Point2, s: number): Primitive[] {
	return [
		{
			...N,
			id: `${id}-s`,
			kind: 'cylinder',
			position: [x, y, 0],
			radius: 0.11,
			height: 1.9 * s,
			token: '--paper',
			shade: 0.5,
			edges: false
		},
		{
			...N,
			id: `${id}-k`,
			kind: 'sphere',
			position: [x, y, 3 * s],
			radius: 1.55 * s,
			token: '--cat-nature',
			edges: false
		}
	];
}

/** Scale figure in the color of people (pink), without edges. */
function figur(id: string, [x, y]: Point2, z: number, token: ColorToken): Primitive[] {
	const base = { ...N, token, edges: false, detail: true };
	return [
		{ ...base, id: `${id}-k`, kind: 'cone', position: [x, y, z], radius: 0.32, height: 1.45 },
		{ ...base, id: `${id}-h`, kind: 'sphere', position: [x, y, z + 1.5], radius: 0.21 }
	];
}

/**
 * The layout depends only on grid, seed, size and the grid sliders. Density, height, sponge,
 * color and focus rebuild on the same layout: the expensive step (mesh) is then skipped.
 */
let zuletzt: { key: string; lage: Lage } | undefined;
function lageOf(p: WeltParams): Lage {
	const key = [
		p.raster,
		p.seed >>> 0,
		p.groesse,
		p.mass,
		p.verzug,
		p.relax,
		p.kern.netz,
		p.kern.feld
	].join('|');
	if (zuletzt?.key !== key)
		zuletzt = {
			key,
			lage: p.kern.netz ? lageKern({ ...p, feld: p.kern.feld }) : lage({ ...p, feld: p.kern.feld })
		};
	return zuletzt.lage;
}

/** One structural snapshot; view changes never rerun occupancy or the mutating path builder.
 * Keep only the current structure, so dragging structural controls cannot grow this cache.
 */
let struktur:
	| {
			key: string;
			r: Lage;
			b: ReturnType<typeof belegung>;
			netz: ReturnType<typeof wege>;
			slots: { slot: ReturnType<typeof slots>[number]; groups: (string | undefined)[] }[];
			ansichten: Map<string, Welt>;
	  }
	| undefined;
function strukturOf(p: WeltParams) {
	const key = [
		p.raster,
		p.seed >>> 0,
		p.groesse,
		p.mass,
		p.verzug,
		p.relax,
		p.dichte,
		p.hoehe,
		p.schwamm,
		p.kern.netz,
		p.kern.wege,
		p.kern.zugang,
		p.kern.feld
	].join('|');
	if (struktur?.key !== key) {
		const { r, b, netz } = layoutOccupancyAndNetwork(p);
		const groups: (string | undefined)[] = [];
		// slots calls the resolver once per corner bit, in slot order (eight bits each).
		const derived = slots(r.patch, b.samples, {
			token: (g) => {
				groups.push(g);
				return null;
			}
		});
		struktur = {
			key,
			r,
			b,
			netz,
			// Preserve semantic groups until projection; no view token enters the structure.
			slots: derived.map((slot, i) => ({ slot, groups: groups.slice(i * 8, i * 8 + 8) })),
			ansichten: new Map()
		};
	}
	return struktur;
}

/** Point and direction on a polyline at arc length `s`. */
function entlang(line: Point2[], s: number): { p: Point2; a: number } {
	for (let k = 0; k + 1 < line.length; k++) {
		const l = Math.hypot(line[k + 1][0] - line[k][0], line[k + 1][1] - line[k][1]);
		if (s <= l || k + 2 === line.length) {
			const t = Math.max(0, Math.min(1, s / (l || 1)));
			return {
				p: [
					line[k][0] + (line[k + 1][0] - line[k][0]) * t,
					line[k][1] + (line[k + 1][1] - line[k][1]) * t
				],
				a: Math.atan2(line[k + 1][1] - line[k][1], line[k + 1][0] - line[k][0])
			};
		}
		s -= l;
	}
	return { p: line[0] ?? [0, 0], a: 0 };
}
/** Polyline as a band of width `w` (a closed polygon per piece). */
function band(line: Point2[], w: number): Point2[][] {
	const out: Point2[][] = [];
	for (let k = 0; k + 1 < line.length; k++) {
		const [a, b] = [line[k], line[k + 1]],
			l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
			n: Point2 = [(-(b[1] - a[1]) / l) * w, ((b[0] - a[0]) / l) * w];
		out.push([
			[a[0] - n[0], a[1] - n[1]],
			[b[0] - n[0], b[1] - n[1]],
			[b[0] + n[0], b[1] + n[1]],
			[a[0] + n[0], a[1] + n[1]]
		]);
	}
	return out;
}

/** Derives the layout, occupancy and path network from world parameters. */
export function layoutOccupancyAndNetwork(p: WeltParams) {
	const r = lageOf(p),
		b = belegung(r, p);
	if (p.kern.zugang) zugangSichern(r, b);
	const netz = (p.kern.wege ? wegeKern : wege)(r, b, Math.max(1, Math.round(r.blocks.length / 6)));
	return { r, b, netz };
}
export function welt(input: WeltParams): Welt {
	const p = {
		...input,
		dichte: clamp(input.dichte, 0, 1),
		hoehe: clamp(input.hoehe, 0, 1),
		schwamm: clamp(input.schwamm, 0, 1)
	};
	const struktur = strukturOf(p),
		ansicht = `${p.farbcode}|${p.fokus}`,
		cached = struktur.ansichten.get(ansicht);
	if (cached) return cached;
	const { r, b, netz } = struktur;
	const o: Occupancy = b.samples,
		patch = r.patch,
		f = farben(p.farbcode, p.fokus),
		leise = p.fokus !== 'alle',
		rng = random((p.seed >>> 0) * 131 + 3),
		cellOf = new Map<string, Cell>(patch.cells.map((c) => [c.id, c]));
	const out: Primitive[] = [];

	// 1. All volumes, frames, decks, columns and paths: corner modules on the slots.
	for (const { slot: s, groups } of struktur.slots)
		if (s.mask)
			out.push(
				...eckModul({
					...s,
					context: {
						...s.context,
						courtyard: false,
						frameToken: f.frame,
						tokens: groups.map(f.token)
					}
				})
			);
	// In the "Networks" focus the volumes step back: white architectural model with a gray line (120, 130).
	if (p.fokus === 'netze')
		for (let i = 0; i < out.length; i++)
			if (out[i].role === 'neu' && !out[i].id.includes('-weg-'))
				out[i] = { ...out[i], token: '--paper', role: 'bestand', shade: 0 };

	// 2. Existing stock: punched facade, round arches, roofs.
	out.push(
		...haeuser(patch, o, b.plan, p.kern.zugang ? (id) => !r.blockOf.has(id) : undefined).flatMap(
			bestandDetails
		)
	);

	// 3. Ornament: steps back in focus.
	const deko: Primitive[] = [];
	// Courtyards: closed, open above, supported → garden (rule of the corner modules), on all levels.
	const hoefe = new Set<string>();
	const flaeche = (id: string, art: 'garten' | 'wasser' | 'platz') => {
		const c = cellOf.get(id)!;
		deko.push({
			...N,
			id: `boden:${id}`,
			kind: 'prism',
			polygon: c.polygon,
			z: art === 'wasser' ? -0.05 : 0,
			height: art === 'wasser' ? 0.06 : art === 'garten' ? 0.05 : 0.03,
			token: art === 'garten' ? '--cat-nature' : art === 'wasser' ? '--cat-health' : '--paper',
			edges: false
		});
		const k = hash(id);
		if (art === 'garten' ? k % 5 < 3 : art === 'platz' && k % 9 === 0)
			deko.push(
				...baum(
					`baum:${id}`,
					[c.center[0] + ((k % 7) - 3) * 0.3, c.center[1] + ((k % 11) - 5) * 0.2],
					0.85 + (k % 4) * 0.12
				)
			);
	};
	for (const h of LEVELS)
		for (const id of courtyards(patch, o, h)) {
			if (h === 0) {
				hoefe.add(id);
				flaeche(id, 'garten');
			} else deko.push(...garden(cellOf.get(id)!, h * HEIGHT_STEP, h));
		}
	// Ground surfaces of the free blocks: garden, basin, square.
	for (const [id, art] of b.boden) if (!o[`${id}@0`] && !hoefe.has(id)) flaeche(id, art);
	// Crowns: one per stacked intervention, form from the function.
	for (const h of heads(patch, o))
		if (h.group !== KERN)
			deko.push(
				...head(cellOf.get(h.vertexId)!, headZ(h), h.group, patch.seed + hash(h.vertexId), f).map(
					(q) => ({ ...q, id: `${q.id}@${h.level}` })
				)
			);
	// Core: overrun as a small rooftop structure.
	for (const e of b.eingriffe) {
		if (!e.kern) continue;
		const c = cellOf.get(e.kern)!;
		let top = 0;
		while (o[`${e.kern}@${top}`]) top++;
		deko.push({
			...N,
			id: `kern:${e.id}`,
			kind: 'cylinder',
			position: [c.center[0], c.center[1], top * HEIGHT_STEP],
			radius: 1.1,
			height: 1.4,
			token: f.token(KERN) ?? '--paper'
		});
	}
	out.push(...(leise ? deko.map((q) => ({ ...q, token: '--paper' as const })) : deko));

	// 4. External stairs of the towers, never in the alley.
	const gassen = new Set(patch.vertices.filter((v) => !r.blockOf.has(v.id)).map((v) => v.id));
	out.push(...treppen(patch, o, f, gassen, 0.55));

	// 5. Railway and people. The track lies outside along the west flank of the district.
	const gleis = r.bahn,
		gleisLaenge = gleis.reduce(
			(sum, q, k) => sum + (k ? Math.hypot(q[0] - gleis[k - 1][0], q[1] - gleis[k - 1][1]) : 0),
			0
		);
	if (gleis.length > 1) {
		band(gleis, 3.4).forEach((polygon, k) =>
			out.push({
				id: `bahn-damm-${k}`,
				kind: 'prism',
				polygon,
				z: -0.9,
				height: 0.88,
				role: 'bestand',
				token: '--paper',
				material: 'concrete',
				shade: 0.07,
				edges: false
			})
		);
		for (const [k, d] of [-0.72, 0.72].entries())
			out.push({
				...N,
				id: `bahn-schiene-${k}`,
				kind: 'polyline',
				points: gleis.map((q, i): Vec3 => {
					const v = gleis[Math.min(gleis.length - 1, i + 1)],
						u = gleis[Math.max(0, i - 1)],
						w = Math.atan2(v[1] - u[1], v[0] - u[0]);
					return [q[0] - Math.sin(w) * d, q[1] + Math.cos(w) * d, 0.06];
				}),
				token: '--paper'
			});
		for (const [k, s] of [gleisLaenge / 2 - 9.4, gleisLaenge / 2 + 0.4].entries()) {
			const len = 8.6,
				{ p: q, a } = entlang(gleis, s + len / 2);
			out.push({
				...N,
				id: `bahn-wagen-${k}`,
				kind: 'box',
				position: [q[0] - len / 2, q[1] - 1.15, 0.5],
				size: [len, 2.3, 2.7],
				rotation: a,
				token: '--paper',
				shade: 0.1,
				glass: true
			});
		}
	}
	const menschen = p.fokus === 'volumen' ? '--paper' : '--cat-business';
	netz.knoten.forEach(([id, level], k) => {
		if (hash(`${id}@${level}`) % 5 !== 0) return;
		const q = cellOf.get(id)!.center,
			d = (rng() - 0.5) * 1.2;
		out.push(
			...figur(
				`figur-${k}`,
				[q[0] + d, q[1] - d],
				level * HEIGHT_STEP + (level ? 0.3 : 0.08),
				menschen
			)
		);
	});

	// 6. Ground slab of the district: a hint of gray so that white models, squares and alleys read.
	r.umrisse.forEach((polygon, k) =>
		out.push({
			id: k ? `scholle-${k}` : 'scholle',
			kind: 'prism',
			polygon,
			z: -0.9,
			height: 0.88,
			role: 'bestand',
			token: '--paper',
			material: 'concrete',
			shade: 0.07
		})
	);

	// Standpoint for walking: on the square, looking at the nearest core.
	const platz = [...r.blocks]
			.filter((x) => b.arten.get(x.id) === 'platz')
			.sort((x, y) => y.naehe - x.naehe || y.cells.length - x.cells.length)[0],
		kerne = b.eingriffe.filter((e) => e.kern).map((e) => cellOf.get(e.kern!)!.center),
		ziel = kerne.sort(
			(a, c) =>
				Math.hypot(a[0] - platz.center[0], a[1] - platz.center[1]) -
				Math.hypot(c[0] - platz.center[0], c[1] - platz.center[1])
		)[0] ?? [0, 0],
		ecke = r.point.get(platz.saum[0] ?? platz.cells[0])!,
		stand = {
			von: [
				platz.center[0] + (ecke[0] - platz.center[0]) * 0.5,
				platz.center[1] + (ecke[1] - platz.center[1]) * 0.5
			] as Point2,
			nach: ziel
		};

	/* ── Balance: a simple counting model over the occupancy, no simulation. ── */
	const zahl: Record<string, number> = {};
	for (const s of Object.values(o)) zahl[s.group] = (zahl[s.group] ?? 0) + 1;
	const z = (g: string) => zahl[g] ?? 0;
	const anzahl = (art: string) => [...b.boden.values()].filter((a) => a === art).length;
	const bewohner = Math.round(z(BESTAND) * 1.6 + z('wohnen') * 2.5),
		bedarf = Math.max(1, bewohner),
		deckung = (angebot: number) => clamp(angebot / bedarf, 0, 1);
	const result: Welt = {
		primitives: out,
		tour: netz.tour,
		stand,
		blockers: patch.vertices
			.filter(
				(v) => o[`${v.id}@0`] && o[`${v.id}@0`].group !== WEG && o[`${v.id}@0`].group !== BAHN
			)
			.map((v) => cellOf.get(v.id)!.polygon),
		extent: r.extent,
		bilanz: {
			wasser: deckung(
				z('wasser') * 30 + anzahl('wasser') * 22 + (anzahl('garten') + hoefe.size) * 3
			),
			energie: deckung(z('energie') * 34 + z(GERUEST) * 2),
			nahrung: deckung(z('nahrung') * 26 + (anzahl('garten') + hoefe.size) * 7),
			material: deckung(z('material') * 22 + z('kreislauf') * 30)
		},
		zahlen: {
			bloecke: r.blocks.length,
			bestand: new Set([...b.plan.values()].map((q) => q.parcel)).size,
			eingriffe: b.eingriffe.length,
			hochweg: netz.laenge,
			ebenen: netz.ebenen,
			laeufe: netz.laeufe,
			schleifen: netz.schleifen,
			dachwege: netz.dachwege,
			bewohner,
			zellen: patch.vertices.length,
			winkel: Math.round(r.guete.minAngle),
			seiten: Math.round(r.guete.maxAspect * 10) / 10
		}
	};
	struktur.ansichten.set(ansicht, result);
	return result;
}
