import type { forestChunk } from '../../logic/land-cover';
import type { bankPlanting } from '../../logic/sandbox';
import type { Primitive } from '../../logic/parametrik/types';

/** Shared surface selection for planted solids and the terrain foliage uniform. */
export const plantingSurfaces = {
	foliage: { role: 'neu', material: 'wood', token: '--cat-foliage' },
	stem: { role: 'neu', material: 'wood', token: '--paper' }
} as const;

type PlantedPart = ReturnType<typeof forestChunk>[number] | ReturnType<typeof bankPlanting>[number];

/** Resolves a forest or bank planting slot while retaining its seeded tone and geometry. */
export function plantingSurface(part: PlantedPart): Primitive {
	const { slot, id, ...geometry } = part;
	const { role, material, token } = plantingSurfaces[slot];
	return {
		role,
		material,
		shade: 'shade' in part ? part.shade : undefined,
		id,
		token,
		...geometry
	};
}
