import { expect, test } from 'bun:test';
import type { Parcel } from '../../lib/domain/parcels';
import type { GroundPointer } from '../../lib/scene/stage-view';
import { createStrokePointer } from './stroke';

const parcel = (id: string): Parcel => ({
	id,
	blockId: 'block',
	splitPath: [],
	plannedKind: 'block',
	publicUse: false,
	outline: [
		[0, 0],
		[1, 0],
		[0, 1]
	],
	areaM2: 0.5,
	portalId: 'door'
});

test('captures on press, reads crossed parcels in path order and releases on demand', () => {
	let captured = false;
	const canvas = {
		focus() {},
		setPointerCapture() {
			captured = true;
		},
		hasPointerCapture: () => captured,
		releasePointerCapture() {
			captured = false;
		}
	} as unknown as HTMLCanvasElement;
	const pointer = createStrokePointer(
		{ readPoint: () => parcel('a'), readSegment: () => [parcel('a'), parcel('b')] },
		(x, y) => [x, y]
	);
	const read = (type: string, x = 0, button = 0) =>
		pointer.read(
			{
				event: { type, pointerId: 1, button } as PointerEvent,
				ground: [x, 0, 0],
				canvas
			} satisfies GroundPointer,
			'paint'
		);
	expect(read('pointerdown', 0, 2)).toBeUndefined();
	expect(read('pointermove')?.hits.map(({ id }) => id)).toEqual(['a']);
	expect(read('pointerdown')?.type).toBe('down');
	expect(captured).toBe(true);
	expect(read('pointermove', 3)?.hits.map(({ id }) => id)).toEqual(['a', 'b']);
	pointer.release();
	expect(captured).toBe(false);
	expect(read('pointermove', 4)?.hits.map(({ id }) => id)).toEqual(['a']);
	expect(read('pointerup')?.type).toBe('up');
});
