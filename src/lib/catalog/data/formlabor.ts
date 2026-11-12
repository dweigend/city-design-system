/**
 * Form lab (L14): the principles from which the variety of forms arises. Pure data.
 * Logic: logic/parametrik/formlabor/, scene: scene/formlabor.ts.
 */
export const formlaborPrinzipien: string[] = [
	'One primal form instead of many bodies: box, cylinder, cone, dome, sphere and capsule are eight dimensions of the same mesh. Between any two forms there is always a valid third.',
	'Fixed carrier, moving position layer: floors and bays are slots with a fixed number. Rounding, tapering, inflating, twisting and bending deform only the space they sit in.',
	'Vocabulary as a track: each form family occupies a stretch of 0 to 1 as long as its weight. A slot reads what it is from its fixed random number. When the boundaries shift, the form flows with them.',
	'A type is a point, not a program: building block, Memphis, capsule or dome mountain are 27 numbers. The morph is the path between them; no image is cross-faded.',
	'The tower rule orders everything: existing stock carries, the frame sets the bays, colored plug-in modules show the function, stairs and conduits run outside, a crown sits on top.',
	'Color stays a contract: people and paths pink, water blue, energy yellow, food green, material orange, structural frame in Signal, existing stock as a white architectural model. Depth comes from material, skin and pattern.'
];

/** What happens technically when a slider moves. */
export const formlaborKosten: { begriff: string; text: string; formel: string }[] = [
	{
		begriff: 'Position layer, construction phase, explosion',
		text: 'Uniforms only. Nothing is uploaded; geometry stays untouched.',
		formel: '0 bytes per frame'
	},
	{
		begriff: 'Type, stack, layers',
		text: 'The plan rewrites the instance rows. No mesh is built.',
		formel: '28 numbers per part'
	},
	{
		begriff: 'Drawing',
		text: 'Six draw calls per tower: coarse, medium and fine primal form, skins, plus two outlines.',
		formel: 'InstancedBufferGeometry'
	},
	{
		begriff: 'Seed',
		text: 'Hash of seed, slot and channel. The same seed yields the same tower, in any order.',
		formel: 'hash(saat, id, kanal)'
	}
];
