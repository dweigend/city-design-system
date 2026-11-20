import { quadGrid, squareGrid, type QuadCell } from '../../src/lib/catalog/logic/quad-grid';
import type { HouseSite } from '../../src/lib/catalog/logic/house-typology';
import type { HouseUse } from '../../src/lib/catalog/data/house-body';

type Point = QuadCell['center'];
export type Variant = 'regular' | 'organic' | 'rotated' | 'mixed' | 'hillside';
const shapes = [
	['L', ['###', '#..', '#..'], 5],
	['T', ['###', '.#.', '.#.'], 6],
	['U', ['###', '#.#', '#.#'], 5],
	['court', ['###', '#.#', '###'], 6],
	['irregular', ['##..', '.###', '..#.'], 5],
	['strip', ['######'], 3.75],
	['small', ['#'], 2.75],
	['large', ['###', '###', '###'], 12]
] as const;

function terrain(variant: Variant, phase: number, module: number) {
	return ([x, y]: Point): Point => {
		const angle = variant === 'rotated' ? 0.54 : 0;
		const u = x * Math.cos(angle) - y * Math.sin(angle);
		const v = y * Math.cos(angle) + x * Math.sin(angle);
		if (variant === 'organic' || variant === 'hillside') {
			const warp = module * 0.28 * Math.sin(y / module + phase);
			return [
				u + warp,
				v + module * 0.15 * Math.cos(x / module),
				variant === 'hillside' ? 0.48 * x : 0
			];
		}
		if (variant === 'mixed')
			return [
				x + module * 0.32 * Math.sin(x / module + phase),
				y + module * 0.25 * Math.cos(y / module),
				0
			];
		return [u, v, 0];
	};
}

/** Twenty-four reproducible six-lot ensembles, with three painted heights per footprint. */
export function cases(variant: Variant) {
	return shapes.flatMap(([shape, mask, module], i) =>
		[1, 3, 7].map((height, j) => {
			const seed = 407 + i * 37 + j;
			const transform = terrain(variant, seed % 7, module);
			const grid = quadGrid(
				squareGrid(mask[0].length + 3, Math.max(2, mask.length), module).cells.map((cell) => {
					const corners = cell.corners.map(transform) as [...QuadCell['corners']];
					const center = [0, 1, 2].map((k) =>
						corners.reduce((sum, p) => sum + p[k] / 4, 0)
					) as Point;
					return { ...cell, corners, center };
				})
			);

			const groups = [
				grid.cells.filter((cell) => {
					const [x, y] = cell.id.split('/').map(Number);
					return mask[y]?.[x - 3] === '#';
				}),
				...['0/0', '1/0', '2/0', '0/1', '1/1'].map((id) => grid.cells.filter((c) => c.id === id))
			];
			const crown = (group: (typeof groups)[number]) =>
				Math.max(...group.flatMap((c) => c.corners.map((p) => p[2])));
			const highest = crown(groups.flat());
			const uses: HouseUse[] = ['living', 'energy', 'food', 'material', 'water'];
			const sites: HouseSite[] = groups.map((group, k) => {
				const pad = (variant === 'hillside' ? crown(group) : highest) + 0.5;
				const cells = group.map((c) => ({ ...c, pad }));
				const floors = Array.from(
					{ length: height + (k % 2) },
					(_, f) => uses[(f + k + i) % uses.length]
				);
				return { cells, stacks: new Map(cells.map((c) => [c.id, floors])), seed };
			});
			return {
				name: [variant, shape, height].join('/'),
				grid: quadGrid(
					grid.cells.map((c) => sites.flatMap((site) => site.cells).find((p) => p.id === c.id) ?? c)
				),
				sites,
				seed
			};
		})
	);
}
