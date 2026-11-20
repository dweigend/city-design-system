import { ring } from '../parts';

export const cabinPaint = {
	material: 'metal',
	finish: 'metall-lackiert',
	token: '--paper'
} as const;
export const cabinBrass = {
	material: 'metal',
	finish: 'metall-messing',
	token: '--cat-living'
} as const;
export const cabinGlass = { material: 'acrylic', finish: 'acryl-matt', token: '--paper' } as const;

/** A 0.18 m brass reveal holds the pane 0.14 m behind the outward-facing lip. */
export function cabinPort(front: number, height: number, edge: string, pane: string) {
	return [
		ring([front - 0.09, 0, height], 0.55, 0.43, 0.18, edge),
		ring([front - 0.155, 0, height], 0.435, 0, 0.03, pane)
	];
}
