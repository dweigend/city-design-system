import { levelHeight } from '../../domain/city-volume';
import { readDisplayPresentation, type DisplayLevel } from '../focus';
import type { FocusChoice, Subsystem } from './focus';
import { cityFocusPreset } from './focus-policy';

const { readFocusChoice, readFocusLevel } = cityFocusPreset;
import type { Presentation, Viewport } from '../stage';
import { heightRamp, stockSurfaces, type Drawable } from '../surface';
import {
	bodyLooks,
	castShadeShare,
	fadedMemberWidth,
	farStockEdgeShare,
	focusVeilNearLattice,
	memberLooks,
	planTraceShare,
	planTraceWidthShare,
	quietMembers,
	silhouetteOverLattice,
	veilOverLattice,
	type BodyLook,
	type Stroke
} from './constants';
import type { CityDrawable } from './drawable';
import { overlaySubsystems } from './focus';
import { cityElevation, cityProfile } from './profile';

type Options = Readonly<{
	/** Ground, water and the plan overlays. */
	terrain: readonly Drawable[];
	envelope: readonly CityDrawable[];
	members: readonly Drawable[];
	focus:
		FocusChoice | Readonly<{ analysis?: string; readLevel: (part: Subsystem) => DisplayLevel }>;
	peak: number;
	relief: number;
	trueScale: boolean;
	maxProfileScale: number;
	/** Signed share of the taper field, 1 retreat … −1 overhang. */
	taper: number;
}>;

type Profile = ReturnType<typeof cityProfile>;
type Frame = Readonly<{
	detail: Profile;
	vertical: { pivot: number; scale: number };
	amount: number;
}>;

function groundSubsystem(part: Drawable): Subsystem {
	return (
		overlaySubsystems.get(part.id) ??
		(part.flat === true && part.finish !== 'line' ? 'water' : 'terrain')
	);
}

type Drawing = ReturnType<typeof readDisplayPresentation>;
type VisibleDrawing = Extract<Drawing, { visible: true }>;

function bodyDrawing(drawing: Drawing, { drawn }: CityDrawable): Drawing {
	return drawing.treatment === 'ghost' && drawn ? readDisplayPresentation('pencil') : drawing;
}

function bodyLook({ detail, treatment }: VisibleDrawing): BodyLook {
	return bodyLooks[detail === 'full' ? 'full' : treatment];
}

/** The stroke weight of a body's own role at its level: walls on the body and box, roof edges,
 * storey lines and cell joints on their siblings. */
function roleStroke(look: BodyLook, role: CityDrawable['role']): Stroke {
	if (role === 'roof' || role === 'block-roof') return look.roof;
	if (role === 'storeys' || role === 'block-storeys') return look.storeys;
	if (role === 'joints') return look.joints;
	return look.walls;
}

/** Plan overlays keep their registered line in full, thin to a trace when transparent and drop
 * out when hidden. */
function styleGround(part: Drawable, drawing: Drawing, { vertical, detail }: Frame): Drawable {
	const trace = drawing.detail !== 'full' && part.stroke !== undefined;
	return {
		...part,
		visible: drawing.visible,
		vertical,
		heightScale: detail.factor,
		...(trace && part.stroke
			? {
					stroke: {
						...part.stroke,
						opacity: part.stroke.opacity * planTraceShare,
						width: part.stroke.width * planTraceWidthShare
					}
				}
			: {})
	};
}

function styleShade(part: CityDrawable, drawing: VisibleDrawing, open: boolean, frame: Frame) {
	const look = bodyLook(drawing);
	const full = drawing.detail === 'full';
	const boxes = !full && !open;
	return {
		...part,
		visible: part.boxShade === boxes,
		vertical: frame.vertical,
		// Envelope shade fades with the veil it falls from.
		fillAlpha:
			look.shade *
			(part.role === 'contact' ? 1 : castShadeShare) *
			(part.boxShade || !(full && open) ? 1 : frame.detail.envelope),
		warp: part.warp && { ...part.warp, amount: frame.detail.factor - 1 }
	};
}

