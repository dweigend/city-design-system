import { buildAsset } from '../../world/asset-registry';
import { createSupportedFrame } from '../../domain/structure';
import { createCellSpace, parcelEdgeId } from '../../domain/cell-space';
import { createHouseCourt, createHouseObject } from '../../domain/house-court';
import { readHouseDetail, projectHouse } from './index';

// A hexagonal corner plot drawn in pencil, as stock beside a focused subject.
export function example() {
	const corners = Array.from({ length: 6 }, (_, i) => {
		const angle = (i * Math.PI) / 3;
		return { id: `h${i}`, position: [12 * Math.cos(angle), 12 * Math.sin(angle)] as const };
	});
	const space = createCellSpace({
		id: 'hex-plot',
		corners,
		frontage: [parcelEdgeId('h4', 'h5')],
		baseZ: 0,
		storeyCount: 6
	});
	const house = createHouseCourt(space, { height: 10.5, width: 12, complexity: 0.4, seed: 11 });
	return projectHouse(createHouseObject(space, house, readHouseDetail('pencil')), 'pencil');
}

/** Projects a supported frame and its registered room through the house surface path. */
export function frameRoomExample() {
	const frame = createSupportedFrame({
		id: 'frame-room',
		start: [0, 0],
		end: [8, 0],
		widthM: 4,
		deckZ: 5,
		groundAt: () => 0
	});
	if (frame.status === 'rejected') throw new Error(frame.reason);
	const [{ socket }] = frame.sockets;
	const room = buildAsset('plug-in/room', { kind: 'frame', id: socket.id, frame }, {}, 1);
	return { frame: frame.object, room };
}
