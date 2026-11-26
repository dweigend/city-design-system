import { createSupportedFrame } from '../../lib/domain/structure';
import { projectHouse } from '../../lib/scene/house-projection';
import { buildAsset } from '../../lib/world/asset-registry';
import { box, studyStock } from './study-parts';

export function frameSheet() {
	const frame = createSupportedFrame({
		id: 'stock-span',
		start: [0, 0],
		end: [20, 0],
		stations: [{ id: 'court', offsetM: 10 }],
		widthM: 6,
		deckZ: 8,
		roofs: [
			{
				id: 'roof',
				hostId: 'west',
				outline: [
					[-4, -4],
					[4, -4],
					[4, 4],
					[-4, 4]
				],
				roofZ: 5,
				foundationZ: -1
			},
			{
				id: 'roof',
				hostId: 'east',
				outline: [
					[16, -4],
					[24, -4],
					[24, 4],
					[16, 4]
				],
				roofZ: 6,
				foundationZ: -1
			}
		],
		groundAt: () => 0
	});
	if (frame.status !== 'supported') throw new Error(frame.reason);
	const room = buildAsset(
		'plug-in/room',
		{ kind: 'frame', id: frame.sockets[0].socket.id, frame },
		{},
		3
	);
	const stock = studyStock(
		'roof-hosts',
		[box('west', [0, 0, 2.5], [8, 8, 5]), box('east', [20, 0, 3], [8, 8, 6])],
		{ color: '--model-grey', finish: 'matte' }
	);
	return {
		drawables: [...stock, ...projectHouse(frame.object, 'full'), ...projectHouse(room, 'full')],
		measurements: [
			{ label: 'Roof hosts', value: '2', unit: '' },
			{
				label: 'Terrain bearings',
				value: String(frame.bearings.filter(({ support }) => support.kind === 'pier').length),
				unit: ''
			},
			{ label: 'Plug-in rooms', value: '1', unit: '' }
		]
	};
}
