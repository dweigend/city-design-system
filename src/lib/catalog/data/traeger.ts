/**
 * Texts for the page Forms · Structures (concept: docs/research/03-form-language.md).
 * Facts and wording only, no rules. Headings are statements; the deep dive sits one
 * level deeper (expandable under the caption).
 */

/** Families with their own experiment on the page. The control family `orthogonal` lives only in the core. */
export type TraegerFamilieText = 'faltwerk' | 'kuppel' | 'wabe' | 'raumfachwerk' | 'gitterschale';

export type FamilienText = {
	id: TraegerFamilieText;
	/** Short name for the image strip and focus. */
	name: string;
	titel: string;
	lead: string;
	/** One sentence per loop step, in the same order as the family's loop in logic/traeger. */
	schritte: { name: string; satz: string }[];
	/** Deep dive: derivation in two to three sentences; may contain a formula. */
	vertiefung: string;
	/** Precedents as a principle, never as a building. */
	vorbilder: string;
};

export const tragwerkeSeite = {
	titel: 'Forms',
	teilseiten: [
		{ pfad: '/formen', name: 'Structures' },
		{ pfad: '/formen/haus', name: 'Building' }
	]
} as const;

export const ensemble = {
	id: 'tragwerke',
	titel: 'Five structures build on the same city',
	lead: 'Folds, triangles, honeycombs, struts and nets: each construction type answers the same existing stock in its own way. Pick one, and the others step back.',
	alle: 'All',
	/** Caption per selection; key 'alle' or a family ID. */
	unterschrift: {
		alle: 'What was already there stands in gray. The folded plate adds a story, the dome shelters a garden, the honeycomb fills a gap, the space frame spans two buildings, the gridshell covers a courtyard.',
		faltwerk:
			'The folded plate sits on the old building as a new roof. A single folded strip is wall and ceiling at once.',
		kuppel:
			'The dome spans the square without a column. Food grows under the glass, even in winter.',
		wabe: 'The honeycomb grows upward in the infill gap. The shaft in the middle stays free for stairs and pipes.',
		raumfachwerk:
			'The space frame stands on four points between the buildings and carries new rooms above the old roofs.',
		gitterschale: 'The gridshell covers the courtyard like a cloth. The net found its own form.'
	} as Record<'alle' | TraegerFamilieText, string>,
	ansichten: [
		{ id: 'geruest', name: 'Frame' },
		{ id: 'huelle', name: 'Envelope' },
		{ id: 'belegt', name: 'Occupied' }
	]
} as const;

export const familienTexte: FamilienText[] = [
	{
		id: 'faltwerk',
		name: 'Folded plate',
		titel: 'Folding makes the surface stiff',
		lead: 'A flat sheet buckles under its own weight. Folded, the same surface carries a roof. Every panel stays rigid; only the fold lines move.',
		schritte: [
			{ name: 'Sheet', satz: 'A sheet of identical parallelograms, still completely flat.' },
			{
				name: 'Fold',
				satz: 'Mountain and valley folds alternate. The strip draws together.'
			},
			{ name: 'Strip', satz: 'One motion folds every panel at once. None of them bends.' },
			{ name: 'Building', satz: 'The strip becomes wall and roof. A floor closes the room.' }
		],
		vertiefung:
			'The Miura fold needs only one angle: as the fold angle θ grows, the length of the strip shrinks while every panel keeps its edges a and b. The height of a fold is H = a · sin θ · sin α.',
		vorbilder: 'Koryo Miura, Josef Albers’ folding exercises at the Bauhaus'
	},
	{
		id: 'kuppel',
		name: 'Dome',
		titel: 'Short struts span the largest space',
		lead: 'An icosahedron has twenty triangles. Split every edge and lift the points onto a sphere, and you get a dome of only a few strut lengths that spans a whole square without support.',
		schritte: [
			{ name: 'Icosahedron', satz: 'Twenty identical triangles, the starting solid.' },
			{ name: 'Subdivide', satz: 'Every edge is split; every triangle breaks into smaller ones.' },
			{
				name: 'Sphere',
				satz: 'All points move onto the sphere. The struts become almost equal in length.'
			},
			{ name: 'Base', satz: 'A ring cuts the sphere off flat. The dome stands.' }
		],
		vertiefung:
			'A full sphere of frequency three needs only three strut lengths; the flat cut at the ground adds a few short edge struts. Its counterpart is the honeycomb skin: hexagons and exactly twelve pentagons close the full sphere.',
		vorbilder: 'Buckminster Fuller, Goldberg-Polyeder, Paolo Soleri'
	},
	{
		id: 'wabe',
		name: 'Honeycomb',
		titel: 'In the honeycomb, every wall divides two rooms',
		lead: 'Hexagons fill the plane without gaps and with the shortest wall. Stacked, they become prisms that crowd around an open shaft.',
		schritte: [
			{ name: 'Cell', satz: 'A hexagonal prism, one room.' },
			{
				name: 'Ring',
				satz: 'Six neighbors attach. Each shared wall exists only once.'
			},
			{ name: 'Layers', satz: 'The cells grow upward. The middle stays a shaft.' },
			{
				name: 'Terraces',
				satz: 'On the outside, the layers end sooner. Every roof becomes a garden.'
			}
		],
		vertiefung:
			'A hexagon with edge length s has the area 3√3/2 · s². At s = 3.5 m, that is about 32 m² per cell. The shaft is a reserved place in the same grid, not a hole in the model.',
		vorbilder: 'Metabolism, Frei Otto’s cellular foam studies, Habitat 67'
	},
	{
		id: 'raumfachwerk',
		name: 'Space frame',
		titel: 'One strut and one node build every frame',
		lead: 'Tetrahedra and octahedra fill space when all struts are the same length. A single node joins twelve of them. From this grows a frame that reaches over the existing stock and takes in rooms.',
		schritte: [
			{ name: 'Tetrahedron', satz: 'Four triangles, the stiffest cell of six struts.' },
			{
				name: 'Octahedron',
				satz: 'Between the tetrahedra an octahedron remains. Both fit without gaps.'
			},
			{ name: 'Layer', satz: 'One layer is exactly one floor high.' },
			{ name: 'Occupancy', satz: 'New rooms hang in the frame above the existing stock.' }
		],
		vertiefung:
			'With strut length a, one layer is a · √(2/3) high. With a = 4.29 m, that is 3.5 m, one floor. Inside, twelve struts meet at every node.',
		vorbilder:
			'Konrad Wachsmann, Yona Friedman, Alexander Graham Bell, Buckminster Fuller, Cedric Price'
	},
	{
		id: 'gitterschale',
		name: 'Gridshell',
		titel: 'The net finds its own form',
		lead: 'A net held at its edges sags under its own weight. Turn the hanging form upside down, and every mesh is in compression: that is the shell that needs the least material.',
		schritte: [
			{ name: 'Net', satz: 'An even net, anchored at its edges.' },
			{ name: 'Hang', satz: 'The net sags until all forces are in equilibrium.' },
			{ name: 'Invert', satz: 'Turned over, tension becomes compression. The form stays.' },
			{ name: 'Roof', satz: 'A membrane covers the shell. Beneath it lies an open courtyard.' }
		],
		vertiefung:
			'The form follows from the force density: every strut has a fixed ratio of force to length, and the edge points stay put. This yields the equilibrium position in a single computation step.',
		vorbilder: 'Frei Otto, Heinz Isler, Antoni Gaudí'
	}
];
