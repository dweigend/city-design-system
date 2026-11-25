import { expect, test } from 'bun:test';
import { createCellSpace } from '../../lib/domain/cell-space';
import type { Parcel } from '../../lib/domain/parcels';
import type { GroundPointer } from '../../lib/scene/stage-view';
import { createStrokePointer, createVerticalPointer } from './stroke';

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

function createCanvas() {
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
	return { canvas, isCaptured: () => captured };
}

test('captures on press, reads crossed parcels in path order and releases on demand', () => {
	const { canvas, isCaptured } = createCanvas();
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
	expect(isCaptured()).toBe(true);
	expect(read('pointermove', 3)?.hits.map(({ id }) => id)).toEqual(['a', 'b']);
	pointer.release();
	expect(isCaptured()).toBe(false);
	expect(read('pointermove', 4)?.hits.map(({ id }) => id)).toEqual(['a']);
	expect(read('pointerup')?.type).toBe('up');
});

function verticalFixture() {
	const { canvas, isCaptured } = createCanvas();
	const space = createCellSpace(
		{
			id: 'a',
			corners: parcel('a').outline.map((position, index) => ({ id: String(index), position })),
			frontage: [],
			baseZ: 0,
			storeyCount: 3
		},
		0
	);
	const cell = space.cells[0];
	const target = {
		cell,
		center: [0.25, 0.25] as const,
		storeys: space.storeys.filter(({ cellId }) => cellId === cell.id)
	};
	let picks = 0;
	const vertical = createVerticalPointer(() => {
		picks++;
		return target;
	});
	const input = (type: string, height = 1, pointerId = 1, view: 'plan' | 'iso' = 'iso') =>
		vertical.read(
			{
				event: { type, pointerId, button: 0 } as PointerEvent,
				canvas,
				ray:
					view === 'plan'
						? { origin: [0.25, 0.25, 20], direction: [0, 0, -1] }
						: { origin: [-7.75, 0.25, height + 6], direction: [0.8, 0, -0.6] }
			},
			view
		);
	return { input, isCaptured, target, picks: () => picks, isOpen: vertical.isOpen };
}

test.each(['pointerup', 'pointercancel', 'lostpointercapture'])(
	'clears the non-publishing vertical drag on %s',
	(end) => {
		const { input, isCaptured, picks } = verticalFixture();
		expect(input('pointerdown')).toMatchObject({ kind: 'drag', storeys: [{ storey: 0 }] });
		expect(isCaptured()).toBe(true);
		expect(input('pointermove', 8, 2)).toBeUndefined();
		const preview = input('pointermove', 8);
		expect(preview?.kind === 'drag' && preview.storeys.map(({ storey }) => storey)).toEqual([
			0, 1, 2
		]);
		expect(picks()).toBe(1);
		expect(input(end)).toBeNull();
		expect(isCaptured()).toBe(false);
		expect(input('pointermove', 8)).toBeUndefined();
	}
);

test('Plan exposes discrete choices for the clicked cell and discards an interrupted click', () => {
	const { input, isOpen, target } = verticalFixture();
	expect(input('pointerdown', 1, 1, 'plan')).toBeUndefined();
	expect(input('pointercancel', 1, 1, 'plan')).toBeNull();
	input('pointerdown', 1, 1, 'plan');
	const choice = input('pointerup', 1, 1, 'plan');
	expect(choice).toEqual({ kind: 'plan', target });
	expect(choice?.target.storeys.map(({ storey }) => storey)).toEqual([0, 1, 2]);
	expect(isOpen()).toBe(false);
	expect(input('lostpointercapture', 1, 1, 'plan')).toBeUndefined();
});
