import type { Primitive } from '../types';
import type { Kit } from './kit';
import { family, spec } from './kit';
import { scatter } from './geom';

const params = [
	spec('anzahl', 'Count', 1, 14, 1, 5),
	spec('groesse', 'Size', 0.4, 1.6, 0.05, 1),
	spec('streuung', 'Scatter', 0, 1, 0.05, 0.4)
];

/** Places n trees; crown(k, u, v, z, size, rank) draws one crown above a trunk. */
function grove(
	k: Kit,
	p: Record<string, number>,
	crown: (x: number, y: number, z: number, s: number) => Primitive[]
) {
	const s0 = Math.min(3, k.radius * 0.5) * p.groesse,
		pts = scatter(k.outline(0), p.anzahl, s0 * 1.4, k.rng, s0 * 0.6);
	const out: Primitive[] = [
		k.prism(k.outline(0.1), k.ctx.z, 0.15, '--cat-nature', { rank: 0, shade: 0 })
	];
	// Points come in world coordinates; convert back into local frame offsets via world().
	const [ox, oy] = k.world(0, 0),
		c = Math.cos(-k.rot),
		sn = Math.sin(-k.rot);
	for (const [x, y] of pts) {
		const u = (x - ox) * c - (y - oy) * sn,
			v = (x - ox) * sn + (y - oy) * c,
			s = s0 * (1 - p.streuung * 0.5 + k.rng() * p.streuung),
			trunk = Math.min(s * 0.9, k.ctx.height * 0.25);
		out.push(
			k.cylinder(u, v, k.ctx.z, Math.max(0.12, s * 0.07), trunk + s * 0.3, '--paper', {
				rank: 0,
				material: 'wood'
			})
		);
		out.push(...crown(u, v, k.ctx.z + trunk, s));
	}
	return out;
}

/** Vegetation: ball, cone, voxel, spiral tree (09, 11, 18, 23). */
export const vegetation = [
	family({
		id: 'vegetation-kugelbaum',
		name: 'Ball tree',
		group: 'vegetation',
		refs: ['09', '18', '11'],
		params,
		build: (k, p) =>
			grove(k, p, (u, v, z, s) => [
				k.sphere(u, v, z + s * 0.6, s * 0.6, '--cat-nature', { rank: 1 })
			])
	}),
	family({
		id: 'vegetation-kegelbaum',
		name: 'Cone tree',
		group: 'vegetation',
		refs: ['11', '09', '23'],
		params,
		build: (k, p) =>
			grove(k, p, (u, v, z, s) => [k.cone(u, v, z, s * 0.42, s * 1.8, '--cat-nature', { rank: 1 })])
	}),
	family({
		id: 'vegetation-voxelbaum',
		name: 'Voxel tree',
		group: 'vegetation',
		refs: ['09', '18', '14'],
		params,
		build: (k, p) =>
			grove(k, p, (u, v, z, s) => {
				const c = s * 0.45,
					out: Primitive[] = [];
				// Crown: 3 × 3 cubes minus corners, plus a top cube (plus sign in plan).
				for (const [du, dv, dz] of [
					[0, 0, 0],
					[1, 0, 0],
					[-1, 0, 0],
					[0, 1, 0],
					[0, -1, 0],
					[0, 0, 1]
				])
					out.push(
						k.box(u + du * c - c / 2, v + dv * c - c / 2, z + dz * c, c, c, c, '--cat-nature', {
							rank: 1
						})
					);
				return out;
			})
	}),
	family({
		id: 'vegetation-spiralbaum',
		name: 'Spiral tree',
		group: 'vegetation',
		refs: ['15', '18', '23'],
		params,
		build: (k, p) =>
			grove(k, p, (u, v, z, s) => [
				k.helix(u, v, z, s * 0.55, s * 0.12, s * 1.6, 2.5, s * 0.16, '--cat-nature', { rank: 1 })
			])
	})
];
