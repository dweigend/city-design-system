import { PlaceableObject, type Shape } from './object';

export function example(): PlaceableObject {
	const box: Shape = { kind: 'box', center: [0, 0, 1], size: [4, 3, 2], rotation: 0 };
	const polygon = [
		[-2, -1.5],
		[2, -1.5],
		[0, 1.5]
	] as const;
	const prism: Shape = { kind: 'prism', polygon, base: 2, top: 2.3 };
	const mesh: Shape = {
		kind: 'mesh',
		positions: [-1, -1.5, 1, 1, -1.5, 1, 0.7, -1.5, 1.7, 0, -1.5, 2, -0.7, -1.5, 1.7],
		indices: [0, 1, 2, 0, 2, 3, 0, 3, 4]
	};
	return PlaceableObject.create({
		id: 'house',
		slots: ['wall', 'roof', 'glass'],
		parts: [
			{ id: 'body', slot: 'wall', shape: box },
			{ id: 'roof', slot: 'roof', shape: prism },
			{ id: 'arched-window', slot: 'glass', shape: mesh }
		],
		footprint: { width: 4, depth: 3 },
		anchors: [
			{ name: 'entry', position: [0, -1.5, 0], normal: [0, -1, 0] },
			{ name: 'roof', position: [0, 0, 2.3], normal: [0, 0, 1] }
		]
	});
}
