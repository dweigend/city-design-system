/**
 * External circulation (tower principle, 85 §2 rule 4), emergent and deterministic.
 * Rules, in this order, every stair in its own free cell column:
 * 1. Tower: an intervention with at least TURM own floors gets a stair flight up to
 *    its highest floor, next to the highest column; from TURM + 1 on, a stair tower.
 * 2. Walkway end: every connected group of walkway decks gets a stair flight at one end
 *    from the ground up to the deck.
 * 3. Floating: an intervention without ground contact and without existing stock below gets a
 *    spiral stair down to its lowest floor. Rooftop extensions use the stairwell of the existing stock.
 * Free column = occupied on no level, no courtyard garden, no rim cell, large enough, not
 * yet taken. No collision:
 * volumes, crowns, gardens and columns lie only in occupied columns or courtyards. Pure logic.
 */
import type { Patch } from './topology';
import { courtyards, decks, index, LEVELS } from './derive';
import { DECK } from '../formen/eck';
import { address, HEIGHT_STEP, isBestand, isWeg, occupied, solid, type Occupancy } from './state';

export type TreppenArt = 'turm' | 'lauf' | 'wendel';
export type Treppe = {
	id: string;
	art: TreppenArt;
	/** Free column in which the stair stands. */
	vertexId: string;
	/** Occupied cell it docks onto. */
	anchor: string;
	/** Level reached and height of the exit platform. */
	level: number;
	z: number;
	/** Group (function) of the target, for the color. */
	group: string;
};

/** From this many own floors an intervention counts as a tower (flight); one more: stair tower. */
export const TURM = 4;
/** Minimum area of a stair column in m² (two-flight stair with landings). */
const MIN_AREA = 10;

/** `gesperrt`: columns in which no stair may stand (in the world: the alleys). */
export function erschliessung(p: Patch, o: Occupancy, gesperrt?: Set<string>): Treppe[] {
	const byId = index(p).vertex;
	const hof = courtyards(p, o, 0),
		deck = decks(p, o),
		taken = new Set<string>(),
		out: Treppe[] = [];
	const area = new Map(p.cells.map((c) => [c.id, c.area]));
	// Rim cells are half cells: too narrow for a two-flight stair.
	const free = (id: string) =>
		!taken.has(id) &&
		!gesperrt?.has(id) &&
		!hof.has(id) &&
		!byId.get(id)!.boundary &&
		(area.get(id) ?? 0) >= MIN_AREA &&
		LEVELS.every((h) => !occupied(o, id, h));
	const group = (id: string, h: number) => o[address(id, h)]?.group ?? 'tinte';
	/** Free neighboring column: inner cells before rim cells, then toward the camera (southwest), then ID. */
	const place = (anchors: string[]) => {
		for (const a of anchors) {
			const pa = byId.get(a)!.point;
			const score = (id: string) => {
				const q = byId.get(id)!;
				return (q.boundary ? 100 : 0) + (q.point[0] - pa[0] + (q.point[1] - pa[1])) / 10;
			};
			const pick = byId
				.get(a)!
				.neighbors.filter(free)
				.sort((x, y) => score(x) - score(y) || (x < y ? -1 : 1))[0];
			if (pick) return { vertexId: pick, anchor: a };
		}
		return undefined;
	};
	const add = (art: TreppenArt, anchors: string[], level: number, z: number, g: string) => {
		const at = place(anchors);
		if (!at) return;
		taken.add(at.vertexId);
		out.push({ id: `treppe:${art}:${at.vertexId}`, art, ...at, level, z, group: g });
	};

	// Interventions: connected new occupancy (horizontal and vertical), frames included.
	const seen = new Set<string>();
	const neu = (id: string, h: number) =>
		occupied(o, id, h) && !isBestand(o, id, h) && !isWeg(o, id, h);
	const parts: [string, number][][] = [];
	for (const v of [...p.vertices].sort((a, b) => (a.id < b.id ? -1 : 1)))
		for (const h of LEVELS) {
			if (!neu(v.id, h) || seen.has(address(v.id, h))) continue;
			const part: [string, number][] = [[v.id, h]];
			seen.add(address(v.id, h));
			for (let i = 0; i < part.length; i++) {
				const [id, l] = part[i];
				for (const [n, k] of [
					...byId.get(id)!.neighbors.map((n) => [n, l] as [string, number]),
					[id, l - 1] as [string, number],
					[id, l + 1] as [string, number]
				])
					if (LEVELS.includes(k) && neu(n, k) && !seen.has(address(n, k))) {
						seen.add(address(n, k));
						part.push([n, k]);
					}
			}
			parts.push(part);
		}
	const deckAt = (id: string, h: number) => deck.get(h)?.has(id) ?? false;
	const floating: [string, number][][] = [];
	for (const part of parts) {
		const bodies = part.filter(([id, h]) => solid(o, id, h) && !deckAt(id, h));
		if (!bodies.length) continue;
		const top = Math.max(...bodies.map(([, h]) => h)),
			base = Math.min(...part.map(([, h]) => h));
		const anchors = [...new Set(bodies.filter(([, h]) => h === top).map(([id]) => id))].sort();
		// Enclosed cores (inside a frame) dock via the remaining columns of the intervention.
		const rest = [...new Set(part.map(([id]) => id))].filter((id) => !anchors.includes(id)).sort();
		// Rooftop extensions use the stairwell of the existing stock; only own floors are counted.
		const onBestand = part.some(([id, h]) => h === base && isBestand(o, id, h - 1));
		const storeys = top - base + 1;
		if (storeys >= TURM)
			add(
				storeys >= TURM + 1 ? 'turm' : 'lauf',
				[...anchors, ...rest],
				top,
				top * HEIGHT_STEP,
				group(anchors[0], top)
			);
		else if (base > 0 && !onBestand && !part.some(([id, h]) => deckAt(id, h)))
			floating.push(bodies);
	}
	// Walkway ends: ends first (fewest deck neighbors), then the rest of the group.
	for (const h of LEVELS) {
		const set = deck.get(h) ?? new Set<string>(),
			pending = new Set([...set].sort());
		while (pending.size) {
			const comp = [pending.values().next().value!];
			pending.delete(comp[0]);
			for (let i = 0; i < comp.length; i++)
				for (const n of byId.get(comp[i])!.neighbors) if (pending.delete(n)) comp.push(n);
			const degree = (id: string) => byId.get(id)!.neighbors.filter((n) => set.has(n)).length;
			comp.sort((a, b) => degree(a) - degree(b) || (a < b ? -1 : 1));
			add('lauf', comp, h, h * HEIGHT_STEP + DECK, group(comp[0], h));
		}
	}
	for (const bodies of floating) {
		const low = Math.min(...bodies.map(([, h]) => h));
		const anchors = [...new Set(bodies.filter(([, h]) => h === low).map(([id]) => id))].sort();
		add('wendel', anchors, low, low * HEIGHT_STEP, group(anchors[0], low));
	}
	return out;
}
