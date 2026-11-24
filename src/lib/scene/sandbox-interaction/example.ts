import { createBuildQueue, createStrokeState, selectHouseDetail } from './index';

/** Paints across three parcels, queues one build per parcel and picks the detail of the first. */
export function example() {
	const stroke = createStrokeState<{ id: string }>();
	const tool = 'house/court-neutral';
	const effects = [
		...stroke.read({ type: 'down', pointer: 1, hits: [{ id: 'a' }], tool }),
		...stroke.read({ type: 'move', pointer: 1, hits: [{ id: 'a' }, { id: 'b' }], tool }),
		...stroke.read({ type: 'up', pointer: 1, hits: [{ id: 'c' }], tool })
	];
	let clock = 0;
	const queue = createBuildQueue<string>(() => clock, 2);
	for (const id of ['a', 'b', 'c'])
		queue.submit({ id, key: id + '/flat', run: () => ((clock += 1), id.toUpperCase()) });
	const frames = [queue.advance(), queue.advance()];
	const detail = selectHouseDetail({ selected: true, hovered: false });
	return { effects, frames, detail };
}
