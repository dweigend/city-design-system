/**
 * Existing stock as a historic perimeter structure (logic). Every protected build cell is a house of the
 * perimeter block; the corner module draws its volume (existing-stock bits, gray). This is where the
 * data for the details is made: outline as in the module (edge midpoints and slot centers), open
 * facade pieces per floor (punched facade) and the roof. Forms: formen/eckbestand.ts.
 */
import type { Point2 } from '../vocab';
import type { Patch } from './topology';
import { blockrand, HEIGHT_STEP, isBestand, occupied, solid, type Occupancy } from './state';
import { index } from './derive';

export type Fassade = {
	a: Point2;
	b: Point2;
	/** Outward unit normal. */
	out: Point2;
	/** Floors on which the piece is exposed (windows visible). */
	levels: number[];
};
export type Dach = 'sattel' | 'traufe' | 'eckturm';
export type Haus = {
	/** Parcel: rim cell (street) plus the cell behind it, same height, one roof. */
	id: string;
	cells: string[];
	/** Convex hull of the cell outlines (roof plan). */
	outline: Point2[];
	center: Point2;
	/** Number of existing floors from level 0. */
	levels: number;
	fassaden: Fassade[];
	/** null: a rooftop extension or structural frame sits on top, no roof. */
	dach: Dach | null;
	/** Ridge direction in radians (eaves to the street: parallel to the street = patch edge). */
	first: number;
	/** Outer corner point (rim cells), e.g. for the corner turret. */
	corner?: Point2;
};

const mid = (a: Point2, b: Point2): Point2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const avg = (ps: Point2[]): Point2 => [
	ps.reduce((s, q) => s + q[0], 0) / ps.length,
	ps.reduce((s, q) => s + q[1], 0) / ps.length
];

/** The shared edge of two vertices lies on the patch edge (only one face). */
export const boundaryEdge = (p: Patch, a: string, b: string) => {
	const ix = index(p);
	return ix.vertex.get(a)!.faces.filter((id) => ix.face.get(id)!.vertices.includes(b)).length === 1;
};

/**
 * Outline of a build cell exactly as in the corner module: slot center (bilinear = mean of the four
 * corners) and edge midpoints, for rim cells also the vertex itself. Counterclockwise.
 */
export function cellOutline(p: Patch, id: string): Point2[] {
	const byId = index(p).vertex;
	const v = byId.get(id)!;
	const pts: Point2[] = [];
	const push = (q: Point2) => {
		if (!pts.some((r) => Math.hypot(r[0] - q[0], r[1] - q[1]) < 1e-6)) pts.push(q);
	};
	for (const fid of v.faces) {
		const f = index(p).face.get(fid)!;
		const i = f.vertices.indexOf(id);
		push(mid(v.point, byId.get(f.vertices[(i + 1) % 4])!.point));
		push(avg(f.vertices.map((w) => byId.get(w)!.point)));
		push(mid(v.point, byId.get(f.vertices[(i + 3) % 4])!.point));
	}
	if (v.boundary) push(v.point);
	const c = avg(pts);
	return pts.sort(
		(a, b) => Math.atan2(a[1] - c[1], a[0] - c[0]) - Math.atan2(b[1] - c[1], b[0] - c[0])
	);
}

/** Convex hull (monotone chain), counterclockwise. */
function hull(points: Point2[]): Point2[] {
	const ps = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const cross = (o: Point2, a: Point2, b: Point2) =>
		(a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const half = (list: Point2[]) => {
		const out: Point2[] = [];
		for (const q of list) {
			while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 1e-9)
				out.pop();
			out.push(q);
		}
		return out.slice(0, -1);
	};
	return [...half(ps), ...half([...ps].reverse())];
}

