import { finishCatalogue } from '../../material/surface';
import type { Vec3, FinishId } from '../../parametrik/types';
import { mount, type AssetCategory, type AssetRecipe, type Attachment } from '../definition';
import type { ObjectGeometry } from '../object-geometry';
import { surface } from '../parts';
import { suggestions } from '../objects/suggestions';
import { planted } from '../planted';
import { corrugated } from '../corrugated';

// These finishes arrive with the material-engine track. Standalone asset branches use a catalogued fallback.
function availableFinish(id: string, fallback: FinishId): FinishId {
	return finishCatalogue.find((f) => f.id === id)?.id ?? fallback;
}

const finishes = {
	...suggestions,
	foot: { material: 'concrete', finish: 'beton-terrazzo', token: '--paper' },
	punched: {
		material: 'metal',
		finish: availableFinish('perforated-metal', 'metall-gebuerstet'),
		token: '--cat-living'
	},
	chips: {
		material: 'wood',
		finish: availableFinish('pressed-chipboard', 'holz-natur'),
		token: '--cat-living'
	},
	planting: planted.finishes.sedum,
	ribbed: corrugated.finishes.zinc,
	brass: { material: 'metal', finish: 'metall-messing', token: '--cat-mobility' },
	glass: {
		material: 'acrylic',
		finish: availableFinish('clear-acrylic', 'acryl-matt'),
		token: '--cat-health-3'
	}
} as const;
type Slot = keyof typeof finishes;
type Draw = (span: number, variant: number, sample: number) => ObjectGeometry[];

/** Registers separately placeable module spans with fixed reservations and three construction variants. */
export function series(
	category: AssetCategory,
	attachment: Attachment,
	spans: readonly number[],
	variants: readonly string[]
) {
	return (id: string, slots: Slot[], depth: (span: number) => number, draw: Draw): AssetRecipe[] =>
		spans.map((span) => ({
			id: id + '-' + String(span).replace('.', 'p') + 'm',
			category,
			slotNames: slots,
			variants,
			footprint: [span, depth(span)],
			anchors: [mount(attachment)],
			suggestions: finishes,
			draw: (v, s) => draw(span, v, s)
		}));
}

/** A soft component with hemispherical ends at the given centre-line points. */
export function pillow(from: Vec3, to: Vec3, radius: number, slot: Slot): ObjectGeometry {
	return { ...surface(slot), kind: 'capsule', from, to, radius };
}
