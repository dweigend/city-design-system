import { levelHeight } from '../../domain/city-volume';
import { readFocusChoice, readFocusLevel, type DisplayLevel, type FocusChoice } from '../focus';
import type { Presentation } from '../stage';
import { heightRamp, stockSurfaces, type Drawable } from '../surface';
import type { CityDrawable } from './index';
import { cityElevation, cityProfile } from './profile';

type Options = Readonly<{
	terrain: readonly Drawable[];
	envelope: readonly CityDrawable[];
	members: readonly Drawable[];
	focus: FocusChoice;
	peak: number;
	relief: number;
	trueScale: boolean;
	maxProfileScale: number;
	/** Signed share of the taper field, 1 retreat … −1 overhang. */
	taper: number;
}>;

type Look = Readonly<{
	surface?: keyof typeof stockSurfaces;
	fill: number;
	outline: number;
	width: number;
	storeys: number;
	hidden: number;
	hatch: number;
	shade: number;
}>;

/** How a district body reads at each visible level. Neutral looks draw with graphite on a pale
 * veil; `shade` is the strength of the ground shadow. */
export const bodyLooks = {
	full: { fill: 1, outline: 0.62, width: 0.9, storeys: 0.3, hidden: 0, hatch: 0, shade: 1 },
	silhouette: {
		surface: 'veil',
		fill: 1,
		outline: 0.5,
		width: 0.7,
		storeys: 0,
		hidden: 0,
		hatch: 0,
		shade: 0.9
	},
	transparent: {
		surface: 'veil',
		fill: 0.5,
		outline: 0.42,
		width: 0.6,
		storeys: 0,
		hidden: 0.14,
		hatch: 0,
		shade: 0.62
	},
	pencil: {
		surface: 'pencil',
		fill: 0.74,
		outline: 0.8,
		width: 0.85,
		storeys: 0.34,
		hidden: 0.2,
		hatch: 1,
		shade: 0.78
	}
} as const satisfies Record<Exclude<DisplayLevel, 'hidden'>, Look>;

/** Member weights by rank: chords and uprights carry, diagonals and hubs are secondary. Hidden
 * members keep a share of their opacity and the farthest lose `recede` of it. */
export const memberLooks = {
	lattice: { opacity: 1, width: 1.15, hidden: 0.5, recede: 0.4 },
	uprights: { opacity: 0.92, width: 1, hidden: 0.5, recede: 0.4 },
	detail: { opacity: 0.6, width: 0.7, hidden: 0.4, recede: 0.45 }
} as const;

/** A visible lattice raises the envelope outline to this weight: the stepped silhouette is the
 * strongest line of the drawing. */
const silhouetteOverLattice = { opacity: 0.8, width: 1.35 } as const;
/** Fill of an out-of-focus envelope around a visible lattice. Hidden members are drawn after the
 * veil, so a denser veil calms the ground below without hiding the structure. */
const veilOverLattice = 0.8;
/** Share of a visible member's opacity at any level below full. */
const quietMembers = 0.45;

function terrainSubsystem(part: Drawable) {
	return part.flat === true && part.finish !== 'line' ? 'water' : 'terrain';
}

function bodyLevel(focus: FocusChoice, { kind, drawn }: CityDrawable): DisplayLevel {
	const level = readFocusLevel(focus, kind);
	return level === 'transparent' && drawn ? 'pencil' : level;
}

/** Styles terrain, district bodies and lattice members by the focus choice at the viewport
 * scale. Every level reuses the same geometry, so switching focus rebuilds nothing. */
export function cityPresentation({
	terrain,
	envelope,
	members,
	focus,
	peak,
	relief,
	trueScale,
	maxProfileScale,
	taper
}: Options): Presentation {
	const analysis = readFocusChoice(focus).analysis;
	const latticeLevel = readFocusLevel(focus, 'lattice');
	const open = members.length > 0 && latticeLevel !== 'hidden';
	return ({ width, metersPerPixel }) => {
		const elevation = cityElevation(relief, width);
		const detail = cityProfile(width, metersPerPixel, peak, elevation, trueScale, maxProfileScale);
		const vertical = { pivot: 0, scale: detail.factor };
		const amount = taper * detail.taper;
		return [
			...terrain.map((part) => ({
				...part,
				visible: readFocusLevel(focus, terrainSubsystem(part)) !== 'hidden',
				vertical,
				heightScale: detail.factor
			})),
			...envelope.map((part) => {
				const level = bodyLevel(focus, part);
				if (level === 'hidden') return { ...part, visible: false };
				const look: Look = bodyLooks[level];
				// Stock out of focus is drawn as plain boxes, unless a visible lattice needs its envelope.
				const boxes = level !== 'full' && !open;
				if (part.role === 'contact' || part.role === 'cast')
					return {
						...part,
						visible: part.boxShade === boxes,
						vertical,
						fillAlpha: look.shade * (part.role === 'contact' ? 1 : 0.7),
						warp: part.warp && { ...part.warp, amount: detail.factor - 1 }
					};
				const block = part.role === 'block' || part.role === 'block-storeys';
				if (block !== boxes) return { ...part, visible: false };
				const ramp = level === 'full' && analysis === 'height';
				const veiled = level === 'full' && open;
				const outline =
					part.role === 'storeys'
						? look.storeys * Number(!open)
						: part.role === 'block-storeys'
							? look.storeys
							: look.outline;
				// Neutral outlines thin out where member detail fades, so far stock stays a quiet mass.
				const far = level === 'full' ? 1 : 0.45 + 0.55 * detail.rims;
				const neutral = look.surface && stockSurfaces[look.surface];
				const { line, ...rampSurface } = heightRamp(part.levels * levelHeight);
				return {
					...part,
					...(neutral ? { color: neutral.color } : {}),
					...(ramp ? rampSurface : {}),
					fillAlpha:
						veiled && !ramp ? 0.035 + 0.965 * detail.envelope : open ? veilOverLattice : look.fill,
					occlude: true,
					hatch: look.hatch,
					vertical,
					warp: part.warp && { ...part.warp, amount },
					stroke: part.stroke && {
						...part.stroke,
						color: ramp ? line : (neutral?.stroke ?? part.stroke.color),
						opacity: open
							? Math.max(outline, part.role === 'body' ? silhouetteOverLattice.opacity : 0)
							: outline * far,
						width:
							open && part.role === 'body'
								? Math.max(look.width, silhouetteOverLattice.width)
								: look.width,
						hidden: look.hidden,
						recede: 0.3
					}
				};
			}),
			...members.map((part) => {
				if (latticeLevel === 'hidden') return { ...part, visible: false };
				const rank =
					part.id === 'lattice' ? 'lattice' : part.id === 'uprights' ? 'uprights' : 'detail';
				const fade = rank === 'lattice' ? detail.rims : detail[rank];
				const look = memberLooks[rank];
				const quiet = latticeLevel === 'full' ? 1 : quietMembers;
				return {
					...part,
					vertical,
					fillAlpha: detail.detail * quiet,
					warp: part.warp && { ...part.warp, amount },
					stroke: part.stroke && {
						...part.stroke,
						opacity: look.opacity * fade * quiet,
						width: look.width * (0.5 + 0.5 * fade),
						hidden: look.hidden,
						recede: look.recede
					}
				};
			})
		];
	};
}
