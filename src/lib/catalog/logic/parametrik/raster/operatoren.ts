import type { Grid, Point2 } from '../vocab';
import type { Primitive } from '../types';
import { heightBudget } from '../komposition/height';
import { random } from '../random';
import { cell, grid, subdivide } from './geometry';
export function field(input: Grid, point: Point2, radius: number, name = 'density'): Grid {
	return {
		...input,
		cells: input.cells.map((c) => ({
			...c,
			fields: {
				...c.fields,
				[name]: Math.max(
					0,
					1 - Math.hypot(c.center[0] - point[0], c.center[1] - point[1]) / Math.max(0.001, radius)
				)
			}
		}))
	};
}
export function occupy(input: Grid, threshold = 0.5, seed = 42, name = 'density'): Grid {
	const rng = random(seed);
	return {
		...input,
		cells: input.cells.map((c) => ({
			...c,
			fields: { ...c.fields, occupied: (c.fields?.[name] ?? rng()) >= threshold ? 1 : 0 }
		}))
	};
}
export function divide(input: Grid, ids = input.cells.map((c) => c.id)): Grid {
	const chosen = new Set(ids);
	return grid(
		input.kind,
		input.cells.flatMap((c) =>
			chosen.has(c.id)
				? subdivide(c.polygon).map((p, i) => ({
						...cell(p, `${c.id}/${i}`, c.level),
						fields: c.fields ? { ...c.fields } : undefined,
						role: c.role
					}))
				: [{ ...c }]
		)
	);
}
/** Dijkstra, weighted by meter distance including the fixed four meter story height. */
export function shortestPath(input: Grid, from: string, to: string): string[] {
	const cells = new Map(input.cells.map((c) => [c.id, c]));
	if (!cells.has(from) || !cells.has(to)) return [];
	const adjacency = new Map(input.cells.map((c) => [c.id, [] as string[]]));
	input.links.forEach(([a, b]) => {
		adjacency.get(a)?.push(b);
		adjacency.get(b)?.push(a);
	});
	const pending = new Set(cells.keys()),
		distance = new Map([[from, 0]]),
		previous = new Map<string, string>();
	while (pending.size) {
		let u: string | undefined,
			best = Infinity;
		for (const id of pending)
			if ((distance.get(id) ?? Infinity) < best) {
				u = id;
				best = distance.get(id)!;
			}
		if (u === undefined) break;
		if (u === to) {
			const path = [u];
			while (previous.has(path[0])) path.unshift(previous.get(path[0])!);
			return path;
		}
		pending.delete(u);
		for (const v of adjacency.get(u) ?? []) {
			const a = cells.get(u)!,
				b = cells.get(v)!;
			const d =
				best +
				Math.hypot(a.center[0] - b.center[0], a.center[1] - b.center[1], 4 * (a.level - b.level));
			if (d < (distance.get(v) ?? Infinity)) {
				distance.set(v, d);
				previous.set(v, u);
			}
		}
	}
	return [];
}
export function path(
	input: Grid,
	from: string,
	to: string,
	kind: 'polyline' | 'pipe' = 'polyline'
): Primitive[] {
	const ids = shortestPath(input, from, to);
	if (ids.length < 2) return [];
	const cells = new Map(input.cells.map((c) => [c.id, c]));
	return [
		{
			id: `path-${from}-${to}`,
			kind,
			points: ids.map((id) => {
				const c = cells.get(id)!;
				return [...c.center, c.level * 4 + 1];
			}),
			radius: 0.15,
			token: '--cat-business',
			role: 'neu',
			material: 'metal'
		}
	];
}
export function gridPrimitives(input: Grid, lift = 0): Primitive[] {
	const cells = new Map(input.cells.map((c) => [c.id, c]));
	return [
		...input.cells.flatMap((c): Primitive[] => {
			const density = c.fields?.density ?? 0,
				z = c.level * 4,
				height = Math.min(0.12 + density * lift, heightBudget(c, input) - 0.08);
			return [
				{
					id: `plate-${c.id}`,
					kind: 'prism',
					polygon: c.polygon,
					z,
					height,
					role: 'neu',
					token: density > 0.5 ? '--cat-living' : density > 0 ? '--cat-nature' : '--paper',
					material: 'concrete'
				},
				{
					id: `edge-${c.id}`,
					kind: 'polyline',
					points: c.polygon.map((p) => [...p, z + height + 0.02]),
					closed: true,
					role: 'neu',
					token: '--blueprint',
					material: 'metal'
				}
			];
		}),
		...input.links.map(([a, b]): Primitive => ({
			id: `link-${a}-${b}`,
			kind: 'polyline',
			points: [a, b].map((id) => {
				const c = cells.get(id)!;
				return [
					...c.center,
					c.level * 4 +
						0.2 +
						Math.min((c.fields?.density ?? 0) * lift, heightBudget(c, input) - 0.28)
				];
			}),
			role: 'neu',
			token: '--blueprint',
			material: 'metal'
		}))
	];
}
