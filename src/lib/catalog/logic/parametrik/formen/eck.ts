/**
 * Corner modules for L10 (docs/research/80-townscaper.md §3, §9–10; contract ../eck.ts).
 *
 * Octant model: corner i of the slot owns the quarter of the quad at corners[i]
 * (unit square u, v ∈ [0, ½] and so on). Lower bits fill the lower half
 * (zLow … zMid), upper bits the upper one (zMid … zHigh). Neighboring slots share the
 * corners, so their quarters meet without a seam: a build cell becomes the
 * dual polygon around its vertex, facades lie on the center lines of the slots.
 *
 * Geometry is created in the canonical frame (mask rotated to the smallest value of the four
 * rotations) and rotated back, then mapped bilinearly onto corners and linearly
 * onto zLow … zHigh. Faces without edges (edges: false); the module draws the contour
 * itself: only open facades, real corners, parapet, floor joint.
 */
import type { CornerMask, CornerModule, Slot, SlotContext } from '../eck';
import type { ColorToken, Primitive, Role, Vec3 } from '../types';
import type { Point2 } from '../vocab';
import { random } from '../random';
import { formFamily } from './index';

type UV = [number, number];

/* ── Masks and rotation ──────────────────────────────────── */

/** Rotates the mask by r quarter turns: bit i → bit i + r (per level). */
export function rotateMask(mask: CornerMask, r: number): CornerMask {
	const k = ((r % 4) + 4) % 4;
	const nib = (n: number) => ((n << k) | (n >> (4 - k))) & 15;
	return nib(mask & 15) | (nib((mask >> 4) & 15) << 4);
}

/**
 * Canonical form: smallest mask value over the four rotations.
 * turn = r with canonical = rotateMask(mask, r); canonical corner j = original corner j − r.
 */
export function canonical(mask: CornerMask): { mask: CornerMask; turn: number } {
	let best = { mask: rotateMask(mask, 0), turn: 0 };
	for (let r = 1; r < 4; r++) {
		const m = rotateMask(mask, r);
		if (m < best.mask) best = { mask: m, turn: r };
	}
	return best;
}

type Shape = 'empty' | 'corner' | 'edge' | 'diagonal' | 'inside corner' | 'full';
/** Shape of one level (four bits). */
export function nibbleShape(n: number): Shape {
	const c = [0, 1, 2, 3].filter((i) => (n >> i) & 1).length;
	if (c === 2) return n === 5 || n === 10 ? 'diagonal' : 'edge';
	return (['empty', 'corner', 'edge', 'inside corner', 'full'] as const)[c];
}

/** Readable name of a mask class, e.g. "edge", "bottom full / top corner". */
export function maskName(mask: CornerMask): string {
	const c = canonical(mask).mask,
		lo = c & 15,
		hi = c >> 4;
	if (c === 0) return 'empty';
	if (lo === hi) return lo === 15 ? 'full cell' : nibbleShape(lo);
	if (lo === 0) return `top only (${nibbleShape(hi)})`;
	if (hi === 0) return `bottom only (${nibbleShape(lo)})`;
	return `bottom ${nibbleShape(lo)} / top ${nibbleShape(hi)}`;
}

/** Bit pattern "top bottom" as text, bit 7 … 0: e.g. 0x31 → "0011 0001". */
export const maskBits = (mask: CornerMask) =>
	`${((mask >> 4) & 15).toString(2).padStart(4, '0')} ${(mask & 15).toString(2).padStart(4, '0')}`;

/** All mask classes under four rotations (70 of them, Burnside). */
export const maskClasses = (): CornerMask[] =>
	[...new Set(Array.from({ length: 256 }, (_, m) => canonical(m).mask))].sort((a, b) => a - b);

/* ── Color ───────────────────────────────────────────────── */

/**
 * Color comes from the context (contract ../eck.ts): `tokens` per corner bit or `token` per slot,
 * derived by the system part from the group/function of the occupancy. Without color: ink, i.e.
 * a paper surface with an ink line (plan drawing), not red.
 */
export const DEFAULT_TOKEN: ColorToken = '--paper';
/**
 * Accent to the main color for beams and crown details (meaning contract, data/color.ts):
 * never another flow color. Ink gets signal (Memphis), a function volume
 * gets ink, so that its color alone carries the function.
 */
