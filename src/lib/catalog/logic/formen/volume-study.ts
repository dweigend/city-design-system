import { formFamily } from '../parametrik/formen';
import type { BuildingSurface, Primitive, Vec3 } from '../parametrik/types';
import { required } from '../required';

type Bay = [x: number, y: number, z: number, width: number, depth: number, height: number];
type Slot = BuildingSurface['slot'];

function sample(
	id: string,
	[x, y, z, w, d, height]: Bay,
	params: Record<string, number>,
	slot: Slot
) {
	return required(formFamily(id), id)
		.generate(
			{
				footprint: [
					[x, y],
					[x + w, y],
					[x + w, y + d],
					[x, y + d]
				],
				center: [x + w / 2, y + d / 2],
				orientation: 0,
				z,
				height,
				role: 'neu',
				seed: 7
			},
			params
		)
		.map((part): Primitive => ({
			...part,
			id: `${part.id}/${x}/${z}`,
			token: undefined,
			material: part.glass ? 'greenhouse' : part.material,
			buildingSurface: part.glass ? undefined : { use: 'living', ensemble: 'passage', slot }
		}));
}

function slab(bay: Bay, slot: Slot) {
	return sample('klotz-prisma', bay, { hoehe: 1, einzug: 0, fuge: 0 }, slot);
}

function referenceGrid() {
	const lines: Primitive[] = [];
	const line = (from: Vec3, to: Vec3) =>
		lines.push({
			id: 'grid-' + lines.length,
			role: 'bestand',
			material: 'paper',
			kind: 'polyline',
			points: [from, to]
		});
	for (let x = 0; x <= 18; x += 3) {
		line([x, 0, 0], [x, 6, 0]);
		line([x, 6, 0], [x, 6, 9]);
	}
	for (let z = 0; z <= 9; z += 3) {
		line([0, 6, z], [18, 6, z]);
		line([0, 0, z], [0, 6, z]);
	}
	for (let y = 0; y < 6; y += 3) {
		line([0, y, 0], [18, y, 0]);
		line([0, y, 0], [0, y, 9]);
	}
	return lines;
}

/** Fixed cutaway of a house over an open passage, assembled from the catalog's form vocabulary, in metres. */
export const volumeSection: Primitive[] = [
	...referenceGrid(),
	...sample('bogen-portal', [0, 0, 0, 6, 6, 3], { hoehe: 1, tiefe: 1, wand: 0.14 }, 'shell').filter(
		(p) => p.kind === 'arch'
	),
	...slab([12, 0, 0, 6, 6, 3], 'shell'),
	...slab([0, 0, 3, 18, 6, 0.32], 'fitting'),
	...sample(
		'rahmen-gitterwuerfel',
		[0, 0, 3.32, 6, 6, 3],
		{ felder: 2, belegung: 0, stab: 0.15 },
		'frame'
	),
	...sample('huelle-klimahaut', [6, 0, 3.32, 6, 6, 3], { hoehe: 1, inhalt: 0, abstand: 0 }, 'pane'),
	...slab([12, 0, 3.32, 6, 6, 3], 'shell')
];
