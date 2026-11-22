import type { Vec3 } from '../geometry';
import { PlaceableObject, type Shape } from './object';

const eavesM = 3;
const ridgeM = 4.6;
const facadeM = -2;
const plinthHeightM = 0.24;

function box(center: Vec3, size: Vec3): Shape {
	return { kind: 'box', center, size, rotation: 0 };
}

function roof(): Shape {
	const profile = [
		[-2.24, eavesM],
		[2.24, eavesM],
		[0, ridgeM]
	];
	return {
		kind: 'mesh',
		positions: [-3.24, 3.24].flatMap((x) => profile.flatMap(([y, z]) => [x, y, z])),
		indices: [
			0,
			2,
			1,
			3,
			4,
			5, // Gables
			0,
			3,
			5,
			0,
			5,
			2, // South slope
			2,
			5,
			4,
			2,
			4,
			1, // North slope
			0,
			1,
			4,
			0,
			4,
			3 // Soffit
		]
	};
}

function facade(x: number, bottom: number, width: number, height: number): Shape {
	const left = x - width / 2;
	const right = x + width / 2;
	const top = bottom + height;
	const y = facadeM - 0.005;
	return {
		kind: 'mesh',
		positions: [left, y, bottom, right, y, bottom, right, y, top, left, y, top],
		indices: [0, 1, 2, 0, 2, 3]
	};
}

export function example(): PlaceableObject {
	const footprint = { width: 6.3, depth: 4.3 };
	return PlaceableObject.create({
		id: 'house',
		slots: ['plinth', 'wall', 'roof', 'glass', 'door'],
		parts: [
			{
				id: 'plinth',
				slot: 'plinth',
				shape: box([0, 0, plinthHeightM / 2], [footprint.width, footprint.depth, plinthHeightM])
			},
			{
				id: 'body',
				slot: 'wall',
				shape: box([0, 0, (eavesM + plinthHeightM) / 2], [6, 4, eavesM - plinthHeightM])
			},
			{ id: 'roof', slot: 'roof', shape: roof() },
			{ id: 'entry-door', slot: 'door', shape: facade(0, plinthHeightM, 0.98, 2.12) },
			{ id: 'west-window', slot: 'glass', shape: facade(-1.75, 0.99, 0.94, 1.43) },
			{ id: 'east-window', slot: 'glass', shape: facade(1.75, 0.99, 0.94, 1.43) }
		],
		footprint,
		anchors: [
			{ name: 'entry', position: [0, facadeM, 0], normal: [0, -1, 0] },
			{ name: 'ridge', position: [0, 0, ridgeM], normal: [0, 0, 1] }
		]
	});
}
