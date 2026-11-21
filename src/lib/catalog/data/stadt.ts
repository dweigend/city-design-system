/**
 * City chapter (home page): copy for the four sections. Building on existing stock comes first,
 * then elevated walkways, the sponge city and the component passport. Demo content lives in
 * stadtBausteine.ts and stadtHochwege.ts. Sources: docs/research/04-city-rules.md §1.1–1.3,
 * docs/research/05-bible-structure.md §5.
 */

export type Abschnitt = { id: string; titel: string; lead: string };

export const weiterbauen: Abschnitt = {
	id: 'weiterbauen',
	titel: 'Retain, convert, extend',
	lead: 'In the game · A house can gain storeys on its existing lot. The sequence shows how conversion and extension can share a footprint.'
};

export const hochwege: Abschnitt = {
	id: 'hochwege',
	titel: 'Elevated walkways between courts',
	lead: 'In the game · Elevated walkways link courts in the opening city. Access from every building is planned.'
};

export const schwamm: Abschnitt = {
	id: 'schwamm',
	titel: 'Rain stays in the district',
	lead: 'In the game · Green roofs, retention basins and water squares appear as the district grows toward its sponge-city target.'
};

export const bauteile: Abschnitt = {
	id: 'bauteile',
	titel: 'Every component has a passport',
	lead: 'Planned · A component passport would carry the identity and history of a part through storage, reuse and reassembly.'
};
