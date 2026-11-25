import { encodeKey } from '../../core/ref';
import { readLevelDetail, type SurfaceLevel } from '../../domain/material';
import type { FinishOverride } from '../../domain/sandbox-document';
import { readModelSurface, type Drawable } from '../surface';

function readAddressedPartId(drawableId: string, prefix: string): string | undefined {
	if (!drawableId.startsWith(prefix)) return drawableId;
	try {
		const parsed: unknown = JSON.parse(
			decodeURIComponent(drawableId.slice(prefix.length).split('/')[0])
		);
		return Array.isArray(parsed) && typeof parsed[0] === 'string' ? parsed[0] : undefined;
	} catch {
		return undefined;
	}
}

/** Paints addressed bodies and their existing cladding without changing shapes or strokes. */
export function paintHouseFinishes(
	drawables: readonly Drawable[],
	houseId: string,
	overrides: readonly FinishOverride[],
	level: SurfaceLevel
): readonly Drawable[] {
	if (!overrides.length) return drawables;
	const byKey = new Map(overrides.map((finish) => [finish.ref.key, finish]));
	const prefix = houseId + '/';
	const { grain } = readLevelDetail(level);
	return drawables.map((drawable) => {
		if (drawable.finish === 'line' || drawable.fillVisible === false) return drawable;
		const partId = readAddressedPartId(drawable.id, prefix);
		if (!partId) return drawable;
		const finish = byKey.get(encodeKey([houseId, partId]));
		if (!finish) return drawable;
		const surface = readModelSurface(finish, 'normal', grain);
		return {
			...drawable,
			grain: undefined,
			opacity: undefined,
			flat: undefined,
			fillAlpha: undefined,
			hatch: undefined,
			occlude: undefined,
			...surface
		};
	});
}
