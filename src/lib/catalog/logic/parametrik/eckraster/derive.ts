import type { Slot, Stilt } from '../eck';
import type { Face, Patch, Vertex } from './topology';
import { DECK } from '../formen/eck';
import {
	address,
	built,
	hasFrame,
	HEIGHT_STEP,
	isBestand,
	isHollow,
	isWeg,
	MAX_LEVEL,
	occupied,
	solid,
	type Occupancy
} from './state';
import { groupToken, type Farben } from './funktion';
/** Authored levels 0 … MAX_LEVEL; slots run from the ground slot −1 to MAX_LEVEL. */
export const LEVELS = Array.from({ length: MAX_LEVEL + 1 }, (_, h) => h);
export const SLOT_LEVELS = [-1, ...LEVELS];

type Index = {
	vertex: Map<string, Vertex>;
	face: Map<string, Face>;
	faceIndex: Map<string, number>;
	/** Neighbors across edges and diagonals (all corners of the adjacent faces). */
	around: Map<string, string[]>;
};
const cache = new WeakMap<Patch, Index>();
/** Lookup tables per patch: large meshes (world) stay linear. */
export function index(p: Patch): Index {
	let i = cache.get(p);
	if (!i) {
		const face = new Map(p.faces.map((f) => [f.id, f]));
		i = {
			vertex: new Map(p.vertices.map((v) => [v.id, v])),
			face,
			faceIndex: new Map(p.faces.map((f, k) => [f.id, k])),
			around: new Map(
				p.vertices.map((v) => [
					v.id,
					[...new Set([...v.neighbors, ...v.faces.flatMap((id) => face.get(id)!.vertices)])]
				])
			)
		};
		cache.set(p, i);
	}
	return i;
}

/** Conservative diagonal escape prevents point contacts from masquerading as walls. */
export function courtyards(p: Patch, o: Occupancy, level = 0): Set<string> {
	const ix = index(p);
	const free = new Set(p.vertices.filter((v) => !built(o, v.id, level)).map((v) => v.id));
	const exterior = new Set(p.vertices.filter((v) => v.boundary && free.has(v.id)).map((v) => v.id));
	const queue = [...exterior];
	for (let i = 0; i < queue.length; i++)
		for (const n of ix.around.get(queue[i])!)
			if (free.has(n) && !exterior.has(n)) {
				exterior.add(n);
				queue.push(n);
			}
	// Reject a whole enclosed region if any part is roofed or unsupported.
	const result = new Set<string>(),
		pending = new Set([...free].filter((id) => !exterior.has(id)));
	while (pending.size) {
		const region = [pending.values().next().value!];
		pending.delete(region[0]);
		for (let i = 0; i < region.length; i++)
			for (const n of ix.vertex.get(region[i])!.neighbors) if (pending.delete(n)) region.push(n);
		if (
			region.every(
				(id) =>
					(level === 0 || built(o, id, level - 1)) &&
					Array.from({ length: MAX_LEVEL - level }, (_, i) => level + i + 1).every(
						(h) => !built(o, id, h)
					)
			)
		)
			region.forEach((id) => result.add(id));
	}
	return result;
}
/**
 * Elevated free components need two separated, grounded abutments. No structural simulation.
 * Only new solid samples become decks; empty scaffolds and the existing stock stay what they are.
 */
export function spans(p: Patch, o: Occupancy, level: number): Set<string> {
	const ix = index(p);
	const pending = new Set(
			p.vertices
				.filter(
					(v) =>
						!built(o, v.id, level) && solid(o, v.id, level + 1) && !isBestand(o, v.id, level + 1)
				)
				.map((v) => v.id)
		),
		result = new Set<string>();
	while (pending.size) {
		const region = [pending.values().next().value!];
		pending.delete(region[0]);
		for (let i = 0; i < region.length; i++)
			for (const n of ix.vertex.get(region[i])!.neighbors) if (pending.delete(n)) region.push(n);
		const supports = [...new Set(region.flatMap((id) => ix.vertex.get(id)!.neighbors))].filter(
			(id) =>
				built(o, id, level + 1) &&
				Array.from({ length: level + 1 }, (_, h) => h).every((h) => built(o, id, h))
		);
		const center = region.reduce(
			(a, id) => {
				const q = ix.vertex.get(id)!.point;
				return [a[0] + q[0] / region.length, a[1] + q[1] / region.length];
			},
			[0, 0]
		);
		if (
			supports.some((a) =>
				supports.some((b) => {
					const x = ix.vertex.get(a)!.point,
						y = ix.vertex.get(b)!.point;
					return (
						(x[0] - center[0]) * (y[0] - center[0]) + (x[1] - center[1]) * (y[1] - center[1]) < 0
					);
				})
			)
		)
			region.forEach((id) => result.add(id));
	}
	return result;
}
const deckCache = new WeakMap<Occupancy, { p: Patch; decks: Map<number, Set<string>> }>();
/** Walkway decks per level: build cells that lie as an open deck between two bearings. */
export function decks(p: Patch, o: Occupancy): Map<number, Set<string>> {
	const hit = deckCache.get(o);
	if (hit?.p === p) return hit.decks;
	const result = new Map(LEVELS.map((h) => [h, h > 0 ? spans(p, o, h - 1) : new Set<string>()]));
	deckCache.set(o, { p, decks: result });
	return result;
}
/**
 * Columns under paths: at nodes (end, branch, landing of a flight) and otherwise at every
 * second landing, each down to the next thing below (ground or roof).
 */
