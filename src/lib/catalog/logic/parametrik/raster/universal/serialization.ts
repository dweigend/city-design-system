import type { Structures, UniversalPatch } from './types';
/** Versioned JSON wire format: maps and sets become ordered arrays, no render objects. */
export function encodeState(patch: UniversalPatch, structures: Structures): string {
	return JSON.stringify({
		version: 1,
		patch: { ...patch, origins: [...patch.origins] },
		structures: {
			...structures,
			blockOf: [...structures.blockOf].map(([id, b]) => [id, b.id]),
			alleys: [...structures.alleys],
			squares: [...structures.squares],
			fields: [...structures.fields],
			orientation: [...structures.orientation],
			neighbors: [...structures.neighbors]
		}
	});
}
export function decodeState(json: string): { patch: UniversalPatch; structures: Structures } {
	const data = JSON.parse(json);
	if (data.version !== 1) throw new Error('Unsupported universal raster version');
	const blocks = new Map<string, Structures['blocks'][number]>(
		data.structures.blocks.map((b: Structures['blocks'][number]) => [b.id, b])
	);
	return {
		patch: { ...data.patch, origins: new Map(data.patch.origins) },
		structures: {
			...data.structures,
			blockOf: new Map(
				data.structures.blockOf.map(([id, b]: [string, string]) => [id, blocks.get(b)!])
			),
			alleys: new Set(data.structures.alleys),
			squares: new Set(data.structures.squares),
			fields: new Map(data.structures.fields),
			orientation: new Map(data.structures.orientation),
			neighbors: new Map(data.structures.neighbors)
		}
	};
}
