import { MASSSTAB, ZOOM, type Kontext } from '../../data/leitstil';
import { stilFuer } from '../../logic/leitstil';
import type { StructureVariant } from './view-params';

/** Closest bible zoom for the camera's current scale in CSS pixels per meter. */
export function nearestZoom(scale: number) {
	return ZOOM.reduce((best, next) =>
		Math.abs(MASSSTAB[best] - scale) <= Math.abs(MASSSTAB[next] - scale) ? best : next
	);
}

/** Resolves the actual sandbox style. Hairline is the comparison exception to INV-02/03/09. */
export function sandboxStyle(context: Kontext, variant: StructureVariant) {
	const style = stilFuer(context);
	if (variant === 'hairline') {
		const stock = style.rollen.bestand;
		Object.assign(style.rollen.traeger, {
			strichPx: stock.strichPx,
			kontrast: stock.kontrast,
			token: stock.token
		});
	}
	return style;
}
