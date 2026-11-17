import type { Patch } from './topology';
export const HEIGHT_STEP = 4;
/** Highest level (towers): levels 0 … MAX_LEVEL, one floor of HEIGHT_STEP each. */
export const MAX_LEVEL = 6;
/** Group of the protected existing stock; such occupancies are immutable. */
export const BESTAND = 'bestand';
/** Group of an empty frame (frame without plug-in module). */
export const GERUEST = 'geruest';
/**
 * Path groups (round 3): the build cell is clear space above a narrow path on its
 * floor. Paths of the same group connect along the mesh edges, also across one floor
 * (stair flight). `weg` = footpath/elevated walkway, `bahn` = track.
 */
export const WEG = 'weg';
export const BAHN = 'bahn';
/**
 * An occupancy. `frame`: frame/scaffold around the build cell. Group `geruest` with a frame =
 * empty frame (hollow); any other group with a frame = colored plug-in module in the frame.
 */
export type Sample = Readonly<{ occupied: boolean; group: string; frame?: boolean }>;
export type Occupancy = Readonly<Record<string, Sample>>;
/**
 * Intent of an intervention. `frame: true` sets a frame (around an existing module
 * or empty). Removing first takes the module out of the frame, then the frame.
 */
export type Intent = {
	vertexId: string;
	level: number;
	occupied: boolean;
	group: string;
	frame?: boolean;
};
export type History = { initial: Occupancy; intents: Intent[]; cursor: number };
/** Occupancy key of build cell `id` on `level`: `${id}@${level}`. */
export const address = (id: string, level: number) => `${id}@${level}`;
/** Whether the cell has an occupied sample on `level` (any group, paths and frames included). */
export const occupied = (o: Occupancy, id: string, level: number) =>
	o[address(id, level)]?.occupied ?? false;
/** Occupied and not hollow: carries a volume (existing stock, function, plug-in module). */
export const solid = (o: Occupancy, id: string, level: number) =>
	occupied(o, id, level) && o[address(id, level)].group !== GERUEST && !isWeg(o, id, level);
/** Path or track: occupied, but without a volume. */
export const isWeg = (o: Occupancy, id: string, level: number) => {
	const g = o[address(id, level)]?.group;
	return g === WEG || g === BAHN;
};
/** Occupied with building mass or frame, so not a path: counts as wall, roof and bearing. */
export const built = (o: Occupancy, id: string, level: number) =>
	occupied(o, id, level) && !isWeg(o, id, level);
/** Whether the sample is protected existing stock (group `bestand`). */
export const isBestand = (o: Occupancy, id: string, level: number) =>
	o[address(id, level)]?.group === BESTAND;
/** Whether the sample is an empty frame (occupied, group `geruest`). */
export const isHollow = (o: Occupancy, id: string, level: number) =>
	occupied(o, id, level) && o[address(id, level)].group === GERUEST;
/** Whether the occupied sample stands in a frame (empty or with a plug-in module). */
export const hasFrame = (o: Occupancy, id: string, level: number) =>
	occupied(o, id, level) && !!o[address(id, level)].frame;
/** Corner of the perimeter block; reference cell for tests and scenes. */
export const protectedVertex = (p: Patch) => p.vertices.find((v) => v.id === 'rim0')!.id;

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * Historic perimeter block along the two rear patch edges (rim4 → rim0 → rim1), two cells deep:
 * rim cell (street facade) plus the cell behind it form a parcel of equal height,
 * 3–4 floors, the corner house at rim0 with 5. Deterministic per vertex ID.
 */
