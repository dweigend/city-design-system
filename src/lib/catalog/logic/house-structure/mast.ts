import type { HouseStructure, Platform, SkinPatch } from './contract';
import {
	centre,
	climb,
	identity,
	seatedDeck,
	shrink,
	trunk,
	POST_RADIUS,
	TIE_RADIUS,
	type Plot
} from './plot';

/** Share of the parcel ring the brim rods reach and the hung decks cover. */
const BRIM_SHARE = 0.98;
const DECK_SHARE = 0.58;
/** Height of the brim tips below the mast head, metres. */
const BRIM_DROP = 2.2;
/** Share of the way from the mast to the first parcel corner at which the ladder climbs. */
const LADDER_SHARE = 0.2;

/**
 * One mast. Decks hang from its head on ties and lean on spokes at `datums`, metres above
 * ground in ascending order. Rods thrown out below the head carry a brim; one cloth is pulled
 * from the head over the brim tips as the roof, and a small sail drops from every second brim
 * edge to the lowest deck. `height` is the mast head above ground and must clear the highest
 * deck by more than the brim drop. Convex parcel required.
 */
export function mastHouse(plot: Plot, shape: { height: number; datums: number[] }): HouseStructure {
	const ring = plot.parcel.polygon,
		[x, y] = centre(ring);
	const brim = plot.ground + shape.height - BRIM_DROP;
	const heights = [plot.ground, ...shape.datums.map((h) => plot.ground + h), brim];
	heights.push(plot.ground + shape.height);
	const { nodes, rods, collar } = trunk(plot.id + '/mast', [x, y], heights);
	const head = collar(heights.length - 1),
		yoke = collar(heights.length - 2);
	const tips = shrink(ring, BRIM_SHARE).map((p, corner) => {
		const id = plot.id + '/brim/' + corner;
		nodes.push({ id, position: [...p, brim] });
		rods.push({ id: id + '/rod', from: yoke, to: id, radius: POST_RADIUS, action: 'strut' });
		return id;
	});
	const platforms: Platform[] = shape.datums.map((h, i) => {
		const { platform, seats } = seatedDeck(plot, i, plot.ground + h, DECK_SHARE);
		seats.forEach(({ id }, corner) =>
			rods.push(
				{ id: id + '/spoke', from: collar(i + 1), to: id, radius: POST_RADIUS, action: 'strut' },
				{ id: id + '/hanger', from: tips[corner], to: id, radius: TIE_RADIUS, action: 'tie' }
			)
		);
		nodes.push(...seats);
		return platform;
	});
	const tent: SkinPatch = {
		id: plot.id + '/tent',
		slot: 'shell',
		use: plot.use,
		boundary: tips.map((node) => ({ node })),
		edges: tips.map(() => 'cable'),
		interior: [{ node: head }],
		membrane: { pressure: 0, tension: 2 }
	};
	const sails = tips.flatMap((node, corner): SkinPatch[] => {
		const next = (corner + 1) % tips.length;
		if (corner % 2 || !platforms.length) return [];
		// The sail ends on the first raised deck, so the ground stays open.
		const foot = platforms[Math.min(1, platforms.length - 1)];
		return [
			{
				id: plot.id + '/sail/' + corner,
				slot: 'screen',
				use: plot.use,
				boundary: [
					{ node: foot.bearers[corner] },
					{ node: foot.bearers[next] },
					{ node: tips[next] },
					{ node }
				],
				edges: ['seam', 'cable', 'seam', 'cable'],
				membrane: { pressure: 0, tension: 3 }
			}
		];
	});
	return {
		...identity(plot),
		principle: 'mast',
		nodes,
		rods,
		platforms,
		skins: [tent, ...sails],
		access: climb(plot.ground, 'ladder', platforms, shrink(ring, LADDER_SHARE)[0]),
		roof: { kind: 'skin', patches: [tent.id] }
	};
}
