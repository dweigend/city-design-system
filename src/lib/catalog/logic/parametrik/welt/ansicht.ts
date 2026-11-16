/** Views, levels and cycles of L11: labels kept separate from scene and surface. */
import type { Bilanz } from './typen';

export type Ansicht = 'plan' | 'gehen' | 'rundgang';
export type Ebene = 'boden' | 'hochweg';

export const ansichten: { value: Ansicht; label: string; hilfe: string }[] = [
	{
		value: 'plan',
		label: 'Plan',
		hilfe: 'Drag to rotate, scroll to zoom, right-click or two fingers to pan.'
	},
	{
		value: 'gehen',
		label: 'Walk',
		hilfe: 'Drag: look around. Arrow keys or WASD: walk (click into the image first).'
	},
	{
		value: 'rundgang',
		label: 'Walkthrough',
		hilfe:
			'From the ground via flights and elevated walkways back to the ground. Drag: look around.'
	}
];

export const ebenen: { value: Ebene; label: string }[] = [
	{ value: 'boden', label: 'Ground' },
	{ value: 'hochweg', label: 'Elevated walkway' }
];

export const kreislaeufe: { id: keyof Bilanz; name: string; quelle: string }[] = [
	{ id: 'wasser', name: 'Water', quelle: 'Basins, water floors, gardens.' },
	{ id: 'energie', name: 'Energy', quelle: 'Energy floors and frames.' },
	{ id: 'nahrung', name: 'Food', quelle: 'Farm floors, gardens, courtyards.' },
	{ id: 'material', name: 'Material', quelle: 'Market and workshop floors.' }
];