function wegStuetzen(p: Patch, o: Occupancy): Map<string, Stilt[]> {
	const ix = index(p),
		out = new Map<string, Stilt[]>(),
		has = new Set<string>();
	const group = (id: string, h: number) => o[address(id, h)]?.group;
	const list = p.vertices
		.flatMap((v) => LEVELS.filter((h) => h > 0 && isWeg(o, v.id, h)).map((h) => ({ v, h })))
		.sort((a, b) => a.h - b.h || (a.v.id < b.v.id ? -1 : 1));
	for (const { v, h } of list) {
		if (built(o, v.id, h - 1)) continue;
		const flat = v.neighbors.filter((n) => group(n, h) === group(v.id, h));
		const node = flat.length !== 2;
		if (!node && flat.some((n) => has.has(address(n, h)))) continue;
		has.add(address(v.id, h));
		let from = 0,
			frei = true;
		for (let k = h - 1; k >= 0 && frei; k--)
			if (isWeg(o, v.id, k)) frei = false;
			else if (occupied(o, v.id, k)) {
				from = (k + 1) * HEIGHT_STEP;
				break;
			}
		// No column stands above a lower path: it would stand in the middle of the path.
		if (!frei) continue;
		const f = ix.face.get(v.faces[0])!,
			key = `${f.id}@${h - 1}`;
		out.set(key, [...(out.get(key) ?? []), { corner: f.vertices.indexOf(v.id), from }]);
	}
	return out;
}
/**
 * Slots are story-centered (Townscaper): slot h holds the upper half of level h and the
 * lower half of level h + 1, so one level = one full HEIGHT_STEP from h·4 to (h+1)·4 and
 * level 0 stands on the ground. Floor joints and roofs lie at zMid.
 * `farben` replaces the color per group (the world's color codes); without it `groupToken` applies.
 */
