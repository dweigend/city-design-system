import { required } from '../required';
import type { Vec3 } from '../parametrik/types';
import type { Deck, Section } from './types';

/** Staggers the deck edges around the shared bearing axes. */
export function deckPlan(level: number, count: number, round: boolean, aspect: Section['aspect']) {
	if (count === 1) return { width: 1, depth: round ? 1 : 0.88, x: 0, y: 0 };
	const crown = level === count - 1;
	const width = crown ? 1.06 : level % 2 ? 0.88 : 1;
	const depth = round ? width : crown ? 1 : 0.92;
	const offset = level % 2 ? -0.04 : 0.04;
	return { width, depth, x: aspect.x * offset, y: aspect.y * offset };
}

/** Rear walking line leaves the occupied deck body clear. */
export function accessEdge(deck: Deck) {
	return deck.position[1] + deck.depth * (deck.round ? 0.4 : 0.46);
}

/** Centre of the roof walk at the last flight's upper datum in world metres. */
export function roofLanding(s: Section): Vec3 {
	const deck = required(s.decks.at(-1), 'upper deck');
	return [deck.position[0], accessEdge(deck), s.top];
}
