import { materialSettings as m } from '../../../config/material';
import type { Part } from '../../core/object';
import { axes } from './axes';
import type { SurfaceLevel, SurfaceOptions } from './build';
import { createClad, type CladObject, type Cladding } from './clad';
import { readFamily, type Family } from './families';
import type { Patch } from './patch';

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
	const claddings: Cladding[] = [];
	const stands: Part[] = [];
	for (const [i, { family, level }] of entries.entries()) {
		const column = i % columns;
		const row = Math.floor(i / columns);
		const x = (column - (columns - 1) / 2) * (width + gapAcross) - width / 2;
		const y = row * gapBack;
		const z = standFront + row * standStep;
		const flat = readFamily(family).ground;
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
		claddings.push({ role: `plate-${i}`, family, patch, level });
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
	return createClad('sample-board', claddings, options, stands);
}
