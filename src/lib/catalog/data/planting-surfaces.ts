/** Shared surface selection for planted solids and the terrain foliage uniform. */
export const plantingSurfaces = {
	foliage: { role: 'neu', material: 'wood', token: '--cat-foliage' },
	evergreen: { role: 'neu', material: 'wood', token: '--cat-evergreen' },
	willow: { role: 'neu', material: 'wood', token: '--cat-willow' },
	grass: { role: 'neu', material: 'wood', token: '--cat-grass' },
	stem: { role: 'neu', material: 'wood', token: '--cat-bark' }
} as const;
