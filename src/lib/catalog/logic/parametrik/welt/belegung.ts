/**
 * Occupancy of the world: existing stock and interventions as samples on the layout (eckraster/state). All
 * rules read only the graph of the layout (fringe, ring, depth, sides), never a grid.
 * The form is created only in the corner modules. Existing stock: perimeter block, rows, halls (group
 * `bestand`, protected). Interventions: gap tower (microcosm stack around a core),
 * plug-in module in a gap of the perimeter block, rooftop extension, courtyard house. Every cell of an intervention
 * carries its function as its group; color and crown follow from it (eckraster/funktion).
 */
import { random } from '../random';
import { clamp } from '../types';
import type { Point2 } from '../vocab';
import type { Dach, Parzelle } from '../eckraster/bestand';
import { address, BESTAND, GERUEST, MAX_LEVEL, type Sample } from '../eckraster/state';
import type { FunktionId } from '../eckraster/funktion';
import type { Block, Lage } from './lage';
import type { WeltParams } from './typen';

/** Build cell the rules are written for (meters). */
const MASS = 5;
export type Art = 'rand' | 'zeile' | 'halle' | 'luecke' | 'garten' | 'wasser' | 'platz';
export type Boden = 'garten' | 'wasser' | 'platz';
/** Core of a tower: bears, takes the elevator and shafts; paths dock here (47). */
export const KERN = 'kern';
export type Eingriff = {
	id: string;
	art: 'turm' | 'einschub' | 'aufstockung' | 'hofhaus';
	block: Block;
	/** Volume and frame cells [build cell, level]. */
	cells: [string, number][];
	base: number;
	top: number;
	kern?: string;
};
export type Belegung = {
	samples: Record<string, Sample>;
	arten: Map<string, Art>;
	plan: Map<string, Parzelle>;
	eingriffe: Eingriff[];
	boden: Map<string, Boden>;
};

/**
 * Occupancy of the layout `r`: existing stock first, then interventions and ground surfaces.
 * Reads seed (`>>> 0`, stream `seed·31+5` plus per-block streams from `Block.seed`), dichte,
 * hoehe and schwamm (clamped to [0, 1]) from `p`. Levels stay in 0 … MAX_LEVEL. Returns new maps
 * and arrays; each `Eingriff.block` is the block object of `r` by reference. `r` and `p` are not
 * mutated. `wege` later writes paths into `samples`.
 */
