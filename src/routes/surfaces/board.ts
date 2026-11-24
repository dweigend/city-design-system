import { specimenSettings as m } from '../../config/surface-specimens';
import { PlaceableObject, type Part } from '../../lib/core/object';
import { axes } from './axes';
import {
	createSamplePlateObject,
	type CladObject,
	type Family,
	type Patch,
	type SurfaceLevel,
	type SurfaceOptions
} from '../../lib/scene/material';
import { groundFamily } from './controls';

/** One sample plate per entry, upright for wall families and flat for ground families, on
 * stands in rows that rise toward the back, centred on the origin. */
// Exact arithmetic: columns centre on the origin; a stand box is unrotated.
export function createSampleBoard(
	entries: readonly Readonly<{ family: Family; level?: SurfaceLevel }>[],
	options: SurfaceOptions = {}
): CladObject {
	const [width, height] = m.plateSizeM;
	const [gapAcross, gapBack] = m.plateGapM;
	const [standFront, standStep, standDepth] = m.plateStandM;
	const columns = Math.min(m.plateColumns, entries.length);
	const plates: CladObject[] = [];
	const stands: Part[] = [];
	for (const [i, { family, level }] of entries.entries()) {
		const column = i % columns;
		const row = Math.floor(i / columns);
		const x = (column - (columns - 1) / 2) * (width + gapAcross) - width / 2;
		const y = row * gapBack;
		const z = standFront + row * standStep;
		const flat = family === groundFamily;
		const patch: Patch = flat
			? {
					origin: [x, y, z + m.plateThicknessM],
					across: axes.east,
					normal: axes.up,
					size: [width, height],
					thickness: m.plateThicknessM,
					budget: m.plateTriangleBudget
				}
			: {
					origin: [x, y, z],
					across: axes.east,
					normal: axes.south,
					size: [width, height],
					thickness: m.plateThicknessM,
					budget: m.plateTriangleBudget
				};
		plates.push(
			createSamplePlateObject(`plate-${i}`, patch, family, {
				...options,
				level: level ?? options.level
			})
		);
		const depth = flat ? height : standDepth;
		stands.push({
			id: `stand-${i}`,
			slot: 'stand',
			shape: {
				kind: 'box',
				center: [x + width / 2, y + depth / 2, z / 2],
				size: [width, depth, z],
				rotation: 0
			}
		});
	}
	const plateParts = plates.flatMap(({ object }) => object.parts);
	return {
		object: PlaceableObject.create({
			id: 'sample-board',
			footprint: { width: 0, depth: 0 },
			anchors: [],
			slots: [...plateParts.map(({ slot }) => slot), ...(stands.length ? ['stand'] : [])],
			parts: [...plateParts, ...stands]
		}),
		groups: plates.flatMap(({ groups }) => groups),
		surfaces: plates.flatMap(({ surfaces }) => surfaces),
		triangles: plates.reduce((total, { triangles }) => total + triangles, 0)
	};
}