export const accentOf = (main: ColorToken): ColorToken =>
	main === DEFAULT_TOKEN ? '--signal' : DEFAULT_TOKEN;
/** Former extra fields, now part of the contract (SlotContext). */
export type SlotExtra = Pick<SlotContext, 'token' | 'bestand'>;

/* ── Dimensions (meters) ─────────────────────────────────── */

/** Thickness of the walkway deck slab; columns on a deck start at zMid + DECK. */
export const DECK = 0.45;
/** Thickness of a path (footbridge, landing); columns on a path start at its top. */
export const WEG_D = 0.3;
/** Half path width: each of the two slots at a mesh edge draws one half. */
const WEG_B = 1.2;
const GELAENDER = 1.05,
	STUFEN = 8;
const ATTIKA = 0.7,
	ATTIKA_T = 0.3,
	BRUESTUNG = 1.1,
	BRUESTUNG_T = 0.18,
	TRAEGER = 1.5,
	STUETZE = 0.22,
	GARTEN = 0.15,
	KOPF_CHANCE = 0.3;
const KOEPFE = ['kopf-hut', 'kopf-kuppel', 'kopf-noppen', 'kopf-solarfeld'];

/* ── Quarters and edges in the unit square ───────────────── */

/** Quarter j as a grid cell (x, y) ∈ {0,1}²: 0 → (0,0), 1 → (1,0), 2 → (1,1), 3 → (0,1). */
const CELL: [number, number][] = [
	[0, 0],
	[1, 0],
	[1, 1],
	[0, 1]
];
const cellAt = (x: number, y: number) => CELL.findIndex(([a, b]) => a === x && b === y);

/** Open edge, counterclockwise around its filled quarter (fill on the left). */
type Edge = { a: UV; b: UV; cell: number; dir: UV };

/**
 * Open edges of one level. Inside: neighboring quarter empty. Boundary (side s): quarter filled
 * and neighboring slot on side s not occupied; otherwise the surface continues in the neighbor.
 */
function exposed(filled: boolean[], open: boolean[]): Edge[] {
	const out: Edge[] = [];
	filled.forEach((f, cell) => {
		if (!f) return;
		const [x, y] = CELL[cell],
			[x0, y0, x1, y1] = [x / 2, y / 2, (x + 1) / 2, (y + 1) / 2];
		// South, east, north, west; side s of the slot, if outside.
		const sides: [number, number, UV, UV, number][] = [
			[x, y - 1, [x0, y0], [x1, y0], 0],
			[x + 1, y, [x1, y0], [x1, y1], 1],
			[x, y + 1, [x1, y1], [x0, y1], 2],
			[x - 1, y, [x0, y1], [x0, y0], 3]
		];
		for (const [nx, ny, a, b, side] of sides) {
			const inside = nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;
			if (inside ? filled[cellAt(nx, ny)] : !open[side]) continue;
			if (!inside || !filled[cellAt(nx, ny)])
				out.push({ a, b, cell, dir: [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])] });
		}
	});
	return out;
}

const same = (p: UV, q: UV) => Math.abs(p[0] - q[0]) < 1e-9 && Math.abs(p[1] - q[1]) < 1e-9;

/**
 * Corner type at the start (end = false) or end of an edge: +1 convex (own quarter
 * turns), −1 concave (foreign quarter), 0 straight/open (continues in the neighbor).
 */
function turn(e: Edge, edges: Edge[], end: boolean): number {
	const p = end ? e.b : e.a;
	const other = edges.filter((o) => o !== e && same(end ? o.a : o.b, p));
	const bent = other.filter((o) => o.dir[0] !== e.dir[0] || o.dir[1] !== e.dir[1]);
	if (!bent.length) return 0;
	return bent.some((o) => o.cell === e.cell) ? 1 : -1;
}

/* ── Mapping ─────────────────────────────────────────────── */

/** Canonical → original: r quarter turns clockwise about (½, ½). */
const unturn = ([u, v]: UV, r: number): UV => {
	let p: UV = [u, v];
	for (let i = 0; i < r; i++) p = [p[1], 1 - p[0]];
	return p;
};

