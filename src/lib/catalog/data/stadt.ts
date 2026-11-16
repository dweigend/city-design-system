/**
 * City chapter (home page): copy for the four sections. Building on existing stock comes first,
 * then elevated walkways, the sponge city and the component passport. Demo content lives in
 * stadtBausteine.ts and stadtHochwege.ts. Sources: docs/research/90-city-game-ideen.md §1.1–1.3,
 * docs/research/114-struktur-inhaltsplan.md §5.
 */

export type Abschnitt = { id: string; titel: string; lead: string };

export const weiterbauen: Abschnitt = {
	id: 'weiterbauen',
	titel: 'Retain, convert, extend',
	lead: 'The city never starts on empty ground. First, what stands stays. Then the old building takes on a new use. Only then is something new added.'
};

export const hochwege: Abschnitt = {
	id: 'hochwege',
	titel: 'Elevated walkways connect every building',
	lead: 'The city has no streets. Paths run above the alleys and across the roofs, and every building plugs into the network that is already there.'
};

export const schwamm: Abschnitt = {
	id: 'schwamm',
	titel: 'Rain stays in the district',
	lead: 'A block in the sponge city does not throw rain away. It holds it on the roof, in the ground and in the basin, and releases it slowly.'
};

export const bauteile: Abschnitt = {
	id: 'bauteile',
	titel: 'Every component has a passport',
	lead: 'Nothing is lost in this city. A window, a panel, a pallet: every instance keeps its number and its history, however often it moves.'
};
