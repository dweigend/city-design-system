/**
 * Universal principles of the design bible. Synthesis of docs/research/02-geometry-principles.md §8
 * (U1–U10, paper abbreviations P/Q/E/D/G) and the rules from L11 (docs/research/02-geometry-principles.md).
 * Every rule holds on every grid; code locations are relative to src/lib/catalog/.
 */
export type Glyph =
	| 'graph'
	| 'dual'
	| 'lokal'
	| 'feld'
	| 'baum'
	| 'familie'
	| 'gueltig'
	| 'abhaengig'
	| 'netz'
	| 'schichten'
	| 'meter'
	| 'entartung';

export type Prinzip = {
	id: string;
	titel: string;
	satz: string;
	/** What the player sees: design language. */
	spieler: string;
	/** What the engine does: data model and process. */
	engine: string;
	invariante: string;
	glyph: Glyph;
};

export const prinzipien: Prinzip[] = [
	{
		id: 'U1',
		titel: 'Relations before embedding',
		satz: 'First define what is connected; then where and how it appears.',
		spieler: 'Core, room, bridge and conduit stay the same in plan, section and exploded view.',
		engine:
			'A graph with typed connections, separate from the coordinates. The 3D form is derived from it.',
		invariante: 'Names come from input and rule path, never from coordinates.',
		glyph: 'graph'
	},
	{
		id: 'U2',
		titel: 'Area and transition are dual',
		satz: 'The inhabited cell and the transition between cells are two views of one structure.',
		spieler: 'Corners, edges and courtyards are designed together. No building is a loose cube.',
		engine:
			'Every edge knows both its sides. Occupancy sits on the corner, the module in the face.',
		invariante: 'At most two faces share an edge, and every edge leads back to its twin.',
		glyph: 'dual'
	},
	{
		id: 'U3',
		titel: 'Local rule, global check',
		satz: 'Small matching parts add up to large forms; usability is checked separately.',
		spieler:
			'Arcade, courtyard and roof emerge from adjacency. A beautiful image is no substitute for access.',
		engine: 'Mask and context choose the module; the path check verifies access and reachability.',
		invariante:
			'A versioned catalog, a fixed order of decisions and a clear answer when nothing fits.',
		glyph: 'lokal'
	},
	{
		id: 'U4',
		titel: 'Fields guide direction and density',
		satz: 'A spatial tendency holds across many elements, regardless of their number.',
		spieler: 'Alleys, frames and facades follow terrain and existing stock together.',
		engine: 'One field for density, one for direction. Parameters are stored, not edges.',
		invariante: 'Equal parameters yield the same field; every singularity has a name.',
		glyph: 'feld'
	},
	{
		id: 'U5',
		titel: 'Hierarchy with provenance',
		satz: 'The same split creates large and small orders and never forgets its origin.',
		spieler:
			'District, building, floor and detail share related rhythms. Expanding a part explains how it came to be.',
		engine: 'A tree records which rule created which parts. Only the affected branch is rebuilt.',
		invariante: 'Together, the parts cover exactly the area of their origin.',
		glyph: 'baum'
	},
	{
		id: 'U6',
		titel: 'Form family with permitted deformation',
		satz: 'Identity comes from preserved relations and proportions, not from rigid repetition.',
		spieler: 'The same family fits every cell. Doors, capsules and crowns keep their size.',
		engine:
			'Reference form in the unit square, mapped bilinearly onto the cell; rigid parts keep their own pose.',
		invariante: 'No form flips over, and distortion stays bounded.',
		glyph: 'familie'
	},
	{
		id: 'U7',
		titel: 'Validity is an invariant',
		satz: 'Every accepted operation preserves explicit geometric and semantic conditions.',
		spieler:
			'Existing stock stays standing. What does not fit is rejected with a reason, never silently moved.',
		engine:
			'Propose, check, commit. The orientation of a face is checked exactly, dimensions with tolerance.',
		invariante: 'Adjacency, orientation, clearance, access and protection hold after every change.',
		glyph: 'gueltig'
	},
	{
		id: 'U8',
		titel: 'Change follows dependencies',
		satz: 'An intervention changes only its traceable consequences.',
		spieler:
			'The slider moves what it means to move. Neighboring buildings do not change shape at random.',
		engine:
			'The engine records what depends on what and rebuilds only what is affected. Costly work like the mesh stays separate from cheap work like color and focus.',
		invariante:
			'Incremental rebuilding yields the same result as a full rebuild; undo and redo are exact.',
		glyph: 'abhaengig'
	},
	{
		id: 'U9',
		titel: 'Reachability connects scales',
		satz: 'A function belongs to the city when usable paths connect it to people and resources.',
		spieler:
			'Elevated walkways, cores and conduits are the legible order. Proximity is walking time.',
		engine:
			'Typed connections link paths, cores and conduits. The engine finds shortest paths and counts what a district can reach.',
		invariante:
			'A crossing without a connection is not a link. Target for every resource: inflow minus outflow equals the change in stock.',
		glyph: 'netz'
	},
	{
		id: 'U10',
		titel: 'Separate intent, derivation and representation',
		satz: 'Representation explains the state; it does not define it.',
		spieler: 'Existing and new, section and exploded view, focus and material stay consistent.',
		engine:
			'Intent, checked state, geometry, view – in that order. The scene only displays and knows no grid.',
		invariante: 'Switching the view never changes state or names.',
		glyph: 'schichten'
	},
	{
		id: 'M1',
		titel: 'Rules measure in meters',
		satz: 'Width, area, span and run are lengths, not cell counts.',
		spieler: 'A footbridge offers the same walkable length on every grid, a stair the same pitch.',
		engine: 'Constants in meters: span 13 m, run 2.6–10 m per 4 m of height, floor 4 m.',
		invariante: 'No rule value depends on cell size.',
		glyph: 'meter'
	},
	{
		id: 'M2',
		titel: 'Degeneracy is a rule',
		satz: 'Blocks that are too small, missing courtyards and edges that are too short each get their own designed answer.',
		spieler:
			'A leftover block becomes a square; a tower without a courtyard uses the ring. Nothing visibly breaks.',
		engine:
			'Edge cases are branches in the rule set, not exceptions: below five build cells, the space stays a square.',
		invariante: 'Every input has a defined result; mask 0 never produces geometry.',
		glyph: 'entartung'
	}
];

