import { defaults } from '../../../config/object';
import type { Vec3 } from '../geometry';
import { PlaceableObject, type Shape } from './object';

const {
	houseEavesM,
	houseRidgeM,
	housePlinthHeightM,
	houseRoofHalfDepthM,
	houseRoofHalfWidthM,
	houseFacadeInsetM,
	houseFootprintWidthM,
	houseFootprintDepthM,
	houseBodyWidthM,
	houseBodyDepthM,
	houseDoorWidthM,
	houseDoorHeightM,
	houseWindowOffsetM,
	houseWindowSillM,
	houseWindowWidthM,
	houseWindowHeightM
} = defaults;

const facadeM = -houseBodyDepthM / 2;

function box(center: Vec3, size: Vec3): Shape {
	return { kind: 'box', center, size, rotation: 0 };
}

function roof(): Shape {
	const profile = [
		[-houseRoofHalfDepthM, houseEavesM],
		[houseRoofHalfDepthM, houseEavesM],
		[0, houseRidgeM]
	];
	return {
		kind: 'mesh',
		positions: [-houseRoofHalfWidthM, houseRoofHalfWidthM].flatMap((x) =>
			profile.flatMap(([y, z]) => [x, y, z])
		),
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
	const y = facadeM - houseFacadeInsetM;
	return {
		kind: 'mesh',
		positions: [left, y, bottom, right, y, bottom, right, y, top, left, y, top],
		indices: [0, 1, 2, 0, 2, 3]
	};
}

export function example(): PlaceableObject {
	const footprint = { width: houseFootprintWidthM, depth: houseFootprintDepthM };
	return PlaceableObject.create({
		id: 'house',
		slots: ['plinth', 'wall', 'roof', 'glass', 'door'],
		parts: [
			{
				id: 'plinth',
				slot: 'plinth',
				shape: box(
					[0, 0, housePlinthHeightM / 2],
					[footprint.width, footprint.depth, housePlinthHeightM]
				)
			},
			{
				id: 'body',
				slot: 'wall',
				shape: box(
					[0, 0, (houseEavesM + housePlinthHeightM) / 2],
					[houseBodyWidthM, houseBodyDepthM, houseEavesM - housePlinthHeightM]
				)
			},
			{ id: 'roof', slot: 'roof', shape: roof() },
			{
				id: 'entry-door',
				slot: 'door',
				shape: facade(0, housePlinthHeightM, houseDoorWidthM, houseDoorHeightM)
			},
			{
				id: 'west-window',
				slot: 'glass',
				shape: facade(-houseWindowOffsetM, houseWindowSillM, houseWindowWidthM, houseWindowHeightM)
			},
			{
				id: 'east-window',
				slot: 'glass',
				shape: facade(houseWindowOffsetM, houseWindowSillM, houseWindowWidthM, houseWindowHeightM)
			}
		],
		footprint,
		anchors: [
			{ name: 'entry', position: [0, facadeM, 0], normal: [0, -1, 0] },
			{ name: 'ridge', position: [0, 0, houseRidgeM], normal: [0, 0, 1] }
		]
	});
}
