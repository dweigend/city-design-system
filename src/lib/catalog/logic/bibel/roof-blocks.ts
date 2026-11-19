import type { ManifoldToplevel } from 'manifold-3d';
import { houseChunk, type Stacks } from '../house-brush';
import { cell, grid } from '../parametrik/raster/geometry';
import { toPatch } from '../parametrik/raster/universal';
import type { Point2 } from '../parametrik/vocab';
import { patchGrid } from '../quad-grid';
import type { RulePlate } from './hausregel';

const rings: Point2[][] = [
	[
		[0, 0],
		[23, 2],
		[6, 19]
	],
	[
		[32, 0],
		[54, 3],
		[50, 19],
		[30, 15]
	],
	[
		[0, 31],
		[12, 26],
		[24, 33],
		[17, 48],
		[2, 44]
	],
	[
		[32, 28],
		[57, 28],
		[54, 38],
		[44, 36],
		[41, 48],
		[30, 45]
	]
];

/** Four free blocks share the universal quad subdivision, relaxation and historic roof rule. */
export function roofBlocks(kernel?: ManifoldToplevel): RulePlate[] {
	const seed = 7;
	const carrier = patchGrid(
		toPatch(
			grid(
				'square',
				rings.map((p, i) => cell(p, 'block' + i))
			),
			{ seed }
		)
	);
	const stacks: Stacks = new Map(carrier.cells.map((c) => [c.id, ['living']]));
	const outlines = carrier.cells.map((c) => ({
		id: c.id + ':outline',
		kind: 'polyline' as const,
		role: 'neu' as const,
		token: '--paper' as const,
		material: 'paper' as const,
		points: [...c.corners],
		closed: true
	}));
	return [
		{
			id: 'block-grid',
			title: 'Block subdivision',
			text: 'Shared edge midpoints and relaxed quads. The concave ring is triangulated first.',
			primitives: outlines
		},
		{
			id: 'roof-blocks',
			title: 'Historic roofs',
			text: 'Triangle, quadrilateral, pentagon and concave block. Each roof occupies one relaxed quad.',
			primitives: [...houseChunk(carrier, stacks, 'plate', seed, 'terrace', undefined, kernel)]
		}
	];
}
