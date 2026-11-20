import { ring } from '../parts';

export const cabinPaint = {
	material: 'metal',
	finish: 'metall-lackiert',
	token: '--paper'
} as const;
export const cabinInk = {
	material: 'metal',
	finish: 'metall-graphit',
	token: '--ink'
} as const;
export const cabinGlass = {
	material: 'acrylic',
	finish: 'acryl-matt',
	token: '--blueprint'
} as const;

/** A 0.18 m graphite reveal holds the pane 0.14 m behind the outward-facing lip. */
export function cabinPort(
	front: number,
	height: number,
	edge: string,
	pane: string,
	direction = 1
) {
	return [
		ring([front - direction * 0.09, 0, height], 0.66, 0.52, 0.18, edge),
		ring([front - direction * 0.155, 0, height], 0.525, 0, 0.03, pane)
	];
}