/** Open facade pieces of an existing-stock cell up to the eaves. */
function fassadenOf(p: Patch, o: Occupancy, id: string, levels: number): Fassade[] {
	const byId = index(p).vertex;
	const v = byId.get(id)!;
	const center = avg(cellOutline(p, id));
	const out: Fassade[] = [];
	const add = (a: Point2, b: Point2, open: number[]) => {
		const dx = b[0] - a[0],
			dy = b[1] - a[1],
			l = Math.hypot(dx, dy) || 1,
			m = mid(a, b);
		let n: Point2 = [dy / l, -dx / l];
		if (n[0] * (m[0] - center[0]) + n[1] * (m[1] - center[1]) < 0) n = [-n[0], -n[1]];
		if (open.length) out.push({ a, b, out: n, levels: open });
	};
	const open = (other: string | null) =>
		Array.from({ length: levels }, (_, h) => h).filter(
			(h) => other === null || !solid(o, other, h)
		);
	for (const fid of v.faces) {
		const f = index(p).face.get(fid)!;
		const i = f.vertices.indexOf(id);
		const c = avg(f.vertices.map((w) => byId.get(w)!.point));
		for (const w of [f.vertices[(i + 1) % 4], f.vertices[(i + 3) % 4]]) {
			const m = mid(v.point, byId.get(w)!.point);
			add(m, c, open(w));
			// Patch edge: street facade from the vertex to the edge midpoint.
			if (boundaryEdge(p, id, w)) add(v.point, m, open(null));
		}
	}
	return out;
}

/** Preset per existing-stock cell when the parcels do not come from the L10 perimeter block (world). */
export type Parzelle = {
	parcel: string;
	/** Ridge direction in radians. */
	first?: number;
	dach?: Dach;
	/** Outer corner point for the corner turret. */
	corner?: Point2;
};

/**
 * Existing houses (parcels) with facade pieces and roof. Deterministic, from the occupancy only.
 * `plan` sets parcel, ridge and roof form per cell; without it the L10 perimeter block applies.
 */
export function haeuser(p: Patch, o: Occupancy, plan?: Map<string, Parzelle>): Haus[] {
	const byId = index(p).vertex;
	const parcel = plan
		? new Map([...plan].map(([id, q]) => [id, q.parcel]))
		: new Map(blockrand(p).map((b) => [b.id, b.parcel]));
	const groups = new Map<string, string[]>();
	for (const v of p.vertices)
		if (isBestand(o, v.id, 0)) {
			const key = parcel.get(v.id) ?? v.id;
			groups.set(key, [...(groups.get(key) ?? []), v.id]);
		}
	return [...groups].map(([key, cells]): Haus => {
		const height = (id: string) => {
			let n = 0;
			while (isBestand(o, id, n)) n++;
			return n;
		};
		const levels = Math.min(...cells.map(height));
		const outline = hull(cells.flatMap((id) => cellOutline(p, id))),
			center = avg(outline);
		const street = byId.get(key) ?? byId.get(cells[0])!,
			given = plan?.get(cells[0]);
		// Eaves to the street: ridge parallel to the edge; a corner turret at the block corner.
		const rand = street.neighbors
			.filter((w) => boundaryEdge(p, street.id, w))
			.map((w) => byId.get(w)!.point);
		const dirs = rand.map((q) => Math.atan2(q[1] - street.point[1], q[0] - street.point[0]));
		const straight =
			dirs.length === 2 && Math.abs(Math.cos(dirs[0] - dirs[1])) > Math.cos((25 * Math.PI) / 180);
		const covered = cells.some((id) => occupied(o, id, height(id)));
		const dach: Dach | null = covered
			? null
			: given?.dach
				? given.dach
				: !street.boundary
					? 'traufe'
					: straight
						? 'sattel'
						: 'eckturm';
		return {
			id: key,
			cells,
			outline,
			center,
			levels,
			fassaden: cells.flatMap((id) => fassadenOf(p, o, id, height(id))),
			dach,
			first: given?.first ?? dirs[0] ?? 0,
			...(given?.corner
				? { corner: given.corner }
				: street.boundary
					? { corner: street.point }
					: {})
		};
	});
}

/** Eaves height of a house. */
export const traufe = (h: Haus) => h.levels * HEIGHT_STEP;
