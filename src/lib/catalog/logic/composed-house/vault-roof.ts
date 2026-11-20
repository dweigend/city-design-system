import { roofAxis } from './roof-axis';
import { roomOnDeck } from '../house-typology';
import { houseObject, type StockPart } from './house-object';
import type { Section } from './types';
import { roleSurface, type SectionSurfaces } from './surfaces';

type XY = [number, number];

// Orient the arch across the long dimension of its supporting deck. The barrel springs
// from two parallel walls and its open gables expose the curved soffit at town scale.
function vaultSeat(ring: XY[]) {
	const [dx, dy] = roofAxis(ring);
	const length = Math.hypot(dx, dy),
		c = dx / length,
		s = dy / length;
	const local = ring.map(([x, y]): XY => [x * c + y * s, -x * s + y * c]);
	const xs = local.map((p) => p[0]),
		ys = local.map((p) => p[1]);
	const w = Math.max(...xs) - Math.min(...xs),
		d = Math.max(...ys) - Math.min(...ys);
	const x = Math.min(...xs) + w / 2,
		y = Math.min(...ys) + d / 2;
	const scale = [0.96, 0.88, 0.8, 0.72, 0.6, 0.48].find((f) =>
		roomOnDeck(local, [], x, y, (w * f) / 2, (d * f) / 2)
	);
	if (!scale) return;
	return {
		x: x * c - y * s,
		y: x * s + y * c,
		angle: Math.atan2(s, c),
		w: w * scale,
		d: d * scale
	};
}

/** Fits the registered ribbed barrel across a clear terrace with two walls carrying its spring lines. */
export function vaultRoof(
	section: Section,
	ring: XY[],
	surfaces: SectionSurfaces,
	clear: number
): StockPart[] {
	const seat = vaultSeat(ring);
	if (!seat) return [];
	const { x, y, w, d, angle } = seat,
		roof = section.top + clear,
		rise = w * 0.68;
	const at = (u: number, v: number): XY => [
		x + u * Math.cos(angle) - v * Math.sin(angle),
		y + u * Math.sin(angle) + v * Math.cos(angle)
	];
	const stock = houseObject('barrel-vault', 'ribbed', section.seed, {
		instanceId: section.id + '/roof/barrel',
		slots: { body: surfaces.shell, accent: roleSurface(surfaces.shell, 'screen') }
	}).parts;
	const vaults = stock.map((p, i) => {
		if (p.kind !== 'vault') throw Error('Expected a barrel vault');
		const centre = at(0, (p.position[1] * d) / 5.8);
		return {
			...p,
			position: [...centre, roof] as [number, number, number],
			width: w + (i ? 0.08 : 0),
			length: i ? 0.14 : d,
			rotation: angle,
			rise: rise + (i ? 0.06 : 0),
			thickness: i ? 0.18 : 0.12
		};
	});
	const walls = [-1, 1].map((sign) => {
		const panel = houseObject('primitive-slab', 'square', section.seed, {
			instanceId: section.id + '/roof/spring/' + sign,
			slots: { body: surfaces.shell }
		}).parts[0];
		if (panel.kind !== 'prism') throw Error('Expected a bearing wall');
		const u = sign * (w / 2 - 0.1);
		return {
			...panel,
			polygon: [
				at(u - 0.08, -d / 2),
				at(u + 0.08, -d / 2),
				at(u + 0.08, d / 2),
				at(u - 0.08, d / 2)
			],
			z: section.top,
			height: clear
		};
	});
	return [...walls, ...vaults];
}
