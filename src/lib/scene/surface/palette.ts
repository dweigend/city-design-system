import {
	castShade,
	readFamily,
	pencilStroke,
	type CladObject,
	type Family,
	type FamilySlot
} from '../material';
import { resolveSurfaces, type Drawable, type Surface, type SurfaceAssignment } from './surfaces';

/** The two surface displays: authored material colours, or the grey see-through bodies of the
 * transparency mode (COLOR-8). */
export type MaterialDisplay = 'normal' | 'transparency';

type Row = Readonly<Partial<Record<FamilySlot, Surface>>>;
const matte = (color: `--${string}`): Surface => ({ color, finish: 'matte' });
const glass = (color: `--${string}`): Surface => ({ color, finish: 'glass' });

/** Material colours by family and slot: few, low-chroma, warm-cool coordinated tones that keep
 * the five flow hues free for function (COLOR-1, COLOR-2). The darkest value is the glazing
 * frame, the structure line of MAT-4. Light and dark values live in the CSS tokens. */
const normal = {
	render: { unit: matte('--mat-render'), joint: matte('--mat-render-joint') },
	masonry: {
		unit: matte('--mat-masonry'),
		'unit-alt': matte('--mat-masonry-alt'),
		joint: matte('--mat-mortar')
	},
	timber: {
		unit: matte('--mat-timber'),
		'unit-alt': matte('--mat-timber-alt'),
		trim: matte('--mat-timber-trim'),
		joint: matte('--mat-timber-gap')
	},
	metal: { unit: matte('--mat-metal'), joint: matte('--mat-metal-joint') },
	glass: {
		unit: glass('--mat-glass'),
		'unit-alt': glass('--mat-glass-alt'),
		trim: matte('--mat-frame'),
		joint: matte('--mat-glass-back')
	},
	paving: {
		unit: matte('--mat-paving'),
		'unit-alt': matte('--mat-paving-alt'),
		joint: matte('--mat-paving-joint')
	}
} as const satisfies Record<Family, Row>;

/** Transparency: every family turns to the neutral stock veil, so infrastructure carries colour. */
const stock = (color: `--${string}`): Surface => ({ ...matte(color), preserveColor: true });
const veil: Row = {
	unit: stock('--stock-veil'),
	'unit-alt': stock('--stock-veil'),
	trim: stock('--stock-line'),
	joint: stock('--stock-pencil')
};

const shadeTarget = {
	shade: 'joint',
	'shade-unit': 'unit'
} as const;

function isShade(slot: FamilySlot): slot is keyof typeof shadeTarget {
	return Object.hasOwn(shadeTarget, slot);
}

/** The pencil level: paper fill with graphite hatching and joint lines (COLOR-5). */
const pencil: Surface = Object.freeze({
	...stock('--stock-pencil'),
	stroke: {
		color: '--stock-line' as const,
		width: pencilStroke.width,
		opacity: pencilStroke.opacity,
		hidden: 0
	}
});

/** Reads the surface of a declared slot. Shade slots use the fill of the face they cover.
 * Throws RangeError for an unknown display, family or slot. */
export function readMaterialSurface(
	family: Family,
	slot: FamilySlot,
	display: MaterialDisplay
): Surface {
	if (display !== 'normal' && display !== 'transparency')
		throw new RangeError(`Unknown display "${String(display)}"`);
	if (!readFamily(family).slots.includes(slot))
		throw new RangeError(`No surface for ${family} slot "${slot}"`);
	const target = isShade(slot) ? shadeTarget[slot] : slot;
	const row: Row = display === 'normal' ? normal[family] : veil;
	const surface = Object.hasOwn(row, target) ? row[target] : undefined;
	if (!surface) throw new RangeError(`No surface for ${family} slot "${slot}"`);
	return surface;
}

const noStrokes: readonly number[] = Object.freeze([]);
const shadeFaces = Object.freeze({ top: castShade, lit: castShade, shadow: castShade });

/** Paints compatible cladding groups by family, detail and slot. Plain slots take their
 * surfaces from `plain`. Throws RangeError for a missing surface. */
export function paintClad(
	clad: CladObject,
	display: MaterialDisplay,
	plain: SurfaceAssignment = {}
): Drawable[] {
	const assignment: Record<string, Surface | undefined> = { ...plain };
	const details = new Map<string, Partial<Drawable>>();
	for (const group of clad.groups) {
		for (const [partSlot, familySlot] of group.slots) {
			const surface = readMaterialSurface(group.family, familySlot, display);
			if (group.level === 'pencil') {
				assignment[partSlot] = pencil;
				details.set(partSlot, { hatch: pencilStroke.hatch });
			} else {
				assignment[partSlot] = surface;
				if (isShade(familySlot))
					details.set(partSlot, {
						faces: shadeFaces,
						strokeSegments: noStrokes,
						visible: display === 'normal'
					});
			}
		}
	}
	const drawables = resolveSurfaces(clad.object, assignment).map((drawable): Drawable => ({
		...drawable,
		...details.get(drawable.id)
	}));
	const parts = new Map(clad.object.parts.map(({ id, shape }) => [id, shape]));
	for (const group of clad.groups) {
		if (!group.lines.length) continue;
		const shape = parts.get(`${group.id}/unit`);
		if (!shape) continue;
		drawables.push({
			...pencil,
			id: `${group.id}/lines`,
			shape,
			strokeSegments: group.lines,
			fillVisible: false
		});
	}
	return drawables;
}
