import { defaults } from '../../../config/structure-projection';
import type { Drawable, Surface } from '../surface';

const nominalColors = [
	'--height-low',
	'--structure-use-low',
	'--structure-use-mid',
	'--structure-use-high',
	'--structure-use-limit'
] as const;

const utilizationColors = [
	...nominalColors,
	'--structure-use-overload',
	'--structure-use-overload-high',
	'--structure-use-overload-severe'
] as const;

/** Fixed warm steps through 100%, then three violet overload bands. */
export function utilizationBand(ratio: number | null) {
	if (ratio === null) return undefined;
	if (ratio <= 1) return Math.round(ratio * (nominalColors.length - 1));
	const [high, severe] = defaults.utilizationOverloadRatios;
	return nominalColors.length + Number(ratio >= high) + Number(ratio >= severe);
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
