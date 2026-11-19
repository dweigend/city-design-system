/**
 * One crown per intervention: connected build cells of the same group (horizontally across
 * neighboring vertices, vertically across levels) form an intervention. The crown sits on the
 * highest point, there on the most strongly connected cell. Walkway decks and existing stock
 * carry no crown, nor do empty frames and cells under a frame, nor single-story interventions (the crown only tops something stacked). Pure logic; presentation.ts chooses the form via funktion.ts.
 */
import type { Patch } from './topology';
import { HEIGHT_STEP, address, isBestand, occupied, solid, type Occupancy } from './state';
import { decks, index, LEVELS } from './derive';

export type Head = { vertexId: string; level: number; group: string; size: number };

/**
 * Crowns of `o`, at most one per connected intervention, in discovery order (patch vertex order,
 * then level). Ties on the top level break by neighbor count, then vertex ID. Pure; detached.
 */
export function heads(p: Patch, o: Occupancy): Head[] {
	const deck = decks(p, o);
	const byId = index(p).vertex;
	const group = (id: string, h: number) => o[address(id, h)]?.group;
	const eligible = (id: string, h: number) =>
		solid(o, id, h) && !isBestand(o, id, h) && !deck.get(h)?.has(id);
	const seen = new Set<string>(),
		out: Head[] = [];
	for (const v of p.vertices)
		for (const h of LEVELS) {
			if (!eligible(v.id, h) || seen.has(address(v.id, h))) continue;
			const g = group(v.id, h)!;
			const part: [string, number][] = [[v.id, h]];
			seen.add(address(v.id, h));
			for (let i = 0; i < part.length; i++) {
				const [id, lv] = part[i];
				const next: [string, number][] = [
					...byId.get(id)!.neighbors.map((n) => [n, lv] as [string, number]),
					[id, lv - 1],
					[id, lv + 1]
				];
				for (const [n, l] of next)
					if (
						LEVELS.includes(l) &&
						eligible(n, l) &&
						group(n, l) === g &&
						!seen.has(address(n, l))
					) {
						seen.add(address(n, l));
						part.push([n, l]);
					}
			}
			const top = Math.max(...part.map(([, l]) => l));
			// Only something stacked (at least two floors) gets a crown.
			if (top - Math.min(...part.map(([, l]) => l)) < 1) continue;
			const score = ([id, l]: [string, number]) =>
				byId.get(id)!.neighbors.filter((n) => occupied(o, n, l) && group(n, l) === g).length;
			const best = part
				.filter(([id, l]) => l === top && !occupied(o, id, l + 1))
				.sort((a, b) => score(b) - score(a) || (a[0] < b[0] ? -1 : 1))[0];
			if (best) out.push({ vertexId: best[0], level: best[1], group: g, size: part.length });
		}
	return out;
}

/** Roof height of a crown: top of its level. */
export const headZ = (h: Head) => (h.level + 1) * HEIGHT_STEP;
