import { expect, test } from 'bun:test';
import type { Parcel } from '../../lib/domain/parcels';
import type { GroundPointer } from '../../lib/scene/stage-view';
import { createStroke } from './stroke';

test('cancels capture before loading and forwards terminal events while loading', () => {
	const parcel: Parcel = {
		id: 'a',
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
	};
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
	const commits: (readonly Parcel[])[] = [];
	const stroke = createStroke(
		{ readPoint: () => parcel, readSegment: () => [parcel] },
		(x, y) => [x, y],
		() => {},
		(parcels) => commits.push(parcels)
	);
	const event = (type: string, loading = false) =>
		stroke.read(
			{
				event: { type, pointerId: 1, button: 0 } as PointerEvent,
				ground: [0, 0, 0],
				canvas
			} satisfies GroundPointer,
			'house',
			loading
		);

	event('pointerdown');
	expect(captured).toBe(true);
	stroke.cancel();
	event('lostpointercapture', true);
	event('pointerup');
	expect(commits).toEqual([]);
	expect(captured).toBe(false);

	event('pointerdown');
	event('pointerup', true);
	event('pointerup');
	expect(commits).toEqual([]);
	event('pointerdown');
	event('pointerup');
	expect(commits).toEqual([[parcel]]);
});
