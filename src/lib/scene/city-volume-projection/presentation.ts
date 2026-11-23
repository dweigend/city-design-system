import { levelHeight } from '../../domain/city-volume';
import type { Presentation } from '../stage';
import { heightRamp, type Drawable } from '../surface';
import { cityElevation, cityProfile } from './profile';

type Options = Readonly<{
	terrain: readonly Drawable[];
	envelope: readonly (Drawable & { levels: number })[];
	members: readonly Drawable[];
	peak: number;
	relief: number;
	open: boolean;
	heat: boolean;
	trueScale: boolean;
	maxProfileScale: number;
}>;

/** Styles the existing envelope and member layers at the viewport scale. */
export function cityPresentation({
	terrain,
	envelope,
	members,
	peak,
	relief,
	open,
	heat,
	trueScale,
	maxProfileScale
}: Options): Presentation {
	return ({ width, metersPerPixel }) => {
		const elevation = cityElevation(relief, width);
		const detail = cityProfile(width, metersPerPixel, peak, elevation, trueScale, maxProfileScale);
		const vertical = { pivot: 0, scale: detail.factor };
		return [
			...terrain.map((part) => ({ ...part, vertical, heightScale: detail.factor })),
			...envelope.map((part) => ({
				...part,
				...(heat ? heightRamp(part.levels * levelHeight) : {}),
				fillAlpha: open && !heat ? 0.035 + 0.965 * detail.envelope : 1,
				vertical,
				stroke: part.stroke && {
					...part.stroke,
					...(heat ? { color: '--height-line' as const } : {}),
					opacity: open ? 0.15 + 0.5 * detail.envelope : 0.62
				}
			})),
			...members.map((part) => {
				const fade =
					part.id === 'lattice'
						? detail.rims
						: part.id === 'uprights'
							? detail.uprights
							: detail.detail;
				return {
					...part,
					vertical,
					fillAlpha: detail.detail,
					stroke: part.stroke && {
						...part.stroke,
						opacity: (part.id === 'detail' ? 0.35 : 0.78) * fade,
						width: 0.55 + 0.55 * fade
					}
				};
			})
		];
	};
}
