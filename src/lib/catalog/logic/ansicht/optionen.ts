/**
 * Workbench (page /interface) control options: readable labels for scenes, focus kinds, layers,
 * construction phases and transparency steps. Each option table lives with the view vocabulary
 * it labels.
 */
import type { Schicht } from './tags';
import type { FokusArt } from './fokus';
import type { WerkbankSzene } from './szenen';

export const werkbankSzenen: { value: WerkbankSzene; label: string }[] = [
	{ value: 'geruestturm', label: 'Frame tower' },
	{ value: 'aufstockung', label: 'Rooftop extension' },
	{ value: 'quartier', label: 'District' }
];

export const fokusArten: { value: FokusArt; label: string }[] = [
	{ value: 'alle', label: 'Everything' },
	{ value: 'strom', label: 'Flow' },
	{ value: 'ebene', label: 'Level' },
	{ value: 'schicht', label: 'Layer' }
];

/** Layer switches (93 Layer Control); the ground is always on. */
export const schichtLabels: { value: Schicht; label: string }[] = [
	{ value: 'bestand', label: 'Existing stock' },
	{ value: 'geruest', label: 'Frame' },
	{ value: 'struktur', label: 'Structure' },
	{ value: 'modul', label: 'Modules' },
	{ value: 'netz', label: 'Networks' },
	{ value: 'kopf', label: 'Crowns' },
	{ value: 'gruen', label: 'Green' }
];

/** Construction phases after 134 as a time slider 0–4. */
export const bauphasen = ['Existing stock', 'Frame', 'Core', 'Plug-in modules', 'Crown'];

export const transparenzStufen = ['Context matte', 'Context ghost', 'Background off'];
