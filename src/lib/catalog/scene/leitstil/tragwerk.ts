import { strichbreite, type Stab, type Stil } from '../../logic/leitstil';

/** Stroke layers from outside in; widths at a 1000 px reference width.
 * Only the analysis marks compression with a legible paper core.
 */
export function stabStriche(stab: Stab, stil: Stil, skala: number) {
	const analyse = stil.traegerRolle === 'analyse';
	const breite = Math.max(
		strichbreite(stab.durchmesser, stil.kamera.pxProM),
		analyse && stab.art === 'druck' ? 2.5 / skala : 0
	);
	const lagen: { ton: 'paper' | 'ink' | 'analyse'; breite: number; veraltet?: boolean }[] = [];
	if (stil.thema === 'dunkel') lagen.push({ ton: 'paper', breite: breite + 2 / skala });
	lagen.push({ ton: 'ink', breite });
	if (analyse) {
		lagen.push({
			ton: 'analyse',
			breite: Math.max(1.1, breite - 0.65),
			veraltet: stil.analyseVeraltet
		});
		if (stab.art === 'druck')
			lagen.push({ ton: 'paper', breite: Math.max(1 / skala, breite - 1.2 / skala) });
	}
	return lagen;
}