export function slots(p: Patch, o: Occupancy, farben?: Farben): Slot[] {
	const ix = index(p);
	const token = farben?.token ?? groupToken;
	const mask = (ids: string[], h: number) =>
		ids.reduce(
			(m, id, i) =>
				m + (occupied(o, id, h) ? 2 ** i : 0) + (occupied(o, id, h + 1) ? 2 ** (i + 4) : 0),
			0
		);
	const deck = decks(p, o);
	const isDeck = (id: string, h: number) => deck.get(h)?.has(id) ?? false;
	// Stilts: every floating, non-deck sample gets one column at its vertex, down to the
	// next solid below (ground, roof or deck top). The first incident face emits it.
	const stilts = new Map<string, Stilt[]>();
	for (const v of p.vertices)
		for (const h of LEVELS) {
			if (h === 0 || !built(o, v.id, h) || isDeck(v.id, h)) continue;
			if (built(o, v.id, h - 1) && !isDeck(v.id, h - 1)) continue;
			let from = 0;
			for (let k = h - 1; k >= 0; k--)
				if (built(o, v.id, k)) {
					from = isDeck(v.id, k) ? k * HEIGHT_STEP + DECK : (k + 1) * HEIGHT_STEP;
					break;
				}
			const f = ix.face.get(v.faces[0])!;
			const key = `${f.id}@${h - 1}`;
			stilts.set(key, [...(stilts.get(key) ?? []), { corner: f.vertices.indexOf(v.id), from }]);
		}
	const anyWeg = p.vertices.some((v) => LEVELS.some((h) => isWeg(o, v.id, h)));
	const wegStilts = anyWeg ? wegStuetzen(p, o) : new Map<string, Stilt[]>();
	const group = (id: string, h: number) => o[address(id, h)]?.group;
	const bits = (ids: string[], h: number, test: (id: string, l: number) => boolean) =>
		ids.reduce(
			(m, id, i) => m | (test(id, h) ? 1 << i : 0) | (test(id, h + 1) ? 1 << (i + 4) : 0),
			0
		);
	return SLOT_LEVELS.flatMap((h) => {
		const hof = h >= 0 ? courtyards(p, o, h) : new Set<string>();
		return p.faces.map((f): Slot => {
			const m = mask(f.vertices, h);
			const deckMask = bits(f.vertices, h, isDeck);
			const bestand = bits(f.vertices, h, (id, l) => isBestand(o, id, l));
			const weg = anyWeg && m ? bits(f.vertices, h, (id, l) => isWeg(o, id, l)) : 0;
			// Flight upward from the upper path bit: to the neighboring corner one level higher, without a level connection.
			let wegAuf = 0;
			if (weg >> 4)
				f.vertices.forEach((id, i) => {
					if (!((weg >> (i + 4)) & 1) || isWeg(o, id, h + 2)) return;
					[f.vertices[(i + 1) % 4], f.vertices[(i + 3) % 4]].forEach((w, d) => {
						if (isWeg(o, w, h + 2) && !isWeg(o, w, h + 1) && group(w, h + 2) === group(id, h + 1))
							wegAuf |= 1 << (2 * i + d);
					});
				});
			return {
				id: `${f.id}@${h}`,
				corners: f.vertices.map((id) => ix.vertex.get(id)!.point) as Slot['corners'],
				zLow: h * HEIGHT_STEP + HEIGHT_STEP / 2,
				zHigh: (h + 1) * HEIGHT_STEP + HEIGHT_STEP / 2,
				mask: m,
				seed: p.seed + ix.faceIndex.get(f.id)! * 31 + h,
				context: {
					neighborFilled: f.neighbors.map(
						(id) => id !== null && mask(ix.face.get(id)!.vertices, h) !== 0
					) as Slot['context']['neighborFilled'],
					openAbove: f.vertices.every((id) => !occupied(o, id, h + 2)),
					ground: h === -1,
					courtyard:
						f.vertices.some((id) => hof.has(id)) &&
						f.vertices.filter((id) => !occupied(o, id, h)).every((id) => hof.has(id)),
					span: deckMask !== 0,
					role: 'neu',
					...(bestand ? { bestand } : {}),
					centered: true,
					deck: deckMask,
					stilts: stilts.get(`${f.id}@${h}`) ?? [],
					frame: bits(f.vertices, h, (id, l) => hasFrame(o, id, l)),
					hollow: bits(f.vertices, h, (id, l) => isHollow(o, id, l)),
					owns: f.neighbors.map((id) => id === null || f.id < id) as Slot['context']['owns'],
					tokens: [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
						token(group(f.vertices[i % 4], i < 4 ? h : h + 1))
					),
					...(weg
						? {
								weg,
								dock: bits(
									f.vertices,
									h,
									(id, l) => solid(o, id, l) && !isBestand(o, id, l) && !isDeck(id, l)
								),
								wegStilts: wegStilts.get(`${f.id}@${h}`) ?? [],
								wegAuf
							}
						: {}),
					...(farben?.frame ? { frameToken: farben.frame } : {})
				}
			};
		});
	});
}
/** Short English explanation of which corner-module rule a slot follows (for labels). Pure. */
export const reason = (s: Slot) =>
	s.context.role === 'bestand' || (s.mask && (s.context.bestand ?? 0) === s.mask)
		? 'Protected existing stock'
		: (s.context.weg ?? 0) & s.mask
			? 'Path · footbridge on the mesh edges'
			: (s.context.hollow ?? 0) & s.mask
				? 'Frame · struts on the cell outline'
				: s.context.span
					? 'Walkway deck · two bearings · clear height kept free'
					: s.context.courtyard
						? 'Closed · open above · supported'
						: s.mask === 0
							? 'Empty'
							: s.context.stilts?.length
								? 'Cantilever · column down to the next thing below'
								: s.mask & 15 && !(s.mask >> 4)
									? 'Roof on the floor joint'
									: 'Shared envelope';
