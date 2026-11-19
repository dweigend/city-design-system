/**
 * Copy for the Forms simulation "Tower on the cell" and its explainer loops.
 * Building zones (public plinth, crown, open space) came from data/icons.ts.
 */

type Zone = 'sockel' | 'stapel' | 'kopf';
type Phase = 'zelle' | Zone | 'weg';

export const turmTitel = 'Tower on the cell';

export const zonenText: Record<Zone, { label: string; satz: string }> = {
	sockel: {
		label: 'Plinth',
		satz: 'The plinth carries the load below. It is public and often existing stock: an old building, a block mass or an arch.'
	},
	stapel: {
		label: 'Stack',
		satz: 'The stack holds the program and carries the color of its function.'
	},
	kopf: {
		label: 'Crown',
		satz: 'The crown completes the tower: a dome, a garden or a solar field. Function chooses it, never chance.'
	}
};

export const phasenText: Record<Phase, { label: string; satz: string }> = {
	zelle: { label: 'Cell', satz: 'The cell sets the footprint and the orientation.' },
	sockel: { label: 'Plinth', satz: 'The plinth covers the whole cell. Existing stock stays gray.' },
	stapel: {
		label: 'Stack',
		satz: 'The stack steps back and carries the color of its function.'
	},
	kopf: {
		label: 'Crown',
		satz: 'The crown completes the tower. When the function changes, it changes too.'
	},
	weg: {
		label: 'Path',
		satz: 'The stair runs outside in the open space and climbs to just below the crown.'
	}
};

export const kopfTraegtNicht =
	'A crown needs at least two floors below it. Here it cannot stand yet.';

/* ── Loop 2 ── */

export const eckLoop = {
	titel: 'The corners choose the module',
	lead: 'Every quad has eight corners, four below and four above, and each one is a build cell. Which of them are occupied decides which module grows into the quad, a principle after Oskar Stålberg. Tap the corners yourself.',
	schritte: 'Corners',
	namen: {
		ecke: 'One corner',
		kante: 'Two corners',
		wand: 'Wall',
		innenecke: 'Inside corner',
		voll: 'Full',
		gedreht: 'Rotated',
		schief: 'Warped'
	} as Record<string, string>,
	text: {
		ecke: 'One corner occupied: a corner piece grows into the quad.',
		kante: 'Two corners on one side: the module becomes a wall.',
		wand: 'The same corners above: the wall spans two floors.',
		innenecke: 'Three of four corners: an inside corner.',
		voll: 'All eight corners: a full block with a roof.',
		gedreht: 'Rotated, it is the same module. Shape counts, not orientation.',
		schief: 'Warped, it still fits: the module hugs the corners.'
	} as Record<string, string>,
	eigen: (klasse: string) => `Your corners make: ${klasse}.`
};

/* ── Loop 3 ── */

export const wegLoop = {
	titel: 'One path through every level',
	lead: 'What everyone needs sits below; what needs quiet sits above. A single ramp connects it all, without one door.',
	schritte: 'Levels',
	text: {
		platz: 'The path starts at the square, public and without a door.',
		markt: 'Market on the ground floor: what everyone needs sits at the entrance.',
		werkstatt: 'Above it, the workshop. Repair stays close to the path.',
		wohnen: 'Housing sits higher, quiet and private.',
		lernen: 'Learning needs depth and a link to the elevated walkway.',
		garten: 'The garden at the top. The path ends under open sky; nothing is stacked above it.'
	} as Record<string, string>,
	ebene: {
		platz: 'Square',
		markt: 'Market',
		werkstatt: 'Workshop',
		wohnen: 'Housing',
		lernen: 'Learning',
		garten: 'Garden'
	} as Record<string, string>,
	ausprobieren: 'Show the path in the tower'
};

/* ── Intro ── */

export const einstieg = {
	id: 'formen-turm',
	titel: 'Every building is a stack of a few forms',
	lead: 'The plinth carries below, the program sits above it, the crown completes the top. Swap any part and the tower is still a tower.'
};
