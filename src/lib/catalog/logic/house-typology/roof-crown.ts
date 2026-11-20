import { roomOnDeck } from './deck-outline';
import { prismFaces } from './prism';
import { crownSpec, objectSlot } from './objects';
import type { Body, Plan, Solid } from './types';

type XY = [number, number];
function roofAnchor(
	roof: Extract<Solid, { kind: 'prism' }>,
	preferred: XY,
	crown: Body,
	fit = false
): XY {
	const { polygon, holes = [] } = roof;
	if (
		roomOnDeck(
			polygon,
			holes,
			...preferred,
			fit ? crown.size[0] / 2 : 0,
			fit ? crown.size[1] / 2 : 0
		)
	)
		return preferred;
	const centres = prismFaces([polygon, ...holes]).map((face): XY => [
		face.reduce((sum, point) => sum + point[0], 0) / face.length,
		face.reduce((sum, point) => sum + point[1], 0) / face.length
	]);
	const distance = ([x, y]: XY) => Math.hypot(x - preferred[0], y - preferred[1]);
	centres.sort((a, b) => distance(a) - distance(b));
	return (
		centres.find((p) => roomOnDeck(polygon, holes, ...p, crown.size[0] / 2, crown.size[1] / 2)) ??
		centres[0] ??
		preferred
	);
}
/** Seats the programme crown or a barrel vault on a clear part of the walking deck. */
export function roofCrown(
	plan: Plan,
	bay: { x: number; y: number; width: number; depth: number },
	use: Body['use'],
	roof: Solid,
	top: number,
	barrel: boolean
) {
	const options = [
		crownSpec(use),
		crownSpec(use, true),
		['primitive-dome', 'short', 'dome'] as const
	];
	const crowns = options.map((spec) =>
		objectSlot(plan.site.id + '/crown', 'cantilever', spec, use, plan.seed, 0)
	);
	let crown =
		crowns.find((c) => c.size[0] <= bay.width * 0.7 && c.size[1] <= bay.depth * 0.32) ??
		crowns[crowns.length - 1];

	const preferred: XY = [bay.x, bay.y - plan.sign * Math.min(bay.depth * 0.2, 1.5)];
	let anchor = roof.kind === 'prism' ? roofAnchor(roof, preferred, crown) : preferred;
	if (barrel && roof.kind === 'prism') {
		const vault = objectSlot(
			crown.id,
			'cantilever',
			['barrel-vault', 'ribbed', 'workshop'],
			use,
			plan.seed,
			0
		);
		for (const scale of [1, 0.75, 0.5, 0.35]) {
			vault.scale = scale;
			vault.size = vault.nativeSize.map((d) => d * scale) as Body['size'];
			const centre = roofAnchor(roof, preferred, vault, true);
			if (
				!roomOnDeck(roof.polygon, roof.holes ?? [], ...centre, vault.size[0] / 2, vault.size[1] / 2)
			)
				continue;
			crown = vault;
			anchor = centre;
			break;
		}
	}
	crown.position = [...anchor, top];
	crown.anchor = 'roof';
	return crown;
}
