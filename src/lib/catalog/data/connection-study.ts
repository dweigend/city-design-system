import type { FlowId } from './focus';
import type { Primitive, Vec3 } from '../logic/parametrik/types';

type Connection = {
	id: string;
	title: string;
	flow: FlowId;
	walkingKind?: 'path' | 'bridge';
	/** Network to building threshold or fitting, in world metres with z up. */
	points: Vec3[];
	detail: string;
};

/** One authored section at four elevations. Proof labels refer to capabilities in the shared city. */
export const connections: Connection[] = [
	{
		id: 'ground-path',
		title: 'Ground path',
		flow: 'people',
		walkingKind: 'path',
		points: [
			[-12, -5, 0.1],
			[-8, -5, 0.1],
			[-2, -5, 0.1],
			[2, -5, 0.1],
			[4, -4, 0.1],
			[6, -2, 0.1],
			[6, 1, 0.1]
		],
		detail: 'Lane → passage threshold'
	},
	{
		id: 'bridge-landing',
		title: 'Bridge landing',
		flow: 'people',
		walkingKind: 'bridge',
		points: [
			[-10, -1.5, 5.2],
			[-10, -3, 5.2],
			[-8, -4.5, 5.2],
			[3.5, -4.5, 5.2],
			[5, -3, 5.2],
			[5, 1, 5.2]
		],
		detail: 'Elevated deck → gallery door'
	},
	{
		id: 'water-pipe',
		title: 'Water pipe',
		flow: 'water',
		points: [
			[-13, -7, -1.8],
			[3, -7, -1.8],
			[3, 0.8, -1.8],
			[3, 0.8, 2.4],
			[3, 1, 2.4]
		],
		detail: 'Water main → riser inlet'
	},
	{
		id: 'power-line',
		title: 'Power line',
		flow: 'energy',
		points: [
			[12, -8, -0.7],
			[8, -8, -0.7],
			[8, -1, -0.7],
			[8, 0.8, -0.7],
			[8, 0.8, 3.15],
			[8, 1, 3.15]
		],
		detail: 'Power feeder → service cabinet'
	}
];

function mass(id: string, position: Vec3, size: Vec3, glass = false): Primitive {
	return { id, kind: 'box', role: 'bestand', material: 'paper', position, size, glass };
}

function roof(id: string, position: Vec3, width: number, length: number, rise: number): Primitive {
	return { id, kind: 'vault', role: 'bestand', material: 'paper', position, width, length, rise };
}

/** Identical retained volumes and cut ground in all four connection drawings. */
export const connectionStock = [
	mass('cut-ground', [-13, -9, -2.6], [26, 21, 0.6]),
	mass('back-ground', [-13, 1, -2], [26, 11, 2]),
	mass('foreground-grade', [-13, -9, -0.08], [26, 10, 0.08], true),
	mass('west-house', [-12, -1.5, 0], [6.7, 7.5, 5.2]),
	mass('west-cornice', [-12.2, -1.7, 5.2], [7.1, 7.9, 0.22]),
	roof('west-roof', [-8.65, -1.1, 5.42], 6.3, 6.7, 2.5),
	mass('north-tower', [-6.5, 5.7, 0], [6, 5.4, 12.8]),
	mass('north-tower-cap', [-6.7, 5.5, 12.8], [6.4, 5.8, 0.3]),
	mass('north-wing', [0.1, 7.6, 0], [5.2, 3.5, 7.4]),
	mass('north-wing-cap', [-0.05, 7.45, 7.4], [5.5, 3.8, 0.22]),
	mass('east-plinth', [1.8, 1, 0], [3.1, 6.5, 4]),
	mass('east-return', [7.1, 1, 0], [3.8, 6.5, 4]),
	mass('east-passage-roof', [1.65, 0.85, 4], [9.45, 6.8, 0.38]),
	mass('east-gallery', [2.1, 1, 4.38], [8.25, 6.2, 3.4], true),
	mass('east-gallery-roof', [1.85, 0.85, 7.78], [8.75, 6.65, 0.26]),
	mass('east-setback', [3.3, 2.25, 8.04], [6, 4.4, 2.4]),
	mass('east-cap', [3.15, 2.1, 10.44], [6.3, 4.7, 0.2]),
	mass('southwest-stock', [-11.5, -7, 0], [4.3, 1.4, 2.5], true)
];
