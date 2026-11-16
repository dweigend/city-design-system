import type { Cell, CompositionRule, FormFamily, Grid } from '../vocab';
import type { Primitive } from '../types';
import { fitHeight, heightBudget, scaleForm } from './height';
import { inradius } from '../formen/geom';
import { random } from '../random';
export const placeholder: FormFamily = {
	id: 'cell-prism',
	name: 'Cell prism',
	group: 'klotz',
	refs: [],
	params: [],
	generate: (ctx) => [
		{
			id: 'cell',
			kind: 'prism',
			polygon: ctx.footprint,
			z: ctx.z,
			height: ctx.height,
			role: ctx.role,
			token: ctx.token ?? '--paper',
			material: 'concrete'
		}
	]
};
const boundary = (c: Cell, g: Grid) =>
	c.polygon.some((a, i) => {
		const b = c.polygon[(i + 1) % c.polygon.length],
			m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
		return !g.cells.some(
			(other) =>
				other.id !== c.id &&
				other.level === c.level &&
				other.polygon.some((p, j) => {
					const q = other.polygon[(j + 1) % other.polygon.length];
					const cross = (q[0] - p[0]) * (m[1] - p[1]) - (q[1] - p[1]) * (m[0] - p[0]);
					return (
						Math.abs(cross) < 1e-6 &&
						m[0] >= Math.min(p[0], q[0]) - 1e-6 &&
						m[0] <= Math.max(p[0], q[0]) + 1e-6 &&
						m[1] >= Math.min(p[1], q[1]) - 1e-6 &&
						m[1] <= Math.max(p[1], q[1]) + 1e-6
					);
				})
		);
	});
export const compositionRules: CompositionRule[] = [
	{
		id: 'hof',
		name: 'Courtyard and cluster',
		refs: ['01', '04'],
		pick: (c, g) => (boundary(c, g) ? { form: '*', params: { height: 6 } } : null)
	},
	{
		id: 'netz',
		name: 'Network',
		refs: ['33', '38', '39'],
		pick: (c) => (c.neighbors.length >= 3 ? { form: '*', params: { height: 4 } } : null)
	},
	{
		id: 'landmarke',
		name: 'Landmark',
		refs: ['22', '32'],
		pick: (c, g, seed) =>
			c.id === g.cells[Math.floor(random(seed)() * g.cells.length)]?.id
				? { form: '*', params: { height: 14 + random(seed + 1)() * 12 } }
				: null
	},
	{
		id: 'aufstockung',
		name: 'Rooftop extension',
		refs: ['37', '41'],
		pick: () => ({ form: '*', params: { height: 4 } })
	}
];
/** Rules overlay in order. '*' chooses deterministically from the supplied form group. */
export function compose(
	grid: Grid,
	rules: CompositionRule[],
	forms: FormFamily[] = [placeholder],
	seed = 42
): Primitive[] {
	const result: Primitive[] = [];
	const choices = forms.length ? forms : [placeholder];
	for (const rule of rules) {
		grid.cells.forEach((c, index) => {
			const picked = rule.pick(c, grid, seed);
			if (!picked) return;
			const rng = random(seed + index * 7919),
				family =
					picked.form === '*'
						? choices[Math.floor(rng() * choices.length)]
						: choices.find((f) => f.id === picked.form);
			if (!family) return;
			const z = c.level * 4,
				height = picked.params?.height ?? 2 + 10 * (c.fields?.density ?? 0.5);
			const extension = rule.id === 'aufstockung';
			if (extension)
				result.push({
					id: `${rule.id}-${c.id}-bestand`,
					kind: 'prism',
					polygon: c.polygon,
					z,
					height: 4,
					role: 'bestand',
					token: '--paper',
					material: 'concrete'
				});
			if (
				extension &&
				grid.cells.some(
					(other) =>
						other.level > c.level &&
						Math.hypot(other.center[0] - c.center[0], other.center[1] - c.center[1]) < 1e-6
				)
			)
				return;
			const parameters = {
				...Object.fromEntries(family.params.map((p) => [p.key, p.default])),
				...picked.params
			};
			// Author families in a five-meter reference cell. Scale meter-based setbacks
			// and height-limited stacks with the inradius, just like radial forms.
			const cellScale =
				family.id === placeholder.id ? 1 : Math.max(0.01, inradius(c.polygon, c.center) / 2.5);
			const primitives = family.generate(
				{
					footprint: c.polygon.map(([x, y]) => [
						c.center[0] + (x - c.center[0]) / cellScale,
						c.center[1] + (y - c.center[1]) / cellScale
					]),
					center: c.center,
					orientation: c.orientation,
					z: z + (extension ? 4 : 0),
					height,
					role: extension ? 'neu' : (c.role ?? 'neu'),
					seed: Math.floor(rng() * 4294967296)
				},
				parameters
			);
			result.push(
				...fitHeight(
					scaleForm(primitives, [...c.center, z + (extension ? 4 : 0)], cellScale),
					[...c.center, z + (extension ? 4 : 0)],
					heightBudget(c, grid)
				).map((p, i) => ({ ...p, id: `${rule.id}-${c.id}-${i}-${p.id}` }))
			);
		});
		if (rule.id === 'netz') {
			const cells = new Map(grid.cells.map((c) => [c.id, c]));
			result.push(
				...grid.links.map(([a, b]): Primitive => ({
					id: `netz-${a}-${b}`,
					kind: 'pipe',
					points: [a, b].map((id) => {
						const c = cells.get(id)!;
						return [...c.center, c.level * 4 + 3.7];
					}),
					radius: 0.18,
					role: 'neu',
					token: '--cat-business',
					material: 'metal'
				}))
			);
		}
	}
	return result;
}