function styleBody(
	part: CityDrawable,
	drawing: VisibleDrawing,
	open: boolean,
	analysis: string | undefined,
	{ detail, vertical, amount }: Frame
): CityDrawable {
	const look = bodyLook(drawing);
	const full = drawing.detail === 'full';
	// Stock out of focus is drawn as plain boxes, unless a visible lattice needs its envelope.
	const boxes = !full && !open;
	const block = part.role.startsWith('block');
	if (block !== boxes) return { ...part, visible: false };
	const ramp = full && analysis === 'height';
	const veiled = full && open;
	const weight = roleStroke(look, part.role);
	// Over a visible lattice only the stepped silhouette and roof edges stay; storeys and joints go.
	const silhouette = open && (part.role === 'body' || part.role === 'roof');
	const opacity = open
		? silhouette
			? Math.max(weight.opacity, silhouetteOverLattice.opacity)
			: 0
		: weight.opacity;
	// Neutral edges thin out where member detail fades, so far stock stays a quiet mass.
	const far = full ? 1 : farStockEdgeShare + (1 - farStockEdgeShare) * detail.rims;
	const neutral = look.surface && stockSurfaces[look.surface];
	const { line, ...rampSurface } = heightRamp(part.levels * levelHeight);
	return {
		...part,
		...(neutral ? { color: neutral.color } : {}),
		...(ramp ? rampSurface : {}),
		faces: look.faces,
		fillAlpha:
			veiled && !ramp
				? focusVeilNearLattice + (1 - focusVeilNearLattice) * detail.envelope
				: open
					? veilOverLattice
					: look.fill,
		occlude: true,
		hatch: look.hatch,
		vertical,
		warp: part.warp && { ...part.warp, amount },
		stroke: part.stroke && {
			...part.stroke,
			color: ramp ? line : (neutral?.stroke ?? part.stroke.color),
			opacity: opacity * far,
			width: silhouette ? Math.max(weight.width, silhouetteOverLattice.width) : weight.width,
			hidden: look.hidden,
			recede: look.recede
		}
	};
}

function styleMember(part: Drawable, drawing: Drawing, { detail, vertical, amount }: Frame) {
	if (!drawing.visible) return { ...part, visible: false };
	const rank = part.id === 'lattice' ? 'lattice' : part.id === 'uprights' ? 'uprights' : 'detail';
	const fade = rank === 'lattice' ? detail.rims : detail[rank];
	const look = memberLooks[rank];
	const quiet = drawing.detail === 'full' ? 1 : quietMembers;
	return {
		...part,
		vertical,
		fillAlpha: detail.detail * quiet,
		warp: part.warp && { ...part.warp, amount },
		stroke: part.stroke && {
			...part.stroke,
			opacity: look.opacity * fade * quiet,
			width: look.width * (fadedMemberWidth + (1 - fadedMemberWidth) * fade),
			hidden: look.hidden,
			recede: look.recede
		}
	};
}

/** Styles terrain, plan overlays, district bodies and lattice members by the focus choice at the
 * viewport scale. Every level reuses the same geometry, so switching focus rebuilds nothing, and
 * an unchanged viewport returns the same list without allocating. */
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
	const analysis = typeof focus === 'string' ? readFocusChoice(focus).analysis : focus.analysis;
	const readLevel =
		typeof focus === 'string' ? (part: Subsystem) => readFocusLevel(focus, part) : focus.readLevel;
	const latticeDrawing = readDisplayPresentation(readLevel('lattice'));
	const open = members.length > 0 && latticeDrawing.visible;
	const groundDrawings = terrain.map((part) =>
		readDisplayPresentation(readLevel(groundSubsystem(part)))
	);
	const bodyDrawings = envelope.map((part) =>
		bodyDrawing(readDisplayPresentation(readLevel(part.kind)), part)
	);
	let last: { width: number; metersPerPixel: number; drawables: readonly Drawable[] } | undefined;
	return ({ width, metersPerPixel }: Viewport) => {
		if (last?.width === width && last.metersPerPixel === metersPerPixel) return last.drawables;
		const elevation = cityElevation(relief, width);
		const detail = cityProfile(width, metersPerPixel, peak, elevation, trueScale, maxProfileScale);
		const frame: Frame = {
			detail,
			vertical: { pivot: 0, scale: detail.factor },
			amount: taper * detail.taper
		};
		const drawables = [
			...terrain.map((part, index) => styleGround(part, groundDrawings[index], frame)),
			...envelope.map((part, index) => {
				const drawing = bodyDrawings[index];
				if (!drawing.visible) return { ...part, visible: false };
				if (part.role === 'contact' || part.role === 'cast')
					return styleShade(part, drawing, open, frame);
				return styleBody(part, drawing, open, analysis, frame);
			}),
			...members.map((part) => styleMember(part, latticeDrawing, frame))
		];
		last = { width, metersPerPixel, drawables };
		return drawables;
	};
}