function mapper(slot: Slot, r: number) {
	const [q0, q1, q2, q3] = slot.corners;
	const plan = (p: UV): Point2 => {
		const [u, v] = unturn(p, r);
		return [
			(1 - u) * (1 - v) * q0[0] + u * (1 - v) * q1[0] + u * v * q2[0] + (1 - u) * v * q3[0],
			(1 - u) * (1 - v) * q0[1] + u * (1 - v) * q1[1] + u * v * q2[1] + (1 - u) * v * q3[1]
		];
	};
	const dist = (a: UV, b: UV) => {
		const [p, q] = [plan(a), plan(b)];
		return Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
	};
	// Metric length of one unit along u or v (canonical), for wall thicknesses.
	return { plan, lu: dist([0, 0.5], [1, 0.5]), lv: dist([0.5, 0], [0.5, 1]) };
}

/* ── Module ──────────────────────────────────────────────── */

export const eckModul: CornerModule = (slot) => {
	const frame = (slot.context.frame ?? 0) & slot.mask & 255;
	const weg = (slot.context.weg ?? 0) & slot.mask & 255;
	// Empty frames and paths carry no volume; plug-in modules (frame + function) do.
	const hollow = (slot.context.hollow ?? 0) | weg;
	const body: Slot = hollow & slot.mask ? { ...slot, mask: slot.mask & ~hollow & 255 } : slot;
	return [...bodies(body), ...(frame ? geruest(slot, frame) : []), ...(weg ? wege(slot, weg) : [])];
};

function bodies(slot: Slot): Primitive[] {
	const own = slot.context.bestand ?? 0,
		mask = slot.mask & 255;
	const part = (m: number, role: Slot['context']['role'], key = role): Slot => ({
		...slot,
		id: `${slot.id}-${key}`,
		mask: m,
		context: { ...slot.context, role, bestand: undefined }
	});
	if (slot.context.role === 'bestand' || !(own & mask)) return byColor(slot);
	// Mixed slot: existing-stock quarters gray and unchanged, the rest as an intervention beside them.
	return [...build(part(mask & own, 'bestand')), ...byColor(part(mask & ~own & 255, 'neu'))];
}

/** Splits the slot by color per corner bit; each color one volume, columns only once. */
function byColor(slot: Slot): Primitive[] {
	const tokens = slot.context.tokens;
	if (!tokens || slot.context.role === 'bestand') return build(slot);
	const parts = new Map<ColorToken, number>();
	for (let i = 0; i < 8; i++)
		if ((slot.mask >> i) & 1) {
			const t = tokens[i] ?? DEFAULT_TOKEN;
			parts.set(t, (parts.get(t) ?? 0) | (1 << i));
		}
	if (parts.size <= 1)
		return build({
			...slot,
			context: { ...slot.context, tokens: undefined, token: [...parts.keys()][0] }
		});
	return [...parts].flatMap(([token, m], k) =>
		build(
			{
				...slot,
				id: `${slot.id}-${token.replace('--', '')}`,
				mask: m,
				context: {
					...slot.context,
					tokens: undefined,
					token,
					deck: (slot.context.deck ?? 0) & m,
					stilts: k === 0 || !slot.context.stilts ? slot.context.stilts : []
				}
			},
			slot.mask
		)
	);
}

