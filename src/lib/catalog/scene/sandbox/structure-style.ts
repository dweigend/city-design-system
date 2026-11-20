import { grammatik } from '../leitstil';
import { nearestZoom, sandboxStyle } from './drafting-style';
import type { Structures } from './structures';
import { defaultMinimumInk, type MinimumInk } from './view-params';

/** Resolves structural strokes from CSS pixels per metre and the active drawing palette. */
export function applyStructureStyle(
	structures: Structures,
	host: HTMLElement,
	scale: number,
	elevation: number,
	refreshTones: boolean,
	minimum: MinimumInk = defaultMinimumInk
) {
	const thema = document.documentElement.dataset.theme === 'dark' ? 'dunkel' : 'hell';
	const style = sandboxStyle({
		zoom: nearestZoom(scale),
		modus: 'ansehen',
		situation: 'normal',
		thema
	});
	structures.setStyle(
		[style, minimum, scale, refreshTones ? grammatik(host, style) : undefined],
		elevation
	);
	return style;
}
