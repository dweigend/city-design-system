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
	lead: 'Bible study · The sandbox grows storeys on existing lots (/sandbox). This sequence shows how conversion and extension share a footprint.'
};

export const hochwege: Abschnitt = {
	id: 'hochwege',
	titel: 'Elevated walkways between courts',
	lead: 'Bible study · The sandbox links courts with footbridges over alleys (/sandbox); façade landings from every building are planned (ST12, #37).'
};

export const schwamm: Abschnitt = {
	id: 'schwamm',
	titel: 'Rain stays in the district',
	lead: 'Bible study · The sandbox runs sponge-city growth (/sandbox); this sequence isolates green roofs, retention basins and water squares.'
};

export const bauteile: Abschnitt = {
	id: 'bauteile',
	titel: 'Every component has a passport',
	lead: 'Planned · A component passport would carry the identity and history of a part through storage, reuse and reassembly.'
};