/** `all`: mask of the whole slot, so that partial volumes of one color build no roof under another. */
function build(slot: Slot, all = slot.mask): Primitive[] {
	if (!(slot.mask & 255)) return [];
	const { mask, turn: r } = canonical(slot.mask & 255);
	const allHi = rotateMask(all & 255, r) >> 4;
	const ctx = slot.context;
	const role: Role = ctx.role;
	const bestand = role === 'bestand';
	const main: ColorToken = bestand ? '--paper' : (ctx.token ?? DEFAULT_TOKEN);
	const accent: ColorToken = accentOf(main);
	// Canonical side j corresponds to original side j − r.
	const open = [0, 1, 2, 3].map((j) => !ctx.neighborFilled[(j - r + 4) % 4]);
	const lo = [0, 1, 2, 3].map((j) => !!((mask >> j) & 1));
	const hi = [0, 1, 2, 3].map((j) => !!((mask >> (j + 4)) & 1));
	const { plan, lu, lv } = mapper(slot, r);
	const zLow = slot.zLow,
		zHigh = Math.max(slot.zHigh, slot.zLow + 0.1),
		zMid = (zLow + zHigh) / 2;
	const out: Primitive[] = [];
	let n = 0;
	const id = (what: string) => `${slot.id}-${what}-${n++}`;
	const lines: [Vec3, Vec3][] = [];
	const seen = new Set<string>();
	const line = (a: Point2, b: Point2, za: number, zb = za) => {
		const key = [a, b]
			.map((p, i) => `${p[0].toFixed(3)},${p[1].toFixed(3)},${(i ? zb : za).toFixed(3)}`)
			.sort()
			.join('|');
		if (seen.has(key)) return;
		seen.add(key);
		lines.push([
			[a[0], a[1], za],
			[b[0], b[1], zb]
		]);
	};
	const prism = (
		poly: UV[],
		z: number,
		height: number,
		token: ColorToken,
		extra: Partial<Primitive> = {}
	) => {
		if (height <= 0) return;
		out.push({
			id: id('flaeche'),
			kind: 'prism',
			polygon: poly.map(plan),
			z,
			height,
			token: bestand ? '--paper' : token,
			role,
			material: 'concrete',
			edges: false,
			...extra
		} as Primitive);
	};
	const quarter = (cell: number): UV[] => {
		const [x, y] = CELL[cell];
		return [
			[x / 2, y / 2],
			[(x + 1) / 2, y / 2],
			[(x + 1) / 2, (y + 1) / 2],
			[x / 2, (y + 1) / 2]
		];
	};
	/** Fills the marked quarters; four at once as one volume. */
	const fill = (cells: boolean[], z: number, h: number, token: ColorToken) => {
		if (cells.every(Boolean))
			prism(
				[
					[0, 0],
					[1, 0],
					[1, 1],
					[0, 1]
				],
				z,
				h,
				token
			);
		else cells.forEach((f, c) => f && prism(quarter(c), z, h, token));
	};
	/** Inner parallel of an edge at distance t (meters), mitered at corners. */
	const inner = (e: Edge, edges: Edge[], t: number): [UV, UV] => {
		const du = t / lu,
			dv = t / lv;
		const off: UV = [-e.dir[1] * du, e.dir[0] * dv];
		const along: UV = [e.dir[0] * du, e.dir[1] * dv];
		const sa = turn(e, edges, false),
			sb = turn(e, edges, true);
		return [
			[e.a[0] + off[0] + sa * along[0], e.a[1] + off[1] + sa * along[1]],
			[e.b[0] + off[0] - sb * along[0], e.b[1] + off[1] - sb * along[1]]
		];
	};
	/** Edge as parapet or attic: band on the miter plus top and inner line. */
	const rim = (
		e: Edge,
		edges: Edge[],
		z: number,
		h: number,
		t: number,
		token: ColorToken,
		material: 'concrete' | 'metal' = 'concrete'
	) => {
		const [ai, bi] = inner(e, edges, t);
		prism([e.a, e.b, bi, ai], z, h, token, { material });
		line(plan(e.a), plan(e.b), z + h);
		line(plan(ai), plan(bi), z + h);
		line(plan(ai), plan(bi), z);
		for (const [p, end] of [
			[e.a, false],
			[e.b, true]
		] as const)
			if (turn(e, edges, end)) line(plan(p), plan(p), z, z + h);
	};
	/** Contour of a facade layer z0 … z1: bottom edge (if bottom), top edge, vertical corners. */
	const facade = (
		edges: Edge[],
		all: Edge[],
		z0: number,
		z1: number,
		top: boolean,
		bottom = true
	) => {
		for (const e of edges) {
			if (bottom) line(plan(e.a), plan(e.b), z0);
			if (top) line(plan(e.a), plan(e.b), z1);
			for (const [p, end] of [
				[e.a, false],
				[e.b, true]
			] as const)
				if (turn(e, all, end)) line(plan(p), plan(p), z0, z1);
		}
	};

	// Story-centered (Townscaper): joints and roofs only on zMid, zLow/zHigh are mid-floor.
	const centered = !!ctx.centered;
	// Walkway deck: explicit per corner bit (rotated canonically) or, without the field, the old span rule.
	const deckBits = ctx.deck === undefined ? -1 : rotateMask(ctx.deck & 255, r);
	const deck = hi.map((h, j) =>
		bestand ? false : deckBits < 0 ? h && !lo[j] && ctx.span : h && !!((deckBits >> (j + 4)) & 1)
	);
	// Lower deck bit: clear space above the deck, no volume.
	const solid = lo.map((l, j) => l && (deckBits < 0 || bestand || !((deckBits >> j) & 1)));
	const body = hi.map((h, j) => h && !deck[j]);
	const below = exposed(solid, open);
	const above = exposed(body, open);
	// Parapet only toward the void, not against a wall on the same floor.
	const deckEdges = exposed(
		deck.map((d, j) => d || body[j]),
		open
	).filter((e) => deck[e.cell]);

	// Bottom: plinth floor. Without quarters above it ends with a flat roof and parapet.
	fill(solid, zLow, zMid - zLow, main);
	const roofLow = solid.map((l, j) => l && !((allHi >> j) & 1));
	// Below the parapet the facade continues without a line; existing stock ends with an eaves edge.
	facade(
		below.filter((e) => !roofLow[e.cell]),
		below,
		zLow,
		zMid,
		true,
		!centered
	);
	facade(
		below.filter((e) => roofLow[e.cell]),
		below,
		zLow,
		zMid,
		bestand,
		!centered
	);
	if (!bestand)
		for (const e of below.filter((e) => roofLow[e.cell]))
			rim(e, below, zMid, ATTIKA, ATTIKA_T, main);

	// Top: volume. Open above → flat roof with parapet, otherwise it continues.
	fill(body, zMid, zHigh - zMid, main);
	const top = ctx.openAbove && !centered;
	facade(above, above, zMid, zHigh, top && bestand);
	if (top && !bestand) for (const e of above) rim(e, above, zHigh, ATTIKA, ATTIKA_T, main);

	// Columns: explicit down to the next thing below, otherwise pilotis under floating quarters at the ground.
	const stilt = (p: Point2, from: number) =>
		zMid - from > 0.05 &&
		out.push({
			id: id('stuetze'),
			kind: 'cylinder',
			position: [p[0], p[1], from],
			radius: STUETZE,
			height: zMid - from,
			token: '--paper',
			role,
			material: 'concrete'
		});
	if (!bestand && ctx.stilts)
		for (const s of ctx.stilts) if (slot.corners[s.corner]) stilt(slot.corners[s.corner], s.from);
	if (!bestand && !ctx.stilts && ctx.ground && !centered)
		body.forEach((b, j) => {
			if (!b || lo[j]) return;
			const [x, y] = CELL[j];
			stilt(plan([(x + 0.5) / 2, (y + 0.5) / 2]), zLow);
		});

	// Walkway deck over open space: slab, parapet, truss below, free underneath.
	if (deck.some(Boolean)) {
		fill(deck, zMid, DECK, main);
		facade(deckEdges, deckEdges, zMid, zMid + DECK, false);
		for (const e of deckEdges) {
			rim(e, deckEdges, zMid + DECK, BRUESTUNG, BRUESTUNG_T, main);
			// Beam: rigid strut box under the open edge, rotated to its direction.
			const [a, b] = [plan(e.a), plan(e.b)],
				len = Math.hypot(b[0] - a[0], b[1] - a[1]),
				angle = Math.atan2(b[1] - a[1], b[0] - a[0]),
				depth = 0.35,
				cx = (a[0] + b[0]) / 2 - Math.sin(angle) * depth * 0.5,
				cy = (a[1] + b[1]) / 2 + Math.cos(angle) * depth * 0.5;
			out.push({
				id: id('traeger'),
				kind: 'frame',
				position: [cx - len / 2, cy - depth / 2, zMid - TRAEGER],
				size: [len, depth, TRAEGER],
				cells: [Math.max(1, Math.round(len / TRAEGER)), 1, 1],
				bar: 0.08,
				braced: true,
				rotation: angle,
				token: accent,
				role,
				material: 'metal'
			});
		}
	}

	// Courtyard: free quarters open to the sky at the bottom of a closed courtyard become garden.
	if (ctx.courtyard && ctx.ground && !bestand && !centered) {
		const rng = random(slot.seed);
		lo.forEach((l, j) => {
			if (l || hi[j]) return;
			prism(quarter(j), zLow, GARTEN, '--cat-nature');
			const [x, y] = CELL[j],
				[px, py] = plan([(x + 0.5) / 2, (y + 0.5) / 2]),
				s = Math.min(lu, lv) * 0.24 * (0.8 + rng() * 0.4),
				trunk = Math.min(s * 0.9, zMid - zLow);
			out.push({
				id: id('stamm'),
				kind: 'cylinder',
				position: [px, py, zLow + GARTEN],
				radius: 0.14,
				height: trunk + s * 0.3,
				token: '--paper',
				role,
				material: 'wood'
			});
			const z = zLow + GARTEN + trunk;
			out.push(
				rng() < 0.5
					? {
							id: id('krone'),
							kind: 'sphere',
							position: [px, py, z + s * 0.6],
							radius: s * 0.6,
							token: '--cat-nature',
							role,
							material: 'concrete'
						}
					: {
							id: id('krone'),
							kind: 'cone',
							position: [px, py, z],
							radius: s * 0.55,
							height: s * 1.8,
							token: '--cat-nature',
							role,
							material: 'concrete'
						}
			);
		});
	}

	// Crown: occasionally on a fully covered roof, chosen by seed.
	if (top && !bestand && body.every(Boolean)) {
		const rng = random(slot.seed ^ 0x9e3779b9);
		if (rng() < KOPF_CHANCE) {
			const fam = formFamily(KOEPFE[Math.floor(rng() * KOEPFE.length) % KOEPFE.length]);
			const t = ATTIKA_T * 2;
			const poly: UV[] = [
				[t / lu, t / lv],
				[1 - t / lu, t / lv],
				[1 - t / lu, 1 - t / lv],
				[t / lu, 1 - t / lv]
			];
			const [a, b] = [plan([0, 0]), plan([1, 0])];
			if (fam)
				out.push(
					...fam
						.generate(
							{
								footprint: poly.map(plan),
								center: plan([0.5, 0.5]),
								orientation: Math.atan2(b[1] - a[1], b[0] - a[0]),
								z: zHigh,
								height: (zHigh - zLow) * 0.9,
								role,
								seed: slot.seed,
								token: accent
							},
							{}
						)
						.map((p) => ({ ...p, id: `${slot.id}-kopf-${p.id}` }))
				);
		}
	}

	for (const [a, b] of lines)
		out.push({
			id: id('linie'),
			kind: 'polyline',
			points: [a, b],
			role,
			token: '--paper',
			material: 'concrete'
		});
	return out;
}

