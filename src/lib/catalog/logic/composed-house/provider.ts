import { cabins } from './capsule';
import { BODY_TOKEN } from '../../data/house-body';
import { flowToken } from '../../data/focus';
import type { HouseSlot } from './types';
import { piece, slab } from './parts';

function collectors({ position: [x, y, z], size: [w, d, h], id }: HouseSlot) {
	return [-1, 1].flatMap((sign, i) => {
		const cx = x + sign * w * 0.26;
		const panel = piece(
			id + i,
			{ kind: 'wedge', position: [cx - w * 0.23, y - d / 2, z], size: [w * 0.46, d, h], low: 0.25 },
			'--blueprint'
		);
		const ribs = [-0.22, 0, 0.22].map((v, j) =>
			piece(id + i + '/cell/' + j, {
				kind: 'polyline',
				points: [
					[cx - w * 0.23, y + d * v, z + h],
					[cx + w * 0.23, y + d * v, z + h * 0.25]
				]
			})
		);
		return [panel, ...ribs];
	});
}
function grove({ position: [x, y, z], size: [w, d, h], id }: HouseSlot) {
	const bed = slab(id, [x, y, z], w, d, h * 0.2, Math.min(w, d) * 0.18, flowToken.food);
	return [
		bed,
		...[-0.28, 0.02, 0.3].flatMap((u, i) => {
			const cy = y + d * (i % 2 ? 0.16 : -0.12),
				r = Math.min(d * 0.3, w * 0.17, h * 0.38);
			return [
				piece(id + '/stem/' + i, {
					kind: 'cylinder',
					position: [x + w * u, cy, z + h * 0.2],
					height: h * 0.43,
					radius: r * 0.14
				}),
				piece(
					id + '/canopy/' + i,
					{ kind: 'sphere', position: [x + w * u, cy, z + h - r], radius: r, squash: 1 },
					flowToken.food
				),
				piece(
					id + '/foliage/' + i,
					{
						kind: 'sphere',
						position: [x + w * u - r * 0.48, cy - r * 0.3, z + h - r * 1.24],
						radius: r * 0.74,
						squash: 1.05
					},
					'--cat-nature-2'
				)
			];
		})
	];
}
function tanks({ position: [x, y, z], size: [w, d, h], id, use, kind }: HouseSlot) {
	const top = z + h * 0.26,
		single = kind === 'reservoir',
		count = single ? 1 : 3;
	return [
		piece(id + '/stand', {
			kind: 'frame',
			position: [x - w / 2, y - d / 2, z + Math.min(0.1, w * 0.06) / 2],
			size: [w, d, h * 0.24 - Math.min(0.1, w * 0.06) / 2],
			cells: [count, 1, 1],
			bar: Math.min(0.1, w * 0.06)
		}),
		slab(id + '/rack', [x, y, top - h * 0.04], w, d, h * 0.04, 0.09),
		...Array.from({ length: count }, (_, i) => {
			const radius = Math.min((w / count) * 0.46, d * 0.47),
				cx = x + w * ((i + 0.5) / count - 0.5);
			return [
				piece(
					id + '/drum/' + i,
					{ kind: 'cylinder', position: [cx, y, top], height: h * 0.63, radius },
					BODY_TOKEN[use]
				),
				piece(
					id + '/lid/' + i,
					{ kind: 'dome', position: [cx, y, z + h * 0.89], radius, height: h * 0.11 },
					BODY_TOKEN[use]
				)
			];
		}).flat()
	];
}
/** Fills a reserved world-space asset box with the drafting kit. Replace this function to install a registry. */
export function placeholderElements(s: HouseSlot) {
	const {
		id,
		position: [x, y, z],
		size: [w, d, h]
	} = s;
	switch (s.kind) {
		case 'solar':
		case 'workshop':
			return [slab(id, s.position, w, d, h, Math.min(w, d) * 0.21, BODY_TOKEN[s.use])];
		case 'capsule':
			return cabins(s);
		case 'lookout':
			return [
				slab(id, s.position, w, d, h * 0.22, 0.24),
				slab(id + '/glass', [x, y, z + h * 0.22], w * 0.83, d * 0.83, h * 0.64, 0.3, '--blueprint'),
				slab(id + '/canopy', [x, y, z + h * 0.86], w, d, h * 0.14, 0.24)
			];
		case 'dome':
			return [
				piece(
					id + '/sill',
					{ kind: 'cylinder', position: s.position, radius: Math.min(w, d) / 2, height: h * 0.12 },
					flowToken.food
				),
				piece(
					id,
					{
						kind: 'dome',
						position: [x, y, z + h * 0.12],
						radius: Math.min(w, d) / 2,
						height: h * 0.88,
						facets: 2,
						glass: true
					},
					flowToken.food
				)
			];
		case 'grove':
			return grove(s);
		case 'reservoir':
		case 'rack':
			return tanks(s);
		case 'panels':
			return collectors(s);
		case 'hatch':
			return [
				slab(id, s.position, w, d, h, 0.04, BODY_TOKEN[s.use]),
				...[-0.23, 0.23].map((u, i) =>
					slab(
						id + i,
						[x + u * w, y - d * 0.54, z + h * 0.57],
						w * 0.32,
						d * 0.12,
						h * 0.25,
						0.04,
						'--blueprint'
					)
				)
			];
		case 'window':
			return [-0.36, -0.12, 0.12, 0.36].map((u, i) =>
				slab(id + i, [x + u * w, y, z], w * 0.19, d, h, 0.06, '--blueprint')
			);
		case 'chimney':
			return [
				piece(id, {
					kind: 'cylinder',
					position: s.position,
					radius: Math.min(w, d) * 0.28,
					height: h,
					shade: 0.32
				}),
				piece(
					id + '/flue',
					{
						kind: 'cylinder',
						position: [x, y, z + h],
						radius: Math.min(w, d) * 0.21,
						height: 0.035
					},
					'--ink'
				)
			];
		case 'lantern':
			return [
				piece(id, { kind: 'cylinder', position: s.position, radius: Math.min(w, d) / 2, height: h })
			];
		case 'person':
			return [
				piece(
					id + '/coat',
					{
						kind: 'cone',
						position: s.position,
						radius: Math.min(0.22, h * 0.13),
						height: h * 0.76
					},
					flowToken.people
				),
				piece(
					id + '/head',
					{ kind: 'sphere', position: [x, y, z + h * 0.87], radius: h * 0.12 },
					'--ink'
				)
			];
	}
}
