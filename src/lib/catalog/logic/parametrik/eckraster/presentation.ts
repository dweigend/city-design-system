import type { CornerModule, Slot } from '../eck';
import type { ColorToken, Primitive } from '../types';
import type { Cell, Point2 } from '../vocab';
import type { Patch } from './topology';
import { courtyards, LEVELS } from './derive';
import { HEIGHT_STEP, type Occupancy } from './state';
import { cellOutline, haeuser } from './bestand';
import { erschliessung } from './erschliessung';
import { bestandDetails } from '../formen/eckbestand';
import { treppe } from '../formen/eckerschliessung';
import { heads, headZ } from './koepfe';
import { funktion, groupToken, type Farben } from './funktion';
import { formFamily } from '../formen/index';
import { inset } from '../formen/geom';
import { accentOf, DEFAULT_TOKEN } from '../formen/eck';
import { flowToken } from '../../../data/focus';
export const placeholder: CornerModule = (s) =>
	s.mask
		? [
				{
					id: `placeholder:${s.id}`,
					kind: 'prism',
					polygon: s.corners,
					z: s.zLow,
					height: s.zHigh - s.zLow,
					role: s.context.role,
					token: DEFAULT_TOKEN,
					material: 'concrete'
				}
			]
		: [];
const base = { role: 'neu', token: '--paper', material: 'concrete' } as const;
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Garden over a whole dual cell: green plate plus one or two trees (ball or cone). */
export function garden(c: Cell, z: number, level: number): Primitive[] {
	const seed = hash(`${c.id}@${level}`);
	const fam = formFamily(seed % 3 ? 'vegetation-kugelbaum' : 'vegetation-kegelbaum')!;
	return fam
		.generate(
			{
				footprint: c.polygon,
				center: c.center,
				orientation: c.orientation,
				z,
				height: HEIGHT_STEP,
				role: 'neu',
				seed
			},
			{ anzahl: c.area > 24 ? 2 : 1, groesse: 1, streuung: 0.4 }
		)
		.map((q, i) => ({ ...q, id: `garden:${c.id}@${level}:${i}`, shade: 0 }));
}

/** One head per intervention, from the function's form family; colors stay functional. */
export function head(
	c: Cell,
	z: number,
	group: string,
	seed: number,
	farben?: Farben
): Primitive[] {
	const f = funktion(group),
		main: ColorToken = (farben?.token ?? groupToken)(group) ?? DEFAULT_TOKEN,
		accent = accentOf(main),
		fam = formFamily(f.kopf);
	if (!fam) return [];
	const keep = new Set<ColorToken>([main, '--paper', '--cat-nature']);
	return fam
		.generate(
			{
				footprint: inset(c.polygon, 0.55, c.center),
				center: c.center,
				orientation: c.orientation,
				z,
				height: HEIGHT_STEP * 0.9,
				role: 'neu',
				seed,
				token: main
			},
			f.kopfParams ?? {}
		)
		.map((q, i) => ({
			...q,
			id: `kopf:${c.id}:${i}`,
			token: keep.has(q.token) ? q.token : accent
		}));
}

/** What the scene shows; build phases fade in crowns and circulation only late. */
export type Zeigen = { koepfe?: boolean; treppen?: boolean };

/** Base plate: the five corners of the fan, otherwise a disk around the frame. */
function scholle(p: Patch): Point2[] {
	const rim = Array.from({ length: 5 }, (_, i) => p.vertices.find((v) => v.id === `rim${i}`));
	if (rim.every((v) => v)) return rim.map((v) => v!.point);
	const r = Math.max(...p.vertices.map((v) => Math.hypot(...v.point)));
	return Array.from({ length: 48 }, (_, i) => [
		r * Math.cos((i * Math.PI) / 24),
		r * Math.sin((i * Math.PI) / 24)
	]);
}
/**
 * Full scene of a patch as primitives (meters, x/y ground, z up), in this order: ground slab,
 * `module` on every slot (slot order), existing-stock details, courtyard gardens per level,
 * crowns (unless `zeigen.koepfe === false`), stairs (unless `zeigen.treppen === false`), then the
 * dual cell outlines (`dual`) and the slot faces (`primal`). Crown forms are seeded with
 * `p.seed + hash(vertexId)`. Returns a new array; `p`, `o` and `slots` are not mutated.
 */
export function presentation(
	p: Patch,
	o: Occupancy,
	slots: Slot[],
	module: CornerModule,
	dual: boolean,
	primal: boolean,
	zeigen: Zeigen = {}
): Primitive[] {
	const cellOf = new Map(p.cells.map((c) => [c.id, c]));
	const ring = (poly: Point2[], z: number, id: string, role: 'neu' | 'bestand'): Primitive => ({
		...base,
		id,
		role,
		kind: 'polyline',
		points: poly.map((q) => [...q, z]),
		closed: true
	});
	return [
		{
			...base,
			id: 'ground',
			kind: 'prism',
			polygon: scholle(p),
			z: -0.18,
			height: 0.16
		},
		// All volumes from corner modules; the module draws existing-stock bits gray and unchanged.
		...slots.flatMap((s) => module({ ...s, context: { ...s.context, courtyard: false } })),
		// Existing stock: punched facade, round arches, roofs (only without a rooftop extension).
		...haeuser(p, o).flatMap(bestandDetails),
		// Courtyards on all levels: closed, open above, supported → garden over the whole cell.
		...LEVELS.flatMap((h) =>
			[...courtyards(p, o, h)].flatMap((id) =>
				garden(cellOf.get(id)!, h * HEIGHT_STEP + (h ? 0 : 0.02), h)
			)
		),
		// One crown per intervention, on the highest point.
		...(zeigen.koepfe === false
			? []
			: heads(p, o).flatMap((h) =>
					head(cellOf.get(h.vertexId)!, headZ(h), h.group, p.seed + hash(h.vertexId))
				)),
		// External circulation, emergent in free columns.
		...(zeigen.treppen === false ? [] : treppen(p, o)),
		...(dual ? p.cells.map((c) => ring(c.polygon, 0.02, `dual:${c.id}`, 'bestand')) : []),
		...(primal
			? p.faces.map((f) =>
					ring(
						f.vertices.map((id) => p.vertices.find((v) => v.id === id)!.point),
						0.04,
						`slot:${f.id}`,
						'neu'
					)
				)
			: [])
	];
}

/**
 * External circulation as forms. Flights in the color of the target (36), stair towers in the
 * accent (43), ink → red. `gesperrt`: columns without a stair (in the world, the alleys).
 */
export function treppen(
	p: Patch,
	o: Occupancy,
	farben?: Farben,
	gesperrt?: Set<string>,
	/** Spacing of the drawn step lines (large scenes draw more coarsely). */
	stufe?: number
): Primitive[] {
	const byId = new Map(p.vertices.map((v) => [v.id, v]));
	return erschliessung(p, o, gesperrt).flatMap((t) => {
		// Circulation is a path, hence the People flow (meaning contract, data/color.ts):
		// flights and towers pink, whatever function they reach.
		return treppe({
			id: t.id,
			art: t.art,
			stufe,
			outline: cellOutline(p, t.vertexId),
			toward: byId.get(t.anchor)!.point,
			z: t.z,
			token: farben?.treppe ?? flowToken.people
		});
	});
}
