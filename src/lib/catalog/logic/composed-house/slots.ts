import { roofLanding } from './deck-plan';
import { STORY } from '../../data/grid';
import type { HouseUse } from '../../data/house-body';
import type { Vec3 } from '../parametrik/types';
import type { AssetKind, HouseSlot, Section } from './types';

function slot(
	id: string,
	anchor: HouseSlot['anchor'],
	kind: AssetKind,
	position: Vec3,
	size: Vec3,
	use: HouseUse
): HouseSlot {
	return { id, anchor, kind, position, size, use, facing: [0, -1] };
}
/** Clear height in metres one capsule needs, including its cradle. */
const CAPSULE = 3.2;
/** Fills a living tier by count: one or two rows of capsules, stacked while the clearance allows.
 * Upper capsules shift sideways so the stack reads as plugged-in units, not as one block. */
function capsuleStack(s: Section, i: number): HouseSlot[] {
	const deck = s.decks[i],
		[x, y, z] = deck.position;
	const clearance = ((s.decks[i + 1]?.position[2] ?? s.top + CAPSULE) - z) * 0.92;
	const tiers = Math.max(1, Math.min(3, Math.floor(clearance / CAPSULE)));
	const w = deck.width * (deck.round ? 0.71 : 0.86),
		d = deck.depth * (deck.round ? 0.67 : 0.74);
	const rows = !deck.round && d >= 2 * CAPSULE ? 2 : 1,
		back = deck.round ? 0 : deck.depth * 0.06,
		shift = tiers > 1 ? w * 0.07 : 0;
	return Array.from({ length: tiers * rows }, (_, n) => {
		const tier = Math.floor(n / rows),
			row = n % rows;
		const side = (tier + row) % 2 ? -1 : 1;
		return slot(
			s.id + '/tier/' + i + '/body' + (n ? '/' + n : ''),
			'deck',
			'capsule',
			[x + side * shift, y - back + (row - (rows - 1) / 2) * (d / rows), z + tier * CAPSULE],
			[w - 2 * shift, d / rows, CAPSULE],
			'living'
		);
	});
}
function tierSlots(s: Section, i: number): HouseSlot[] {
	const deck = s.decks[i],
		[x, y, z] = deck.position,
		id = s.id + '/tier/' + i;
	if (deck.kind === 'capsule' || (deck.kind === 'gallery' && deck.use === 'living'))
		return capsuleStack(s, i);
	if (deck.kind === 'void' || deck.kind === 'gallery') {
		if (i !== s.decks.findIndex((d) => d.kind === 'void' || d.kind === 'gallery')) return [];
		return [
			slot(
				id + '/planter',
				'deck',
				'grove',
				[x, y - deck.depth * 0.24, z],
				[
					deck.width * 0.55,
					deck.depth * 0.25,
					Math.min(STORY, (s.decks[i + 1].position[2] - z) * 0.55)
				],
				'food'
			)
		];
	}
	const crown = i === s.decks.length - 1,
		round = deck.round;
	const w = deck.width * (round ? 0.71 : 0.81),
		d = deck.depth * (round ? 0.67 : deck.kind === 'grove' ? 0.66 : 0.74);
	const clearance = (s.decks[i + 1]?.position[2] ?? s.top) - z;
	const h = crown
		? clearance * 0.87
		: Math.min(clearance * 0.68, Math.max(1.2, Math.min(w, d) * 0.48), STORY * 1.15);
	const bx = x + (deck.kind === 'grove' && !round ? -deck.width * 0.08 : 0);
	const body = slot(
		id + '/body',
		deck.kind === 'dome' ? 'roof' : 'deck',
		deck.kind,
		[bx, y - (deck.kind === 'grove' && !round ? deck.depth * 0.12 : 0), z],
		[w, d, h],
		deck.use
	);
	const parts = [body];
	if (deck.kind === 'solar' || deck.kind === 'workshop')
		parts.push({
			...slot(
				id + '/windows',
				'facade',
				'window',
				[bx + w * 0.5, y, z + h * 0.28],
				[0.14, d * 0.6, h * 0.38],
				deck.use
			),
			facing: [1, 0]
		});
	if (deck.kind === 'solar')
		parts.push(
			slot(
				id + '/collector',
				'roof',
				'panels',
				[bx - w * 0.07, y, z + h],
				[w * 0.7, d * 0.75, Math.min(0.65, h * 0.18)],
				deck.use
			)
		);
	if (crown && deck.kind !== 'dome' && s.crown !== 'panels')
		parts.push(
			slot(
				id + '/lantern',
				'roof',
				s.crown,
				roofLanding(s),
				[w * 0.12, d * 0.16, Math.min(1.25, clearance - h)],
				deck.use
			)
		);
	return parts;
}

/** Reserves equipment and facade attachments independently of the primitive provider. */
export function assetSlots(s: Section, uses: HouseUse[]) {
	const slots = s.decks.flatMap((_, i) => tierSlots(s, i));
	const services = [...new Set(uses)].filter((use) => use !== 'living').sort();
	services.forEach((use, i) => {
		const [x, y, z] = s.base;
		const size = Math.min((s.width / (services.length + 1)) * 0.72, s.depth * 0.19, 2);
		slots.push(
			slot(
				s.id + '/supply/' + use,
				'ground',
				'reservoir',
				[x + s.width * 0.42, y + s.depth * ((i + 0.5) / services.length - 0.5) * 0.8, z],
				[size, size, Math.min(2.4, s.decks[0].position[2] - z - 0.2)],
				use
			)
		);
	});
	return slots;
}
