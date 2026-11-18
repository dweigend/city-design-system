/**
 * The game's guiding vision: one sentence, one stance, four guiding ideas. Shown on the home page
 * (City); each guiding idea leads to the section that demonstrates it. Whatever concerns the
 * building itself (verticality, bundled functions, urban farming) is shown in the Forms chapter.
 */

/** Flow role of a guiding idea; the page maps it to a color token. `bestand` stays gray. */
export type LeitideeTon = 'bestand' | 'people' | 'water' | 'material';

export type Leitidee = {
	titel: string;
	text: string;
	/** Section ID on the City page. */
	ziel: string;
	ton: LeitideeTon;
};

export const leitbild = {
	claim:
		'We are building the city of the future: sustainable, self-sufficient, with closed material loops.',
	haltung:
		'Drawn somewhere between art, architectural design and built utopia, and deliberately unlike a typical city builder.',
	einfluesse: [
		'Bauhaus',
		'Memphis',
		'Brutalism',
		'Archigram',
		'Superstudio',
		'Ant Farm',
		'Buckminster Fuller',
		'Centre Pompidou',
		'contemporary timber construction'
	],
	leitideen: [
		{
			titel: 'Build on, not build new',
			text: 'What stands, stays. It is converted, extended upward, densified.',
			ziel: 'weiterbauen',
			ton: 'bestand'
		},
		{
			titel: 'A city for people on foot',
			text: 'Paths run overhead and belong to people on foot. Everything is within walking distance.',
			ziel: 'hochwege',
			ton: 'people'
		},
		{
			titel: 'Sponge city',
			text: 'Rain is retained, used and designed with.',
			ziel: 'schwamm',
			ton: 'water'
		},
		{
			titel: 'Nothing is lost',
			text: 'Every component keeps its history and moves on.',
			ziel: 'bauteile',
			ton: 'material'
		}
	] satisfies Leitidee[]
};
