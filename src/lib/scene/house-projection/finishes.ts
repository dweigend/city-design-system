import { encodeKey } from '../../core/ref';
import { readLevelDetail, type SurfaceLevel } from '../../domain/material';
import type { FinishOverride } from '../../domain/sandbox-document';
import { readModelSurface, type Drawable } from '../surface';

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
		const partId = drawable.id.startsWith(prefix)
			? (
					JSON.parse(decodeURIComponent(drawable.id.slice(prefix.length).split('/')[0])) as [string]
				)[0]
			: drawable.id;
		const finish = byKey.get(encodeKey([houseId, partId]));
		if (!finish || drawable.finish === 'line') return drawable;
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
