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
function tierSlots(s: Section, i: number): HouseSlot[] {
	const deck = s.decks[i],
		[x, y, z] = deck.position,
		id = s.id + '/tier/' + i;
	if (deck.kind === 'void' || deck.kind === 'gallery') return [];
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
		'deck',
		deck.kind,
		[bx, y - (deck.kind === 'grove' && !round ? deck.depth * 0.12 : 0), z],
		[w, d, h],
		deck.use
	);
	const parts = [body];
	if (deck.kind === 'capsule')
		parts.push(
			slot(
				id + '/windows',
				'facade',
				'window',
				[bx, y - d * 0.48, z + h * 0.28],
				[w * 0.78, d * 0.06, h * 0.33],
				deck.use
			)
		);
	if (deck.kind === 'solar' || deck.kind === 'workshop')
		parts.push(
			slot(
				id + '/hatch',
				'facade',
				'hatch',
				[bx + w * 0.18, y - d * 0.5, z],
				[w * 0.24, 0.09, h * 0.58],
				deck.use
			)
		);
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
				[bx + w * 0.37, y + d * 0.15, z + h],
				[w * 0.12, d * 0.16, Math.min(1.25, clearance - h)],
				deck.use
			)
		);
	const px = round ? 0.22 : 0.32,
		py = round ? -0.4 : -0.44;
	parts.push(
		slot(
			id + '/figure',
			'deck',
			'person',
			[x + px * deck.width, y + py * deck.depth, z],
			[0.4, 0.4, Math.min(1.65, clearance * 0.65)],
			'living'
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
