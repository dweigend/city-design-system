/**
 * Chapter Forms: section texts following the simulation "Tower on the cell" and its loops
 * (their texts live in data/turm.ts). Designer's draft; the editors write the final version.
 * Sources: docs/research/03-form-language.md, §1.4 of 04-city-rules.md,
 * 05-bible-structure.md §2. Context rules and building zones came from data/icons.ts.
 */

export type Abschnitt = { id: string; titel: string; lead: string };
export type Schritt = { id: string; titel: string; text: string };

/* ── What carries, stays ── */

export const stapel: Abschnitt = {
	id: 'formen-stapel',
	titel: 'What carries, stays. What you use, changes',
	lead: 'The structural frame stands for decades, the plug-in modules for a few years. That way a building grows with its residents instead of being torn down.'
};

export const stapelSchrittText: Schritt[] = [
	{
		id: 'bestand',
		titel: 'Existing stock',
		text: 'Two old buildings with a gap between them. Both stay standing.'
	},
	{
		id: 'geruest',
		titel: 'Structural frame',
		text: 'A space frame spans the two roofs. Under its lattice, the gap stays open.'
	},
	{
		id: 'einschub',
		titel: 'Plug-in modules',
		text: 'A capsule hangs under the lattice. Its color shows what it is for.'
	},
	{
		id: 'heraus',
		titel: 'Pull out',
		text: 'The capsule is removed. Nothing changes in the structure or the two old buildings.'
	},
	{
		id: 'umbau',
		titel: 'Conversion',
		text: 'The same capsule gets a new use. The structure and the old buildings stay as they were.'
	}
];

/* ── Deformation ── */

export const verformung: Abschnitt = {
	id: 'formen-verformung',
	titel: 'A tower may lean as long as its stairs fit',
	lead: 'A cage of eight points deforms the whole tower at once. Tilting goes far. Tapering and twisting stop where the exterior stairs would get narrower than one and a half meters.'
};

export const verformungText = {
	frei: 'All modules follow the cage. The stairs stay at least 1.5 m wide.',
	rand: 'This is the edge of the valid range: tapered or twisted any further, the stairs would be narrower than 1.5 m.',
	regler: { scherung: 'Tilt', verjuengung: 'Taper', drehung: 'Twist' }
} as const;

/* ── Vocabulary ── */

export const vokabular: Abschnitt = {
	id: 'formen-vokabular',
	titel: 'Twelve form groups build the whole city',
	lead: 'Every form belongs to a group, and every group has a job: block masses give mass, frames give bays, crowns close off.'
};

export type Formgruppe = {
	id: string;
	name: string;
	formen: string;
	rolle: string;
	/** One sentence under the image: what the group does in the building. */
	satz: string;
};

export const formgruppen: Formgruppe[] = [
	{
		id: 'klotz',
		name: 'Block mass',
		formen: 'Box, cube stack, wedge, step',
		rolle: 'Mass, plinth',
		satz: 'The block mass gives mass. It carries as a plinth or stands as a whole building volume.'
	},
	{
		id: 'zylinder',
		name: 'Cylinder',
		formen: 'Silo, round tower, half cylinder',
		rolle: 'Core, storage',
		satz: 'Cylinders hold something: water, energy, supplies. Often they form the core.'
	},
	{
		id: 'kapsel',
		name: 'Capsule',
		formen: 'Tube, sphere house, cushion',
		rolle: 'Plug-in module, rigid',
		satz: 'Capsules are finished rooms. They dock on and never deform.'
	},
	{
		id: 'bogen',
		name: 'Arch',
		formen: 'Arcade, barrel vault, half-pipe',
		rolle: 'Passage, plinth',
		satz: 'Arches open the ground. The path runs through beneath them.'
	},
	{
		id: 'rahmen',
		name: 'Frame',
		formen: 'Lattice cube, structural frame, truss',
		rolle: 'Set the bays',
		satz: 'Frames set the bays. What fills them may change.'
	},
	{
		id: 'ring',
		name: 'Ring',
		formen: 'Torus, spiral, helix',
		rolle: 'Gesture, circulation',
		satz: 'The ring is the grand gesture: helix, torus, spiral around a core.'
	},
	{
		id: 'rohr',
		name: 'Pipe',
		formen: 'Line, tube transit, elevated walkway band',
		rolle: 'Flow',
		satz: 'Pipes carry the flows, visible on the outside of the building.'
	},
	{
		id: 'kopf',
		name: 'Crown',
		formen: 'Cone, dome, solar array, roof garden',
		rolle: 'Top',
		satz: 'The crown closes off the building and shows what it is for.'
	},
	{
		id: 'huelle',
		name: 'Envelope',
		formen: 'Climate skin, greenhouse, membrane',
		rolle: 'Climate, light',
		satz: 'Envelopes make climate: a second skin of glass or membrane.'
	},
	{
		id: 'erschliessung',
		name: 'Circulation',
		formen: 'Stairs, helix, ramp, footbridge',
		rolle: 'Access, outside',
		satz: 'Stairs, ramps and footbridges sit outside. That keeps the path public.'
	},
	{
		id: 'vegetation',
		name: 'Vegetation',
		formen: 'Sphere, cone and voxel trees',
		rolle: 'Courtyard, roof',
		satz: 'Trees stand in the courtyard and on the roof, never as filler.'
	},
	{
		id: 'bestand',
		name: 'Existing stock',
		formen: 'Perimeter block, gabled house, hall',
		rolle: 'carries, gray',
		satz: 'Existing stock carries and stays gray. Everything new attaches to it.'
	}
];

/* ── Composition ── */

export const komposition: Abschnitt = {
	id: 'formen-komposition',
	titel: 'The neighborhood chooses the form',
	lead: 'Which form appears where follows from its surroundings. Along a public path the plinth opens into an arcade, a bridge spans open space between buildings, a footbridge leads out from the water’s edge, and a free flat roof becomes a garden. Whatever floats above the ground stands on columns.'
};

/** One sentence per rule under the image (ids from logic/formen/komposition.ts). */
export const regelText: Record<string, { name: string; satz: string }> = {
	hof: {
		name: 'Courtyard',
		satz: 'The edge is built, the middle stays open. A block around a void: the void becomes a courtyard garden.'
	},
	aufstockung: {
		name: 'Rooftop extension',
		satz: 'The existing building stays gray; the new part sits on its roof in color.'
	},
	netz: {
		name: 'Network',
		satz: 'Where three neighbors meet, a building grows. Elevated walkways connect the buildings center to center.'
	},
	landmarke: {
		name: 'Landmark',
		satz: 'A single cell may break ranks. Its surroundings stay low and calm.'
	},
	geruest: {
		name: 'Structural frame',
		satz: 'Every cell gets a structural frame, and plug-in modules fill its bays. Occupancy decides how many.'
	}
};

/** Type of the program levels; now used only by bibel/ProgramStack.svelte (orphaned). */
export type Programmebene = {
	ebene: string;
	nutzung: string;
	token: string;
	hell?: boolean;
	braucht: string;
	tiefe: 'öffentlich' | 'gemeinschaftlich' | 'privat';
};