/* ── Structural frame ────────────────────────────────────── */

/**
 * Color of the frame (tower principle 85 §2: the frame sets the bays; 43, 134: red).
 * Signal, not --cat-hazard: the frame is a Memphis accent and an offer, not a warning.
 */
export const GERUEST_TOKEN: ColorToken = '--signal';
const STAB = 0.12;

/**
 * Frame corner module: one bay (planar strut frame: two columns, beams at bottom and top) per
 * outline piece of the build cell and floor, in the original frame without canonicalization. Outline pieces:
 * slot center C → side midpoint M (between two quarters, unique within the slot) and at the patch edge
 * corner Q → M. Bays of an empty frame facing the void get a diagonal, alternating per floor and
 * side (diamond pattern). Drawn like a strut frame: wide colored stroke, ink line.
 * Centered (L10), a slot builds the whole floor of its upper bits (zMid … zMid + floor),
 * so bays meet only at floor joints; shared columns coincide.
 */
function geruest(slot: Slot, frame: number): Primitive[] {
	const ctx = slot.context,
		{ plan } = mapper(slot, 0);
	const occ = slot.mask & 255,
		hollow = (ctx.hollow ?? 0) & occ;
	const zLow = slot.zLow,
		zHigh = Math.max(slot.zHigh, slot.zLow + 0.1),
		zMid = (zLow + zHigh) / 2;
	// Filled quarter on side s without an occupied neighboring slot ⇒ patch edge.
	const rand = [0, 1, 2, 3].map((s) => !ctx.neighborFilled[s]);
	const Q: UV[] = [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, 1]
	];
	const M: UV[] = [
		[0.5, 0],
		[1, 0.5],
		[0.5, 1],
		[0, 0.5]
	];
	const C: UV = [0.5, 0.5];
	const has = (m: number, j: number, upper: boolean) => !!((m >> ((j % 4) + (upper ? 4 : 0))) & 1);
	const out: Primitive[] = [];
	let n = 0;
	const feld = (a: UV, b: UV, z0: number, z1: number, braced: boolean, flip: boolean) => {
		const [p, q] = flip ? [plan(b), plan(a)] : [plan(a), plan(b)],
			len = Math.hypot(q[0] - p[0], q[1] - p[1]);
		if (len < 0.05) return;
		out.push({
			id: `${slot.id}-geruest-${n++}`,
			kind: 'frame',
			position: [(p[0] + q[0]) / 2 - len / 2, (p[1] + q[1]) / 2 - 0.01, z0],
			size: [len, 0.02, z1 - z0],
			cells: [1, 1, 1],
			bar: STAB,
			braced,
			rotation: Math.atan2(q[1] - p[1], q[0] - p[0]),
			role: ctx.role,
			token: ctx.frameToken ?? GERUEST_TOKEN,
			material: 'metal'
		});
	};
	const storeys: [boolean, number, number][] = ctx.centered
		? [[true, zMid, zMid + 2 * (zHigh - zMid)]]
		: [
				[false, zLow, zMid],
				[true, zMid, zHigh]
			];
	for (const [upper, z0, z1] of storeys) {
		const f = (j: number) => has(frame, j, upper);
		const empty = (j: number) => has(hollow, j, upper);
		const leer = (j: number) => !has(occ, j, upper);
		const level = Math.round(z0 / 4),
			flip = level % 2 === 1;
		// Only every second bay braced (checkerboard over side and floor): calmer.
		const steif = (s: number) => (s + level) % 2 === 0;
		for (let s = 0; s < 4; s++) {
			const t = (s + 1) % 4;
			if (f(s) || f(t))
				feld(
					C,
					M[s],
					z0,
					z1,
					steif(s) && ((empty(s) && leer(t)) || (empty(t) && leer(s))),
					flip !== (s % 2 === 1)
				);
			if (rand[s] && f(s)) feld(Q[s], M[s], z0, z1, steif(s) && empty(s), flip);
			if (rand[s] && f(t)) feld(M[s], Q[t], z0, z1, !steif(s) && empty(t), !flip);
		}
	}
	return out;
}

