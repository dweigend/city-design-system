import type { Vec3 } from '../../core/geometry';
import { createCityLattice } from '../city-volume';
import { createDockedModule, readLatticeFaceSockets } from './index';

export function example() {
	const positions: readonly Vec3[] = [
		[0, 0, 0],
		[8, 0, 0],
		[8, 6, 0],
		[0, 6, 0]
	];
	const lattice = createCityLattice(
		[
			{
				planCellId: 'carrier',
				corners: positions.map((position, index) => ({ id: String(index), position })),
				neighbors: positions.map(() => null),
				levels: 3
			}
		],
		0
	);
	const sockets = readLatticeFaceSockets(lattice);
	const socket = sockets.find(({ normal }) => normal[1] < 0);
	if (!socket) throw new RangeError('Expected a south-facing socket');
	const spec = { id: 'room', widthM: 3, heightM: 2, depthM: 2 };
	return { sockets, placement: createDockedModule(socket, spec) };
}
