import { defaults } from '../../../config/structure-projection';
import type { Drawable, Surface } from '../surface';

const utilizationColors = [
	'--height-low',
	'--structure-use-low',
	'--structure-use-mid',
	'--structure-use-high',
	'--height-high'
] as const;

/** The shared warm scale carries 0–100% in five fixed bands, clipping above 100%. */
export function utilizationBand(ratio: number | null) {
	return ratio === null
		? undefined
		: Math.round(Math.min(1, ratio) * (utilizationColors.length - 1));
}

export function memberAppearance(
	heavy: boolean,
	band?: number
): Pick<Drawable, 'stroke'> & Surface {
	const token = band === undefined ? undefined : utilizationColors[band];
	const color = token ?? (heavy ? '--ink' : '--ink-3');
	return {
		color,
		finish: 'matte',
		flat: true,
		stroke: {
			color,
			width: token
				? defaults.analysisStrokePx
				: heavy
					? defaults.primaryStrokePx
					: defaults.secondaryStrokePx,
			opacity: heavy || token ? 1 : defaults.secondaryOpacity
		}
	};
}

/** The force and bearing slots used on the standalone frame. */
export const markerSurfaces = {
	'pinned-support': { color: '--ink-2', finish: 'matte', flat: true },
	'fixed-support': { color: '--ink', finish: 'matte', flat: true },
	load: { color: '--ink-2', finish: 'matte', flat: true },
	reaction: { color: '--blueprint', finish: 'matte', flat: true }
} as const satisfies Record<string, Surface>;