export type Schicht = {
	id: string;
	titel: string;
	frage: string;
	autoritativ: string;
	abgeleitet: string;
};

/** Three layers of the core plus representation. */
export const schichten: Schicht[] = [
	{
		id: 'semantik',
		titel: 'Semantics',
		frage: 'What is it?',
		autoritativ: 'Occupancy, role, protection and the stack of level, use and height.',
		abgeleitet: 'How a place is used, no matter how many modules show it.'
	},
	{
		id: 'topologie',
		titel: 'Topology',
		frage: 'What borders what?',
		autoritativ: 'Faces with fixed names and shared corners.',
		abgeleitet: 'Edges, neighbors and the split tree of every face.'
	},
	{
		id: 'geometrie',
		titel: 'Geometry',
		frage: 'Where is it?',
		autoritativ: 'The position of every corner, quality bounds and field values.',
		abgeleitet: 'Checked quads, field lines and their check values.'
	},
	{
		id: 'darstellung',
		titel: 'Representation',
		frage: 'How does it appear?',
		autoritativ: 'Nothing. Only the view: level, focus, material, section.',
		abgeleitet: 'The 3D scene and the image.'
	}
];

/** Transitions between the layers. */
export const schichtSchritte = ['translate', 'derive', 'project'];
export const schichtRueckweg =
	'The way back runs only through intent: an input is proposed, checked and only then committed. Representation never writes back.';
