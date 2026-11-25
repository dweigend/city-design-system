import {
	readFamily,
	readLevelDetail,
	type CladObject,
	type Family,
	type FamilySlot,
	modelTones,
	type ModelTone
} from '../../domain/material';
import { modelGrain, pencilStroke } from '../material';
import type { PlaceableObject } from '../../core/object';
import { resolveSurfaces, type Drawable, type Surface, type SurfaceAssignment } from './surfaces';

/** The two surface displays: authored material colours, or the grey see-through bodies of the
 * transparency mode (COLOR-8). */
export type MaterialDisplay = 'normal' | 'transparency';

/** A model material: a family and, for a tinted family, its tone. */
export type ModelMaterial = Readonly<{ family: Family; tone?: ModelTone }>;

type Row = Readonly<Partial<Record<FamilySlot, Surface>>>;
const matte = (color: `--${string}`, grain?: Surface['grain']): Surface =>
	grain ? { color, finish: 'matte', grain } : { color, finish: 'matte' };
const token = (tone: ModelTone) => `--model-${tone}` as const;

/** Families whose face takes the material's tone, and the tone they take by default. */
const tintedDefault: Readonly<Partial<Record<Family, ModelTone>>> = {
	board: 'white',
	perforated: 'orange'
};

/** Model colours by family and slot (MAT-11): one even tone per face, black and white laminate,
 * dark perforations, milky acrylic over flat glowing dots, grain only on cork and card. */
function normalRow(family: Family, tone: ModelTone | undefined): Row {
	const tint = token(tone ?? tintedDefault[family] ?? 'white');
	switch (family) {
		case 'board':
			return { face: matte(tint) };
		case 'card':
			return { face: matte('--model-grey', modelGrain.card) };
		case 'cork':
			return { face: matte('--model-cork', modelGrain.cork) };
		case 'stripe':
			return { face: matte('--model-white'), mark: matte('--model-ink') };
		case 'perforated':
			return { face: matte(tint), mark: matte('--model-hole') };
		case 'acrylic':
			return {
				face: { ...matte('--model-acrylic'), opacity: '--alpha-acrylic' },
				mark: { ...matte('--model-glow'), flat: true }
			};
		case 'ground':
			return { face: matte('--model-ground', modelGrain.card) };
	}
}

/** Transparency: every family turns to the neutral stock veil, so infrastructure carries colour. */
const stock = (color: `--${string}`): Surface => ({ ...matte(color), preserveColor: true });
const veil: Row = { face: stock('--stock-veil'), mark: stock('--stock-line') };

/** The pencil level: paper fill with graphite hatching and joint lines (COLOR-5). */
const pencil: Surface = Object.freeze({
	...stock('--stock-pencil'),
	stroke: {
		color: '--stock-line' as const,
		width: pencilStroke.width,
		opacity: pencilStroke.opacity,
		hidden: /* Exact arithmetic: zero suppresses hidden strokes. */ 0
	}
});

function readTone(family: Family, tone: ModelTone | undefined) {
	if (tone !== undefined && !modelTones.includes(tone))
		throw new RangeError(`Unknown model tone "${String(tone)}"`);
	return Object.hasOwn(tintedDefault, family) ? tone : undefined;
}

/** Reads the surface of a declared slot of a family; `tone` tints the face of a tinted family
 * (board, perforated) and is ignored by the others. Throws RangeError for an unknown display,
 * family, slot or tone. */
export function readMaterialSurface(
	family: Family,
	slot: FamilySlot,
	display: MaterialDisplay,
	tone?: ModelTone
): Surface {
	if (display !== 'normal' && display !== 'transparency')
		throw new RangeError(`Unknown display "${String(display)}"`);
	if (!readFamily(family).slots.includes(slot))
		throw new RangeError(`No surface for ${family} slot "${slot}"`);
	const tint = readTone(family, tone);
	const row = display === 'normal' ? normalRow(family, tint) : veil;
	const surface = Object.hasOwn(row, slot) ? row[slot] : undefined;
	if (!surface) throw new RangeError(`No surface for ${family} slot "${slot}"`);
	return surface;
}

/** The surface of a plain body in a model material: the family's face in its tone, as a flat
 * matte tone on any form, with its grain only when `grain` is set (MAT-7). */
export function readModelSurface(
	material: ModelMaterial,
	display: MaterialDisplay,
	grain = true
): Surface {
	const { grain: own, ...surface } = readMaterialSurface(
		material.family,
		'face',
		display,
		material.tone
	);
	return grain && own ? { ...surface, grain: own } : surface;
}

const noStrokes: readonly number[] = Object.freeze([]);

function cladSurface(family: Family, slot: FamilySlot, display: MaterialDisplay, tone?: ModelTone) {
	// Recipes can print marks on a family whose default face is plain.
	if (slot === 'mark' && !readFamily(family).slots.includes(slot))
		return display === 'transparency' ? stock('--stock-line') : matte('--model-ink');
	return readMaterialSurface(family, slot, display, tone);
}

/** Paints compatible cladding groups by family, tone, level and slot. Printed marks draw no
 * outline; grain shows only at levels that draw it. Plain slots take their surfaces from `plain`.
 * Throws RangeError for a missing surface. */
export function paintClad(
	clad: CladObject,
	display: MaterialDisplay,
	plain: SurfaceAssignment = {}
): Drawable[] {
	const assignment: Record<string, Surface | undefined> = { ...plain };
	const details = new Map<string, Partial<Drawable>>();
	for (const group of clad.groups) {
		const { grain } = readLevelDetail(group.level);
		for (const [partSlot, familySlot] of group.slots) {
			if (group.level === 'pencil') {
				assignment[partSlot] = pencil;
				details.set(partSlot, { hatch: pencilStroke.hatch });
				continue;
			}
			const { grain: own, ...surface } = cladSurface(
				group.family,
				familySlot,
				display,
				group.tone as ModelTone | undefined
			);
			assignment[partSlot] = grain && own ? { ...surface, grain: own } : surface;
			if (familySlot === 'mark') details.set(partSlot, { strokeSegments: noStrokes });
		}
	}
	const drawables = resolveSurfaces(clad.object, assignment).map((drawable): Drawable => ({
		...drawable,
		...details.get(drawable.id)
	}));
	const parts = new Map(clad.object.parts.map(({ id, shape }) => [id, shape]));
	for (const group of clad.groups) {
		if (!group.lines.length) continue;
		const shape = parts.get(`${group.id}/face`);
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

/** Paints the grove's three role slots as quiet matte model materials. */
export function projectGrove(object: PlaceableObject): Drawable[] {
	return resolveSurfaces(object, {
		lawn: { ...matte('--model-lawn'), flat: true },
		trunk: matte('--model-cork'),
		canopy: matte('--model-canopy')
	}).map((part) => (part.id === 'lawn' ? { ...part, strokeSegments: [] } : part));
}

export { modelTones, type ModelTone };