/* ── Paths ───────────────────────────────────────────────── */

/**
 * Path corner module (round 3): the occupancy `weg`/`bahn` becomes a narrow footbridge on the
 * mesh edges instead of a volume. One landing per upper path bit at the vertex (on zMid, the
 * floor of the level), one footbridge per slot side with two path bits; two slots at an edge
 * each draw half the width. A lower path bit at corner x and an upper one at the neighboring
 * corner y without a level connection: a stair flight over one floor (height class "stair"). Next
 * to a new volume (`dock`) a spur footbridge up to the facade. Railing as a line, only toward
 * the void and only above the ground. Columns come from `wegStilts`.
 */
function wege(slot: Slot, weg: number): Primitive[] {
	const ctx = slot.context;
	if (!ctx.centered) return [];
	const { plan, lu, lv } = mapper(slot, 0);
	const zLow = slot.zLow,
		zHigh = Math.max(slot.zHigh, slot.zLow + 0.1),
		zMid = (zLow + zHigh) / 2,
		zBelow = zMid - (zHigh - zLow);
	const Q: UV[] = [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, 1]
	];
	const up = (i: number) => !!((weg >> ((i % 4) + 4)) & 1),
		low = (i: number) => !!((weg >> (i % 4)) & 1),
		dock = (i: number) => !!(((ctx.dock ?? 0) >> ((i % 4) + 4)) & 1),
		tok = (bit: number): ColorToken => ctx.tokens?.[bit] ?? ctx.token ?? '--cat-business';
	// Frame of corner i: a along side i (toward corner i + 1), b along side i − 1 (toward corner i − 1).
	const len = (i: number) => (i % 2 === 0 ? lu : lv);
	const ta = (i: number) => Math.min(0.45, WEG_B / len(i)),
		tb = (i: number) => Math.min(0.45, WEG_B / len(i + 1));
	const pt = (i: number, a: number, b: number): Point2 => {
		const q = Q[i % 4],
			next = Q[(i + 1) % 4],
			prev = Q[(i + 3) % 4];
		return plan([
			q[0] + a * (next[0] - q[0]) + b * (prev[0] - q[0]),
			q[1] + a * (next[1] - q[1]) + b * (prev[1] - q[1])
		]);
	};
	const out: Primitive[] = [];
	let n = 0;
	const base = { role: ctx.role, material: 'concrete' as const };
	const elevated = zMid > 0.5,
		depth = elevated ? WEG_D : 0.08,
		top = zMid + depth;
	const plate = (poly: Point2[], token: ColorToken) =>
		out.push({
			...base,
			id: `${slot.id}-weg-${n++}`,
			kind: 'prism',
			polygon: poly,
			z: zMid,
			height: depth,
			token,
			edges: false
		});
	const line = (points: Vec3[]) =>
		out.push({ ...base, id: `${slot.id}-weg-${n++}`, kind: 'polyline', points, token: '--paper' });
	/** Open edge from p to q: slab edge, above the ground also a handrail. */
	const rand = (p: Point2, q: Point2) => {
		line([
			[p[0], p[1], top],
			[q[0], q[1], top]
		]);
		if (!elevated) return;
		line([
			[p[0], p[1], top + GELAENDER],
			[q[0], q[1], top + GELAENDER]
		]);
	};
	/** Flight from the lower corner x (level below) to the upper neighboring corner y. */
	const flight = (x: number, y: number) =>
		low(x) && up(y) && !low(y) && !up(x) && tok(x % 4) === tok((y % 4) + 4);
	const all = [0, 1, 2, 3].every((i) => up(i) && tok(i + 4) === tok(4));
	if (all) plate(Q.map(plan), tok(4));
	else
		for (let i = 0; i < 4; i++) {
			const j = (i + 1) % 4,
				k = (i + 3) % 4,
				a = ta(i),
				b = tb(i);
			// Connection along side i, in the frame of corner i.
			const strip = (a0: number, a1: number, token: ColorToken) => {
				plate([pt(i, a0, 0), pt(i, a1, 0), pt(i, a1, b), pt(i, a0, b)], token);
				rand(pt(i, a0, b), pt(i, a1, b));
			};
			const flat = up(i) && up(j);
			if (flat && tok(i + 4) === tok(j + 4)) strip(a, 1 - a, tok(i + 4));
			else if (flat) {
				strip(a, 0.5, tok(i + 4));
				strip(0.5, 1 - a, tok(j + 4));
			} else if (up(i) && dock(j)) strip(a, 0.5, tok(i + 4));
			else if (up(j) && dock(i)) strip(0.5, 1 - a, tok(j + 4));
			// Stair flight along side i.
			const rise = flight(i, j) ? 1 : flight(j, i) ? -1 : 0;
			if (rise) {
				const z0 = (rise > 0 ? zBelow : zMid) + WEG_D,
					z1 = (rise > 0 ? zMid : zBelow) + WEG_D,
					at = (s: number, v: number, dz = 0): Vec3 => [
						...pt(i, a + (1 - 2 * a) * s, v),
						z0 + (z1 - z0) * s + dz
					];
				out.push({
					...base,
					id: `${slot.id}-weg-${n++}`,
					kind: 'membrane',
					corners: [at(0, 0), at(1, 0), at(1, b), at(0, b)],
					sag: 0,
					token: tok(rise > 0 ? i : j),
					edges: false
				});
				for (let s = 1; s < STUFEN; s++) line([at(s / STUFEN, 0, 0.02), at(s / STUFEN, b, 0.02)]);
				line([at(0, b, GELAENDER), at(1, b, GELAENDER)]);
				line([at(0, b, 0.02), at(1, b, 0.02)]);
			}
			if (!up(i)) continue;
			// Landing of corner i; railing on the two inner edges where nothing connects.
			plate([pt(i, 0, 0), pt(i, a, 0), pt(i, a, b), pt(i, 0, b)], tok(i + 4));
			const auf = ctx.wegAuf ?? 0;
			const viaA = flat || dock(j) || flight(j, i) || !!((auf >> (2 * i)) & 1),
				viaB = up(k) || dock(k) || flight(k, i) || !!((auf >> (2 * i + 1)) & 1);
			if (!viaA) rand(pt(i, a, 0), pt(i, a, b));
			if (!viaB) rand(pt(i, a, b), pt(i, 0, b));
			// A post at the inner corner of the landing carries the handrail.
			if (elevated) {
				const [x, y] = pt(i, a, b);
				line([
					[x, y, top],
					[x, y, top + GELAENDER]
				]);
			}
		}
	for (const s of ctx.wegStilts ?? []) {
		const p = slot.corners[s.corner];
		if (p && zMid - s.from > 0.05)
			out.push({
				...base,
				id: `${slot.id}-weg-${n++}`,
				kind: 'cylinder',
				position: [p[0], p[1], s.from],
				radius: 0.16,
				height: zMid - s.from,
				token: '--paper'
			});
	}
	return out;
}
