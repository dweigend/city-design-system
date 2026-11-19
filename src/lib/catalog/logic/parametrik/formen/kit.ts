import type { ColorToken, MaterialId, Primitive, Role, Vec3 } from '../types';
import type { FormContext, FormFamily, FormGroup, ParamSpec, Point2 } from '../vocab';
import { random } from '../random';
import { fitRect, inradius, inset, rotate } from './geom';

/**
 * Secondary colors of new parts (meaning contract, data/color.ts): ink and signal, never a
 * flow color as accent. The first color is the function from the context, otherwise ink.
 */
export const NEU: ColorToken[] = ['--paper', '--signal'];

type Extra = Partial<
	Pick<Primitive, 'rank' | 'stretchRank' | 'pattern' | 'shade' | 'glass' | 'detail' | 'edges'>
> & {
	material?: MaterialId;
	role?: Role;
};

/**
 * Local drawing kit for one form: frame aligned to the cell orientation,
 * seeded random, color choice and primitive constructors in local (u, v) coordinates.
 */
export function kit(ctx: FormContext, familyId: string) {
	const rng = random(ctx.seed);
	const rot = ctx.orientation;
	const r = fitRect(ctx.footprint, ctx.center, rot);
	const role: Role = ctx.role;
	let n = 0;
	const id = () => `${familyId}-${n++}`;
	/** Local frame → world plan. Origin = center of the fitted rectangle. */
	const world = (u: number, v: number): Point2 => {
		const [x, y] = rotate([u + r.cu, v + r.cv], rot);
		return [ctx.center[0] + x, ctx.center[1] + y];
	};
	const at = (u: number, v: number, z: number): Vec3 => [...world(u, v), z];
	const pick = <T>(list: T[]) => list[Math.floor(rng() * list.length) % list.length];
	// Formerly: six colors mixed. The draw stays so that the geometry per seed stays the same.
	[0, 1, 2, 3, 4, 5].sort(() => rng() - 0.5);
	/** Color 0 = function (otherwise ink), 1 = ink, 2 = signal, then alternating. */
	const tone = (i: number): ColorToken =>
		role === 'bestand' ? '--paper' : i === 0 ? (ctx.token ?? '--paper') : NEU[(i - 1) % NEU.length];
	const base = (token: ColorToken, extra: Extra = {}) => {
		const own = extra.role ?? role;
		return {
			id: id(),
			role: own,
			token: own === 'bestand' ? ('--paper' as const) : token,
			material: extra.material ?? ctx.material ?? 'concrete',
			rank: extra.rank,
			stretchRank: extra.stretchRank,
			pattern: extra.pattern,
			shade: extra.shade,
			glass: extra.glass,
			detail: extra.detail,
			edges: extra.edges
		};
	};
	return {
		ctx,
		base,
		rng,
		pick,
		tone,
		rot,
		/** Half extents of the fitted rectangle. */
		hu: r.hu,
		hv: r.hv,
		/** Cell center in local coordinates (the fitted rectangle may sit off-center). */
		ou: -r.cu,
		ov: -r.cv,
		/** Free radius around the cell center (for round forms). */
		radius: inradius(ctx.footprint, ctx.center),
		world,
		at,
		top: ctx.z + ctx.height,
		/** Footprint, inset by d meters. */
		outline: (d = 0) => inset(ctx.footprint, d, ctx.center),
		/** Box from local min corner (u, v) with size (w, d, h). */
		box(
			u: number,
			v: number,
			z: number,
			w: number,
			d: number,
			h: number,
			token: ColorToken,
			extra?: Extra
		): Primitive {
			const [cx, cy] = world(u + w / 2, v + d / 2);
			return {
				...base(token, extra),
				kind: 'box',
				position: [cx - w / 2, cy - d / 2, z],
				size: [w, d, h],
				rotation: rot
			};
		},
		wedge(
			u: number,
			v: number,
			z: number,
			w: number,
			d: number,
			h: number,
			low: number,
			token: ColorToken,
			extra?: Extra & { turn?: number }
		): Primitive {
			const [cx, cy] = world(u + w / 2, v + d / 2);
			return {
				...base(token, extra),
				kind: 'wedge',
				position: [cx - w / 2, cy - d / 2, z],
				size: [w, d, h],
				low,
				rotation: rot + (extra?.turn ?? 0)
			};
		},
		prism(
			polygon: Point2[],
			z: number,
			height: number,
			token: ColorToken,
			extra?: Extra
		): Primitive {
			return { ...base(token, extra), kind: 'prism', polygon, z, height };
		},
		cylinder(
			u: number,
			v: number,
			z: number,
			radius: number,
			height: number,
			token: ColorToken,
			extra?: Extra
		): Primitive {
			return { ...base(token, extra), kind: 'cylinder', position: at(u, v, z), radius, height };
		},
		cone(
			u: number,
			v: number,
			z: number,
			radius: number,
			height: number,
			token: ColorToken,
			extra?: Extra
		): Primitive {
			return { ...base(token, extra), kind: 'cone', position: at(u, v, z), radius, height };
		},
		sphere(
			u: number,
			v: number,
			z: number,
			radius: number,
			token: ColorToken,
			extra?: Extra & { squash?: number }
		): Primitive {
			return {
				...base(token, extra),
				kind: 'sphere',
				position: at(u, v, z),
				radius,
				squash: extra?.squash
			};
		},
		dome(
			u: number,
			v: number,
			z: number,
			radius: number,
			height: number,
			facets: number,
			token: ColorToken,
			extra?: Extra
		): Primitive {
			return { ...base(token, extra), kind: 'dome', position: at(u, v, z), radius, height, facets };
		},
		capsule(a: Vec3, b: Vec3, radius: number, token: ColorToken, extra?: Extra): Primitive {
			return { ...base(token, extra), kind: 'capsule', from: at(...a), to: at(...b), radius };
		},
		pipe(points: Vec3[], radius: number, token: ColorToken, extra?: Extra): Primitive {
			return { ...base(token, extra), kind: 'pipe', points: points.map((p) => at(...p)), radius };
		},
		polyline(
			points: Vec3[],
			closed: boolean,
			token: ColorToken = '--paper',
			extra?: Extra
		): Primitive {
			return {
				...base(token, extra),
				kind: 'polyline',
				points: points.map((p) => at(...p)),
				closed
			};
		},
		/** Ring standing in the plane of local x (turn rotates it in plan). */
		ring(
			u: number,
			v: number,
			z: number,
			radius: number,
			inner: number,
			depth: number,
			token: ColorToken,
			extra?: Extra & { turn?: number; tilt?: number; curvature?: number }
		): Primitive {
			return {
				...base(token, extra),
				kind: 'ring',
				position: at(u, v, z),
				radius,
				innerRadius: inner,
				depth,
				rotation: rot + (extra?.turn ?? 0),
				...(extra?.tilt ? { tilt: extra.tilt } : {}),
				...(extra?.curvature ? { curvature: extra.curvature } : {})
			};
		},
		arch(
			kind: 'arch' | 'vault' | 'halfpipe',
			u: number,
			v: number,
			z: number,
			width: number,
			length: number,
			rise: number,
			token: ColorToken,
			extra?: Extra & { thickness?: number; turn?: number }
		): Primitive {
			return {
				...base(token, extra),
				kind,
				position: at(u, v, z),
				width,
				length,
				rise,
				thickness: extra?.thickness,
				rotation: rot + (extra?.turn ?? 0)
			};
		},
		frame(
			u: number,
			v: number,
			z: number,
			w: number,
			d: number,
			h: number,
			cells: [number, number, number],
			bar: number,
			token: ColorToken,
			extra?: Extra & { braced?: boolean }
		): Primitive {
			const [cx, cy] = world(u + w / 2, v + d / 2);
			return {
				...base(token, { material: 'metal', ...extra }),
				kind: 'frame',
				position: [cx - w / 2, cy - d / 2, z],
				size: [w, d, h],
				cells,
				bar,
				braced: extra?.braced,
				rotation: rot
			};
		},
		torus(
			u: number,
			v: number,
			z: number,
			radius: number,
			tube: number,
			token: ColorToken,
			extra?: Extra & { axis?: 'x' | 'z'; arc?: number; turn?: number }
		): Primitive {
			return {
				...base(token, extra),
				kind: 'torus',
				position: at(u, v, z),
				radius,
				tube,
				axis: extra?.axis ?? 'z',
				arc: extra?.arc,
				rotation: rot + (extra?.turn ?? 0)
			};
		},
		helix(
			u: number,
			v: number,
			z: number,
			radius: number,
			inner: number,
			height: number,
			turns: number,
			thickness: number,
			token: ColorToken,
			extra?: Extra & { turn?: number }
		): Primitive {
			return {
				...base(token, extra),
				kind: 'helix',
				position: at(u, v, z),
				radius,
				innerRadius: inner,
				height,
				turns,
				thickness,
				rotation: rot + (extra?.turn ?? 0)
			};
		},
		membrane(
			corners: [Vec3, Vec3, Vec3, Vec3],
			sag: number,
			token: ColorToken,
			extra?: Extra
		): Primitive {
			return {
				...base(token, extra),
				kind: 'membrane',
				corners: corners.map((p) => at(...p)) as [Vec3, Vec3, Vec3, Vec3],
				sag
			};
		}
	};
}
export type Kit = ReturnType<typeof kit>;

/** Fills defaults for non-finite values, clamps to [min, max] and rounds when `step >= 1`. New object. */
export function resolve(specs: ParamSpec[], params: Record<string, number>) {
	const out: Record<string, number> = {};
	for (const s of specs) {
		const raw = params[s.key];
		const v = Number.isFinite(raw) ? Math.max(s.min, Math.min(s.max, raw)) : s.default;
		out[s.key] = s.step >= 1 ? Math.round(v) : v;
	}
	return out;
}

/** Parameter spec; `value` becomes the default. */
export const spec = (
	key: string,
	label: string,
	min: number,
	max: number,
	step: number,
	value: number
): ParamSpec => ({ key, label, min, max, step, default: value });

/** Declares a family; generate resolves params and hands a fresh kit to the builder. */
export function family(def: {
	id: string;
	name: string;
	group: FormGroup;
	refs: string[];
	params: ParamSpec[];
	build: (k: Kit, p: Record<string, number>) => Primitive[];
}): FormFamily {
	return {
		id: def.id,
		name: def.name,
		group: def.group,
		refs: def.refs,
		params: def.params,
		generate: (ctx, params) => def.build(kit(ctx, def.id), resolve(def.params, params))
	};
}
