import { castShade, familyNames, pencilStroke, type CladObject, type Family, type FamilySlot } from '../material';
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
	masonry: { unit: matte('--mat-masonry'), 'unit-alt': matte('--mat-masonry-alt'), joint: matte('--mat-mortar') },
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
	paving: { unit: matte('--mat-paving'), 'unit-alt': matte('--mat-paving-alt'), joint: matte('--mat-paving-joint') }
} as const satisfies Record<Family, Row>;

/** Transparency: every family turns to the neutral stock veil, so infrastructure carries colour. */
const veil: Row = {
	unit: matte('--stock-veil'),
	'unit-alt': matte('--stock-veil'),
	trim: matte('--stock-line'),
	joint: matte('--stock-pencil')
};
const transparency = Object.fromEntries(familyNames.map((family) => [family, veil])) as Record<Family, Row>;
const palettes = { normal, transparency } as const satisfies Record<MaterialDisplay, Record<Family, Row>>;

/** The pencil level: paper fill with graphite hatching and joint lines (COLOR-5). */
const pencil: Surface = Object.freeze({
	color: '--stock-pencil',
	finish: 'matte',
	stroke: { color: '--stock-line' as const, width: pencilStroke.width, opacity: pencilStroke.opacity, hidden: 0 }
});

/** Reads the surface of one family slot in one display. Throws RangeError when the family has no
 * such slot or the display is unknown. */
export function readMaterialSurface(family: Family, slot: FamilySlot, display: MaterialDisplay): Surface {
	if (!Object.hasOwn(palettes, display)) throw new RangeError(`Unknown display "${display}"`);
	const row: Row | undefined = Object.hasOwn(palettes[display], family) ? palettes[display][family] : undefined;
	const surface = row?.[slot];
	if (!surface) throw new RangeError(`No surface for ${family} slot "${slot}"`);
	return surface;
}

/** Shade keeps the colour of the face it falls on, darkened alike on every face, and draws no
 * outline of its own: an overprint, not an object (MAT-2). */
const noStrokes: readonly number[] = Object.freeze([]);
const shadeTarget: Partial<Record<FamilySlot, FamilySlot>> = { shade: 'joint', 'shade-unit': 'unit' };
const shadeFaces = Object.freeze({ top: castShade, lit: castShade, shadow: castShade });

function split(slot: string): [role: string, slot: FamilySlot] | undefined {
	const at = slot.lastIndexOf('/');
	return at < 0 ? undefined : [slot.slice(0, at), slot.slice(at + 1) as FamilySlot];
}

/** The one assignment boundary for clad objects: colours every `role/slot` by the role's family
 * and drawn level, takes plain slots from `plain`, and adds the pencil joint lines of each role
 * as a stroke-only drawable. Throws RangeError for a slot without a surface. */
export function paintClad(clad: CladObject, display: MaterialDisplay, plain: SurfaceAssignment = {}): Drawable[] {
	const assignment: Record<string, Surface | undefined> = { ...plain };
	const pencilRoles = new Set(Object.keys(clad.levels).filter((role) => clad.levels[role] === 'pencil'));
	for (const slot of clad.object.slots) {
		const parts = split(slot);
		if (!parts) continue;
		const [role, familySlot] = parts;
		const family = clad.materials[role];
		assignment[slot] = pencilRoles.has(role)
			? pencil
			: readMaterialSurface(family, shadeTarget[familySlot] ?? familySlot, display);
	}
	const drawables = resolveSurfaces(clad.object, assignment).map((drawable): Drawable => {
		const [role, familySlot] = split(drawable.id) ?? [];
		if (role !== undefined && pencilRoles.has(role)) return { ...drawable, hatch: pencilStroke.hatch };
		if (familySlot === undefined || !shadeTarget[familySlot]) return drawable;
		return { ...drawable, faces: shadeFaces, strokeSegments: noStrokes, visible: display === 'normal' };
	});
	for (const [role, lines] of Object.entries(clad.lines)) {
		const host = drawables.find(({ id }) => id === `${role}/unit`);
		if (!host || !lines.length) continue;
		drawables.push({ ...pencil, id: `${role}/lines`, shape: host.shape, strokeSegments: lines, fillVisible: false });
	}
	return drawables;
}
