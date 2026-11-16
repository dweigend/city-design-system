/** Readable feedback for building actions; error codes stay in the domain contract. */
export const hausFehlerText = {
	abhaengig:
		'A room or garden sits on top of this room. It stays until whatever is above it is removed.',
	'anschluss-unpassend': 'This room does not fit the connection.',
	kollision: 'Here the room overlaps the structure or another installed element.',
	'zugang-fehlt': 'This room has no clear access from the elevated walkway.'
};

/** Three steps of the structural simulation: from the full grid to the form. */
export const statikStufen = [
	{
		value: 'block',
		label: 'Full candidate grid',
		text: 'It starts with the full grid spanning the gap. Every strut is only a candidate.'
	},
	{
		value: 'kraefte',
		label: 'Sizing',
		text: 'The load hangs in the gap, and the calculation distributes it. Every strut is as thick as its force requires.'
	},
	{
		value: 'abtrag',
		label: 'Pruning',
		text: 'Whatever carries little is removed, as long as the structure stands and gets no heavier. What remains is the path of the force.'
	}
] as const;

/** Reading key for the drawing: sign and magnitude of the force without color. */
export const statikLegende =
	'Stroke width is the calculated diameter. Whether a strut pushes or pulls is shown by the “Forces” analysis: compression hollow and violet, tension solid and teal.';
