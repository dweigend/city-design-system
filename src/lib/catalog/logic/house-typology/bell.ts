import { objectSlot } from './objects';
import type { Plan, Point } from './types';

/** Places one bell over the garden, with whole planter modules on either side. */
export function bellGarden(plan: Plan, i: number, z: number) {
	const { site, rear, sign, seed } = plan,
		[cx] = site.center;
	const id = site.id + '/level/' + i + '/body/';
	const depth = site.depth - site.accessDepth - 1.55;
	const variant = depth >= 6.55 ? 'winter-garden' : depth >= 4.42 ? 'hothouse' : 'cloche';
	const dome = objectSlot(id + '0', ['glass-bell', variant, 'dome'], 'food', seed, 0);
	const [w, d] = dome.size;
	dome.position = [cx, rear - sign * (1.25 + d / 2), z + 0.12];
	const side = (site.width - w - 0.6) / 2;
	const length = [7.5, 5, 2.5].find((l) => l * 0.85 <= side + 1e-8);
	if (!length || depth < 2.5) return [dome];
	const planter = objectSlot(
		id + 'planter',
		['kit-garden-planter-' + String(length).replace('.', 'p') + 'm', 'raised', 'grove'],
		'food',
		seed,
		0
	);
	const count = Math.max(1, Math.floor(side / (length * 0.85) + 1e-8));
	const scale = Math.min(1.15, side / (count * length));
	const pitch = length * scale,
		breadth = 2.5 * scale;
	const rows = Math.max(1, Math.min(Math.floor(depth / breadth), Math.round(d / breadth)));
	return [
		dome,
		...[-1, 1].flatMap((dir) =>
			Array.from({ length: rows * count }, (_, j) => ({
				...planter,
				scale,
				size: planter.size.map((v) => v * scale) as Point,
				id: id + dir + '/' + j,
				position: [
					cx + dir * (w / 2 + ((j % count) + 0.5) * pitch),
					rear - sign * (1.25 + (Math.floor(j / count) + 0.5) * breadth),
					z + 0.12
				] as Point
			}))
		)
	];
}