export function belegung(r: Lage, p: WeltParams): Belegung {
	const rng = random((p.seed >>> 0) * 31 + 5),
		dichte = clamp(p.dichte, 0, 1),
		hoehe = clamp(p.hoehe, 0, 1),
		schwamm = clamp(p.schwamm, 0, 1);
	const samples: Record<string, Sample> = {},
		plan = new Map<string, Parzelle>(),
		eingriffe: Eingriff[] = [],
		boden = new Map<string, Boden>(),
		arten = new Map<string, Art>();
	const has = (id: string, h: number) => !!samples[address(id, h)];
	const height = (id: string) => {
		let n = 0;
		while (has(id, n)) n++;
		return n;
	};
	const put = (id: string, h: number, group: string, frame = false) => {
		if (h < 0 || h > MAX_LEVEL || has(id, h)) return false;
		samples[address(id, h)] = frame ? { occupied: true, group, frame } : { occupied: true, group };
		return true;
	};
	const pick = <T>(list: T[]) => list[Math.floor(rng() * list.length) % list.length];
	const hash = (t: string) =>
		[...t].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
	/**
	 * Measured in meters, not cells: the rules are written for build cells of 5 m. On finer
	 * meshes the cell count grows with the area (`flaeche`) or with the length (`front`).
	 */
	const flaeche = (b: Block, zellen: number) =>
		Math.round(zellen * clamp((MASS * MASS) / b.zelle, 1, 3));
	const front = (b: Block) => clamp(Math.round((2 * MASS) / Math.sqrt(b.zelle)), 2, 4);
	const saeume = new Map(r.blocks.map((b) => [b.id, new Set(b.saum)]));

	/* ── Use of the blocks ── */
	const order = [...r.blocks].sort((a, b) => b.naehe - a.naehe);
	order.forEach((b, k) => {
		const q = rng();
		const wasser = 0.03 + 0.1 * schwamm,
			garten = wasser + 0.04 + 0.14 * schwamm,
			luecke = garten + 0.08 + 0.2 * dichte,
			halle = luecke + 0.08,
			zeile = halle + 0.2;
		// Degenerate: too few build cells for a house with a courtyard. The block stays a square.
		const klein = b.cells.length < 5 || !b.seiten.length;
		arten.set(
			b.id,
			k === 0 || klein
				? 'platz'
				: q < wasser
					? 'wasser'
					: q < garten
						? 'garten'
						: q < luecke
							? 'luecke'
							: q < halle
								? 'halle'
								: q < zeile
									? 'zeile'
									: 'rand'
		);
	});
	// At least two gaps, otherwise there is no network.
	for (const b of order) {
		if (order.filter((x) => arten.get(x.id) === 'luecke').length >= 2) break;
		if (arten.get(b.id) === 'rand' || arten.get(b.id) === 'zeile') arten.set(b.id, 'luecke');
	}

	/* ── Existing stock ── */
	type Haus = { cells: string[]; levels: number; first: number; dach: Dach; corner?: Point2 };
	const haus = (key: string, h: Haus) => {
		for (const id of h.cells) {
			for (let l = 0; l < h.levels; l++) put(id, l, BESTAND);
			plan.set(id, { parcel: key, first: h.first, dach: h.dach, corner: h.corner });
		}
	};
	/** Gaps in the perimeter block that receive a plug-in module: cells and height of the neighbors. */
	const luecken: { block: Block; cells: string[]; nachbar: number }[] = [];
	const ringOf = new Map<string, string[][]>();

	for (const b of r.blocks) {
		const art = arten.get(b.id)!,
			brng = random(b.seed);
		const all = b.cells,
			tief = (id: string) => b.tiefe.get(id) ?? 1;
		if (art === 'platz' || art === 'garten') all.forEach((id) => boden.set(id, art));
		if (art === 'wasser') for (const id of all) boden.set(id, tief(id) === 1 ? 'platz' : 'wasser');
		if (art === 'rand') {
			// Loop along the fringe: corner houses at the bends, houses of two cells in between.
			const hoch = () => 3 + Math.floor(brng() * 2.35);
			const houses: Haus[] = [],
				eck = new Map(b.ecken.map((e) => [e.cell, e.punkt])),
				gesetzt = new Set<string>();
			for (const s of b.seiten) {
				const e = s.ecken[0];
				if (e && !gesetzt.has(e)) {
					gesetzt.add(e);
					houses.push({
						cells: [e],
						levels: Math.min(5, hoch() + (brng() < 0.5 ? 1 : 0)),
						first: b.first.get(e)!,
						dach: brng() < 0.3 ? 'eckturm' : 'traufe',
						corner: eck.get(e)
					});
				}
				for (let k = 0; k < s.cells.length;) {
					const rest = s.cells.length - k,
						breit = front(b),
						n = rest <= breit ? rest : brng() < 0.8 ? breit : breit - 1;
					houses.push({
						cells: s.cells.slice(k, k + n),
						levels: hoch(),
						first: b.first.get(s.cells[k])!,
						dach: 'sattel'
					});
					k += n;
				}
			}
			// A gap: open as a passage or for a plug-in module (density).
			const sides = houses.map((h, k) => ({ h, k })).filter(({ h }) => h.dach === 'sattel');
			const gap = sides.length && brng() < 0.3 + 0.5 * dichte ? pick(sides) : undefined;
			houses.forEach((h, k) => {
				if (gap?.k === k) return;
				haus(`${b.id}-h${k}`, h);
			});
			if (gap && brng() < 0.25 + 0.75 * dichte) {
				const n = houses.length,
					nachbar = Math.max(houses[(gap.k + 1) % n].levels, houses[(gap.k + n - 1) % n].levels);
				luecken.push({ block: b, cells: gap.h.cells, nachbar });
			}
			ringOf.set(
				b.id,
				houses.filter((_, k) => k !== gap?.k).map((h) => h.cells)
			);
			// The courtyard stays free: once closed, it becomes a garden (courtyard rule of the corner modules).
		}
		if (art === 'zeile') {
			// Two sides of the fringe, as opposite as possible; garden in between.
			const n = b.seiten.length,
				k = Math.floor(brng() * n),
				wahl = n >= 3 ? [k, (k + Math.floor(n / 2)) % n] : [k];
			const houses: string[][] = [],
				gesetzt = new Set<string>();
			wahl.forEach((si, s) => {
				const seite = b.seiten[si],
					row: string[] = [];
				for (const id of [seite.ecken[0], ...seite.cells, seite.ecken[1]])
					if (id && !gesetzt.has(id)) {
						gesetzt.add(id);
						row.push(id);
					}
				for (let at = 0, c = 0; at < row.length; c++) {
					const m = Math.min(front(b), row.length - at),
						cells = row.slice(at, at + m);
					// Now and then a house is missing: an infill gap in the row.
					if (brng() > 0.12) {
						haus(`${b.id}-z${s}-${c}`, {
							cells,
							levels: 2 + Math.floor(brng() * 2.6),
							first: b.first.get(cells[0])!,
							dach: 'sattel'
						});
						houses.push(cells);
					}
					at += m;
				}
			});
			ringOf.set(b.id, houses);
			all.filter((id) => !has(id, 0)).forEach((id) => boden.set(id, 'garten'));
		}
		if (art === 'halle') {
			// Shed hall: naves two cells wide across one side, each with its own ridge.
			// The side itself stays free as a forecourt.
			const seite = b.seiten[Math.floor(brng() * b.seiten.length)],
				vor = new Set([...seite.cells, ...seite.ecken]),
				a = seite.richtung,
				levels = 1 + Math.floor(brng() * 1.6),
				u = (id: string) => r.point.get(id)![0] * Math.cos(a) + r.point.get(id)![1] * Math.sin(a),
				cells = all.filter((id) => !vor.has(id)),
				u0 = Math.min(...cells.map(u)) - b.pitch / 2;
			const schiffe = new Map<number, string[]>();
			for (const id of cells) {
				const k = Math.floor((u(id) - u0) / (2 * b.pitch));
				schiffe.set(k, [...(schiffe.get(k) ?? []), id]);
			}
			for (const [k, ship] of [...schiffe].sort((x, y) => x[0] - y[0]))
				haus(`${b.id}-s${k}`, { cells: ship, levels, first: a + Math.PI / 2, dach: 'sattel' });
			all.filter((id) => !has(id, 0)).forEach((id) => boden.set(id, 'platz'));
		}
	}

	/* ── Interventions ── */
	/** Neighbors in the graph of build cells; the boundary of the district stays free. */
	const neighbors = (id: string) => r.nb.get(id)!.filter((n) => !r.rand.has(n));
	/** In the block; `margin` 1: without the ring, −1: with the fringe (alley around the block). */
	const inBlock = (b: Block, id: string, margin = 0) =>
		r.blockOf.get(id) === b
			? (b.tiefe.get(id) ?? 1) > margin
			: margin < 0 && saeume.get(b.id)!.has(id) && !r.rand.has(id);
	/**
	 * A piece: connected cells across several bays and floors (L, S, T), one
	 * function, one volume. `hoch` weights growing upward against growing sideways.
	 */
	const stueck = (
		start: [string, number],
		size: number,
		frei: (id: string, l: number) => boolean,
		rng: () => number,
		hoch: number
	): [string, number][] => {
		const cells: [string, number][] = [start],
			seen = new Set([address(...start)]);
		while (cells.length < size) {
			const cand: [string, number][] = [];
			for (const [id, l] of cells) {
				for (let k = 0; k < hoch; k++) cand.push([id, l + 1]);
				cand.push([id, l - 1]);
				for (const n of neighbors(id)) cand.push([n, l], [n, l]);
			}
			const open = cand.filter(([id, l]) => !seen.has(address(id, l)) && frei(id, l));
			if (!open.length) break;
			const next = open[Math.floor(rng() * open.length)];
			seen.add(address(...next));
			cells.push(next);
		}
		return cells;
	};
	/** Function of a piece from its position in the stack (microcosm: public below, harvest above). */
	const funktionOf = (
		cells: [string, number][],
		storeys: number,
		rng: () => number
	): FunktionId => {
		const lo = Math.min(...cells.map(([, l]) => l)),
			hi = Math.max(...cells.map(([, l]) => l)),
			q = rng();
		if (lo === 0) return q < 0.7 ? 'material' : 'kreislauf';
		if (hi >= storeys - 1)
			return q < 0.35 + 0.4 * schwamm ? 'nahrung' : q < 0.85 ? 'energie' : 'wasser';
		if (lo <= 1) return q < 0.45 ? 'kreislauf' : 'wohnen';
		return q < 0.12 ? 'tinte' : q < 0.2 + 0.2 * schwamm ? 'wasser' : 'wohnen';
	};

	// Gap tower: core plus interlocking pieces in the space bay × floors, with cantilevers.
	for (const b of r.blocks) {
		if (arten.get(b.id) !== 'luecke') continue;
		const brng = random(b.seed ^ 0x51ed),
			zur = (id: string) =>
				Math.hypot(r.point.get(id)![0] - b.center[0], r.point.get(id)![1] - b.center[1]),
			hof = b.cells.filter((id) => (b.tiefe.get(id) ?? 1) > 1),
			// Small blocks without a courtyard: the tower may use the ring.
			innen = hof.length >= 4 ? 1 : 0,
			mitte = (hof.length ? hof : b.cells)
				.slice()
				.sort((x, y) => zur(x) - zur(y) || (x < y ? -1 : 1)),
			kern = mitte[Math.floor(brng() * Math.min(3, mitte.length))],
			storeys = clamp(Math.round(3 + hoehe * 4 + (brng() - 0.5) * 2 + b.naehe), 3, 7),
			rahmen = brng() < 0.55,
			cells: [string, number][] = [];
		// Bay: grows out from the core, stays inside the block.
		const feld = new Set<string>(),
			size = flaeche(b, 3 + Math.floor(brng() * 4));
		for (let k = 0; k < 40 && feld.size < size; k++) {
			const cand = [...new Set([kern, ...feld].flatMap(neighbors))].filter(
				(id) => id !== kern && !feld.has(id) && inBlock(b, id, innen)
			);
			if (cand.length) feld.add(cand[Math.floor(brng() * cand.length)]);
		}
		// Cantilever: cells next to the bay, only from the second upper floor (above alley and garden).
		const ausleger = new Set(
			[...feld]
				.flatMap(neighbors)
				.filter((id) => id !== kern && !feld.has(id) && inBlock(b, id, -1))
		);
		for (let l = 0; l <= Math.min(storeys, MAX_LEVEL); l++) put(kern, l, KERN);
		let aussen = 0;
		const frei = (id: string, l: number) =>
			l >= 0 &&
			l < storeys &&
			!has(id, l) &&
			(feld.has(id) ||
				(l >= 2 && l < storeys - 1 && ausleger.has(id) && aussen < flaeche(b, 4 + storeys)));
		for (let l = 0; l < storeys; l++)
			for (const id of feld) {
				// Toward the top the stack gets lighter.
				if (has(id, l) || brng() > 1 - 0.07 * l - (l === storeys - 1 ? 0.2 : 0)) continue;
				const teil = stueck(
						[id, l],
						flaeche(b, 2 + Math.floor(brng() * 5)),
						frei,
						brng,
						l === 0 ? 1 : 2
					),
					group = funktionOf(teil, storeys, brng);
				for (const [c, h] of teil)
					if (put(c, h, group, rahmen)) {
						cells.push([c, h]);
						if (!feld.has(c)) aussen++;
					}
			}
		// Frame tower: bays without a plug-in module stay as an empty frame.
		if (rahmen)
			for (let l = 0; l < storeys; l++)
				for (const id of feld) if (put(id, l, GERUEST, true)) cells.push([id, l]);
		eingriffe.push({
			id: `turm-${b.id}`,
			art: 'turm',
			block: b,
			cells,
			base: 0,
			top: storeys - 1,
			kern
		});
		for (const id of b.cells)
			if (!has(id, 0)) boden.set(id, brng() < 0.3 + 0.5 * schwamm ? 'garten' : 'platz');
	}

	// Plug-in module in the gap of the perimeter block: taller than the neighbors, reaching over them at the top.
	for (const l of luecken) {
		const brng = random(l.block.seed ^ 0x7a31),
			storeys = clamp(l.nachbar + 1 + Math.round(hoehe * 2 + brng() - 0.5), 3, 7),
			rahmen = brng() < 0.5,
			cells: [string, number][] = [],
			feld = new Set(l.cells),
			dach = new Set(l.cells.flatMap(neighbors).filter((id) => plan.has(id)));
		// Above the eaves the module reaches over the neighboring roofs (interlocking with the existing stock).
		const frei = (id: string, h: number) =>
			h >= 0 &&
			h < storeys &&
			!has(id, h) &&
			(feld.has(id) || (dach.has(id) && h >= height(id) && h - height(id) <= 1));
		for (let h = 0; h < storeys; h++)
			for (const id of feld) {
				if (has(id, h)) continue;
				const teil = stueck([id, h], flaeche(l.block, 2 + Math.floor(brng() * 4)), frei, brng, 2),
					group = funktionOf(teil, storeys, brng);
				for (const [c, k] of teil) if (put(c, k, group, rahmen)) cells.push([c, k]);
			}
		eingriffe.push({
			id: `einschub-${l.block.id}`,
			art: 'einschub',
			block: l.block,
			cells,
			base: 0,
			top: storeys - 1
		});
	}

	// Rooftop extension: a piece grows over the roofs, steps back and cantilevers over alley or courtyard.
	const gruppen: FunktionId[] = [
		'wohnen',
		'wohnen',
		'wohnen',
		'nahrung',
		'energie',
		'wasser',
		'kreislauf',
		'material'
	];
	for (const b of r.blocks) {
		const ring = ringOf.get(b.id);
		if (!ring?.length) continue;
		const brng = random(b.seed ^ 0x2f0b),
			chance = 0.12 + 0.88 * dichte * (0.5 + 0.5 * b.naehe),
			dach = new Set(ring.flat());
		for (let n = 0; n < 3; n++) {
			if (brng() > chance * [1, 0.7, 0.4][n]) continue;
			const haus = ring[Math.floor(brng() * ring.length)],
				start = haus[Math.floor(brng() * haus.length)],
				base = height(start),
				storeys = clamp(1 + Math.round(hoehe * 2 + brng() * 0.8), 1, 3),
				top = Math.min(MAX_LEVEL, base + storeys - 1),
				rahmen = brng() < 0.35;
			if (has(start, base) || base > MAX_LEVEL) continue;
			// Cantilevers only at single cells, otherwise the rooftop extension becomes a lid over the alley.
			const lucky = (id: string) => (hash(id) + n) % 3 === 0;
			const frei = (id: string, l: number) => {
				if (l < base || l > top || has(id, l)) return false;
				// On the roof (at most one floor of air) or as a cantilever over open ground.
				if (dach.has(id)) return l >= height(id) && l - height(id) <= 1;
				return !has(id, 0) && inBlock(b, id, -1) && l >= 3 && lucky(id);
			};
			const teil = stueck(
				[start, base],
				flaeche(b, Math.round(3 + hoehe * 4 + brng() * 4)),
				frei,
				brng,
				1
			);
			const group = gruppen[Math.floor(brng() * gruppen.length)],
				cells: [string, number][] = [];
			for (const [c, l] of teil) if (put(c, l, group, rahmen)) cells.push([c, l]);
			// One bay of the frame stays empty: room for the next plug-in module.
			if (rahmen)
				for (const [c, l] of teil.slice(0, 3))
					if (dach.has(c) && l + 1 <= MAX_LEVEL && put(c, l + 1, GERUEST, true)) {
						cells.push([c, l + 1]);
						break;
					}
			if (cells.length)
				eingriffe.push({
					id: `auf-${b.id}-${n}`,
					art: 'aufstockung',
					block: b,
					cells,
					base,
					top: Math.max(...cells.map(([, l]) => l))
				});
		}
	}

	// Courtyard house: a small volume in the courtyard of the perimeter block.
	for (const b of r.blocks) {
		if (arten.get(b.id) !== 'rand') continue;
		const brng = random(b.seed ^ 0x0c4d);
		// Only where the courtyard is deep enough: two cells of distance to the perimeter block.
		const tief = b.cells.filter((id) => (b.tiefe.get(id) ?? 1) >= 3);
		if (brng() > 0.15 + 0.45 * dichte || !tief.length) continue;
		const ort = tief[Math.floor(brng() * tief.length)],
			group: FunktionId =
				brng() < 0.4 + 0.4 * schwamm ? 'nahrung' : brng() < 0.5 ? 'wasser' : 'material',
			storeys = 1 + Math.floor(brng() * 1.7),
			cells: [string, number][] = [];
		for (let h = 0; h < storeys; h++) if (put(ort, h, group)) cells.push([ort, h]);
		if (cells.length)
			eingriffe.push({
				id: `hof-${b.id}`,
				art: 'hofhaus',
				block: b,
				cells,
				base: 0,
				top: storeys - 1
			});
	}
	return { samples, arten, plan, eingriffe, boden };
}
