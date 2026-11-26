import type { ViewFit } from '../../lib/scene/stage';
import type { Drawable } from '../../lib/scene/surface';
import type { readStoryHandover, StorySetup } from './growth';

export type StoryPart = Readonly<{
	drawable: Drawable;
	floor?: number;
	building?: string;
	service?: boolean;
}>;
export type StoryFrame = Readonly<{
	year: number;
	eventCount: number;
	indices: readonly number[];
	subject?: string;
	cutY?: number;
	serviceFit?: ViewFit;
	detailFit?: ViewFit;
}>;
type StoryHandover = ReturnType<typeof readStoryHandover>;
type WirePart = Omit<StoryPart, 'drawable'> & {
	drawable: Omit<Drawable, 'shape'>;
	shapeIndex: number;
};
type Shape = Drawable['shape'];

export type StoryBatch = Readonly<{
	requestId: number;
	kind: 'batch';
	fit?: ViewFit;
	parts: readonly WirePart[];
	shapes: readonly Shape[];
	events: readonly StoryFrame[];
	checkpoint?: StoryFrame;
	handover?: StoryHandover;
}>;
export type StoryReply = StoryBatch | Readonly<{ requestId: number; kind: 'error' }>;
export type StoryRequest = Readonly<{ requestId: number; setup: StorySetup }>;
export type Dissection = 'assembled' | 'explode' | 'section' | 'transparency';

export function createStoryEncoder() {
	const indices = new WeakMap<Shape, number>();
	let count = 0;
	return (parts: readonly StoryPart[]) => {
		const shapes: Shape[] = [];
		const encoded = parts.map(({ drawable: { shape, ...drawable }, ...part }): WirePart => {
			let index = indices.get(shape);
			if (index === undefined) {
				index = count++;
				indices.set(shape, index);
				shapes.push(shape);
			}
			return { ...part, drawable, shapeIndex: index };
		});
		return { parts: encoded, shapes };
	};
}

export function createStoryTimeline(requestId: number) {
	const events: StoryFrame[] = [];
	const checkpoints = new Map<number, StoryFrame>();
	const parts: StoryPart[] = [];
	const shapes: Shape[] = [];
	return {
		events,
		checkpoints,
		parts,
		accepts: (reply: StoryReply) => reply.requestId === requestId,
		append(batch: StoryBatch) {
			if (batch.requestId !== requestId) return false;
			for (const shape of batch.shapes) shapes.push(shape);
			for (const { shapeIndex, drawable, ...part } of batch.parts)
				parts.push({ ...part, drawable: { ...drawable, shape: shapes[shapeIndex] } });
			events.push(...batch.events);
			if (batch.checkpoint) checkpoints.set(batch.checkpoint.year, batch.checkpoint);
			return true;
		}
	};
}

const storeyGapM = 3.5;

export function showStoryFrame(frame: StoryFrame, parts: readonly StoryPart[], mode: Dissection) {
	return frame.indices.map((index) => {
		const { drawable, floor, building, service } = parts[index];
		if (service) return { ...drawable, visible: mode === 'transparency' };
		if (mode === 'explode' && floor)
			return { ...drawable, vertical: { scale: 1, pivot: 0, offset: floor * storeyGapM } };
		if (mode === 'section' && building === frame.subject && frame.cutY !== undefined)
			return { ...drawable, section: { normal: [0, 1, 0] as const, constant: -frame.cutY } };
		return drawable;
	});
}
