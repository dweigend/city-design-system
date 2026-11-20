import type { Vec3 } from '../parametrik/types';
import type { plantingSurfaces } from '../../data/planting-surfaces';

type Foliage = Exclude<keyof typeof plantingSurfaces, 'stem'>;
type PlantBase = { id: string; edges: false };
type Positioned = PlantBase & { position: Vec3; radius: number };
export type BankPlant =
	| (Positioned & { kind: 'sphere'; slot: Foliage; squash: number })
	| (Positioned & { kind: 'dome'; slot: Foliage; height: number })
	| (Positioned & { kind: 'cylinder'; slot: 'stem'; height: number })
	| (PlantBase & {
			kind: 'mesh';
			slot: Foliage;
			smooth: true;
			points: Vec3[];
			triangles: number[];
			lines: number[][];
	  });

/** A tussock of arched, keeled leaves, bounded by a disc of radius r in metres. */
export function meadowTuft(id: string, [x, y, z]: Vec3, r: number, phase: number): BankPlant {
	const points: Vec3[] = [],
		triangles: number[] = [];
	for (let i = 0; i < 9; i++) {
		const a = phase + i * 2.39996,
			dx = Math.cos(a),
			dy = Math.sin(a);
		const spread = r * (0.45 + 0.24 * (i % 3)),
			rise = r * (1.42 - 0.26 * (i % 3));
		const leaf = (along: number, width: number, h: number): Vec3 => [
			x + along * dx - width * dy,
			y + along * dy + width * dx,
			z + h
		];
		const n = points.length;
		points.push(
			leaf(0, 0, 0),
			leaf(spread * 0.35, r * 0.09, rise * 0.73),
			leaf(spread * 0.44, 0, rise * 0.66),
			leaf(spread * 0.35, -r * 0.09, rise * 0.73),
			leaf(spread, 0, rise)
		);
		triangles.push(n, n + 1, n + 2, n, n + 2, n + 3, n + 1, n + 4, n + 2, n + 2, n + 4, n + 3);
	}
	return {
		id,
		kind: 'mesh',
		smooth: true,
		slot: 'grass',
		edges: false,
		points,
		triangles,
		lines: []
	};
}

function bole(id: string, position: Vec3, radius: number, height: number): BankPlant {
	return { id, position, radius, height, kind: 'cylinder', edges: false, slot: 'stem' };
}

function leaves(
	id: string,
	position: Vec3,
	radius: number,
	squash: number,
	slot: Foliage
): BankPlant {
	return { id, position, radius, squash, kind: 'sphere', edges: false, slot };
}

// Width, vertical radius and clear stem height are shares of the planting radius.
const habits = {
	broad: {
		width: 0.82,
		depth: 0.66,
		stem: 1.14,
		girth: 0.085,
		offset: 0,
		count: 1,
		slot: 'foliage'
	},
	column: {
		width: 0.52,
		depth: 1.58,
		stem: 0.75,
		girth: 0.085,
		offset: 0,
		count: 1,
		slot: 'evergreen'
	},
	stool: {
		width: 0.48,
		depth: 0.7,
		stem: 0.66,
		girth: 0.055,
		offset: 0.36,
		count: 3,
		slot: 'willow'
	}
} as const;

/** Smooth tree forms inside a common planting radius, with dimensions in metres. */
export function bankCanopy(
	id: string,
	[x, y, z]: Vec3,
	r: number,
	bearing: number,
	species: number
): BankPlant[] {
	const habit = species < 0.32 ? habits.column : species > 0.69 ? habits.stool : habits.broad;
	const parts: BankPlant[] = [];
	for (let i = 0; i < habit.count; i++) {
		const a = bearing + (i * 2 * Math.PI) / 3;
		const cx = x + r * habit.offset * Math.cos(a),
			cy = y + r * habit.offset * Math.sin(a);
		const width = r * habit.width,
			depth = r * (habit.depth + 0.13 * i),
			height = r * habit.stem;
		parts.push(
			bole(id + '/stem/' + i, [cx, cy, z - 0.13], r * habit.girth, height + 0.13),
			leaves(
				id + '/crown/' + i,
				[cx, cy, z + height + depth * 0.7],
				width,
				depth / width,
				habit.slot
			)
		);
	}
	if (habit === habits.broad) {
		parts.push(
			leaves(
				id + '/bough',
				[x + r * 0.44 * Math.cos(bearing), y + r * 0.44 * Math.sin(bearing), z + r * 1.45],
				r * 0.54,
				0.79,
				'foliage'
			)
		);
	}
	return parts;
}
