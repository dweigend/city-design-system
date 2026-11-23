import type { Parcel } from '../../lib/domain/cell-space';

const ring = (
	id: string,
	points: readonly (readonly [number, number])[],
	frontage: number[]
): Parcel => ({
	id,
	corners: points.map((position, i) => ({ id: `c${i}`, position })),
	frontage,
	baseZ: 0,
	storeyCount: 10
});

/** The five parcel shapes of the chapter, each in meters with its street edge. */
export const parcelShapes = {
	rectangle: {
		label: 'Rectangle 20 × 30 m',
		parcel: ring(
			'rectangle',
			[
				[0, 0],
				[20, 0],
				[20, 30],
				[0, 30]
			],
			[0]
		)
	},
	trapezoid: {
		label: 'Trapezoid',
		parcel: ring(
			'trapezoid',
			[
				[0, 0],
				[28, 0],
				[22, 24],
				[3, 26]
			],
			[0]
		)
	},
	hexagon: {
		label: 'Hexagon cell',
		parcel: ring(
			'hexagon',
			Array.from(
				{ length: 6 },
				(_, i) =>
					[
						15 * Math.cos((i * Math.PI) / 3 - Math.PI / 2 - Math.PI / 6),
						15 * Math.sin((i * Math.PI) / 3 - Math.PI / 2 - Math.PI / 6)
					] as const
			),
			[0, 1]
		)
	},
	triangle: {
		label: 'Triangle',
		parcel: ring(
			'triangle',
			[
				[0, 0],
				[34, 0],
				[14, 30]
			],
			[0]
		)
	},
	ell: {
		label: 'L',
		parcel: ring(
			'ell',
			[
				[0, 0],
				[32, 0],
				[32, 14],
				[14, 14],
				[14, 30],
				[0, 30]
			],
			[0]
		)
	}
} as const;

/** Parcel shape keys in menu order. */
export type ParcelShape = keyof typeof parcelShapes;