export function blockrand(p: Patch): { id: string; levels: number; parcel: string }[] {
	const angle = (q: [number, number]) => ((Math.atan2(q[1], q[0]) * 180) / Math.PI + 360) % 360;
	const inRange = (q: [number, number]) => {
		const a = angle(q);
		return a <= 66 || a >= 320;
	};
	const front = p.vertices
		.filter((v) => v.boundary && inRange(v.point))
		.sort((a, b) => (a.id < b.id ? -1 : 1));
	const diff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
	const back = p.vertices.filter(
		(v) =>
			!v.boundary &&
			inRange(v.point) &&
			Math.hypot(...v.point) > 11 &&
			v.neighbors.some((n) => front.some((f) => f.id === n))
	);
	const levels = (id: string) => (id === 'rim0' ? 5 : 3 + (hash(id) % 2));
	return [
		...front.map((v) => ({ id: v.id, levels: levels(v.id), parcel: v.id })),
		...back.map((v) => {
			const f = front
				.filter((f) => v.neighbors.includes(f.id))
				.sort(
					(a, b) =>
						diff(angle(a.point), angle(v.point)) - diff(angle(b.point), angle(v.point)) ||
						(a.id < b.id ? -1 : 1)
				)[0];
			return { id: v.id, levels: levels(f.id), parcel: f.id };
		})
	];
}

/** Protected perimeter block of `p` (group `bestand`) as a new occupancy; the start of every scene. */
export function initialOccupancy(p: Patch): Occupancy {
	return Object.fromEntries(
		blockrand(p).flatMap(({ id, levels }) =>
			Array.from({ length: levels }, (_, h) => [address(id, h), { occupied: true, group: BESTAND }])
		)
	);
}
/**
 * Applies one intent and returns a new occupancy; `o` is never mutated. Returns `o` itself
 * (same reference) when the intent is rejected: non-integer level or outside 0 … MAX_LEVEL,
 * group `bestand`, target is existing stock, or unknown vertex. Removing a plug-in module from a
 * frame leaves the empty frame; removing again clears the cell.
 */
export function apply(p: Patch, o: Occupancy, i: Intent): Occupancy {
	const key = address(i.vertexId, i.level),
		before = o[key];
	if (
		!Number.isInteger(i.level) ||
		i.level < 0 ||
		i.level > MAX_LEVEL ||
		i.group === BESTAND ||
		before?.group === BESTAND ||
		!p.vertices.some((v) => v.id === i.vertexId)
	)
		return o;
	const next = { ...o };
	if (i.occupied && i.frame)
		next[key] = {
			occupied: true,
			group: before?.occupied ? before.group : GERUEST,
			frame: true
		};
	else if (i.occupied)
		next[key] = before?.frame
			? { occupied: true, group: i.group, frame: true }
			: { occupied: true, group: i.group };
	else if (before?.frame && before.group !== GERUEST)
		next[key] = { occupied: true, group: GERUEST, frame: true };
	else delete next[key];
	return next;
}
/** Empty edit history over `initial` (kept by reference). */
export const history = (initial: Occupancy): History => ({ initial, intents: [], cursor: 0 });
/** Occupancy at the cursor: `initial` with the first `cursor` intents replayed in order. */
export const restore = (p: Patch, h: History) =>
	h.intents.slice(0, h.cursor).reduce((o, i) => apply(p, o, i), h.initial);
/**
 * Records intent `i` at the cursor and drops the redo branch. Returns `h` itself when the intent
 * changes nothing. Returns a new history; `h` and `i` are not mutated (the intent is copied).
 */
export function edit(p: Patch, h: History, i: Intent): History {
	const before = restore(p, h),
		after = apply(p, before, i);
	if (JSON.stringify(before) === JSON.stringify(after)) return h;
	return { ...h, intents: [...h.intents.slice(0, h.cursor), { ...i }], cursor: h.cursor + 1 };
}
/** Moves the cursor one intent back (not below 0); intents are kept for redo. New object. */
export const undo = (h: History): History => ({ ...h, cursor: Math.max(0, h.cursor - 1) });
/** Moves the cursor one intent forward (not beyond the recorded intents). New object. */
export const redo = (h: History): History => ({
	...h,
	cursor: Math.min(h.intents.length, h.cursor + 1)
});
