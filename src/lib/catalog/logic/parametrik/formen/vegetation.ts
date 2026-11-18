import type { Primitive } from '../types';
import type { Kit } from './kit';
import { family, spec } from './kit';
import { scatter } from './geom';
import { TREE_FORM, trunkRadius, crownParts, type CrownForm } from '../../tree-forms';

const params = [
	spec('anzahl', 'Count', 1, 14, 1, 5),
	spec('groesse', 'Size', 0.4, 1.6, 0.05, 1),
	spec('streuung', 'Scatter', 0, 1, 0.05, 0.4)
];

/** Places trees in scatter order with one crown above each trunk. */
function grove(k: Kit, p: Record<string, number>, form: CrownForm) {
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
			trunk = Math.min(s * TREE_FORM.trunkHeight, k.ctx.height * 0.25);
		out.push(
			k.cylinder(u, v, k.ctx.z, trunkRadius(s), trunk + s * TREE_FORM.trunkIntoCrown, '--paper', {
				rank: 0,
				material: 'wood'
			})
		);
		out.push(
			...crownParts(form, [u, v, k.ctx.z + trunk], s, () => k.base('--cat-nature', { rank: 1 }), k)
		);
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
		build: (k, p) => grove(k, p, 'ball')
	}),
	family({
		id: 'vegetation-kegelbaum',
		name: 'Cone tree',
		group: 'vegetation',
		refs: ['11', '09', '23'],
		params,
		build: (k, p) => grove(k, p, 'cone')
	}),
	family({
		id: 'vegetation-voxelbaum',
		name: 'Voxel tree',
		group: 'vegetation',
		refs: ['09', '18', '14'],
		params,
		build: (k, p) => grove(k, p, 'voxel')
	}),
	family({
		id: 'vegetation-spiralbaum',
		name: 'Spiral tree',
		group: 'vegetation',
		refs: ['15', '18', '23'],
		params,
		build: (k, p) => grove(k, p, 'spiral')
	})
];
