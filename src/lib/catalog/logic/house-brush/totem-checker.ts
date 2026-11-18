import type { Primitive } from '../parametrik/types';
import { part } from './form';

/** Four courses of fired clay blocks alternate across a single cantilever. Each block is a solid. */
export function checkeredBlock(
	body: Extract<Primitive, { kind: 'box' | 'cylinder' | 'cone' }>
): Primitive[] {
	const [x, y, z] = body.position;
	const [width, depth, height] =
		body.kind === 'box' ? body.size : [body.radius * 1.7, body.radius, body.height];
	const cx = body.kind === 'box' ? x + width / 2 : x,
		cy = body.kind === 'box' ? y + depth / 2 : y;
	const turn = body.rotation ?? 0;
	const columns = 3,
		rows = 4;
	const w = width / columns,
		h = height / rows;
	return Array.from({ length: columns * rows }, (_, i) => {
		const column = i % columns,
			row = Math.floor(i / columns);
		const dx = (column + 0.5) * w - width / 2;
		const form = {
			kind: 'box' as const,
			position: [
				cx + dx * Math.cos(turn) - w / 2,
				cy + dx * Math.sin(turn) - depth / 2,
				z + row * h
			] as [number, number, number],
			size: [w, depth, h] as [number, number, number],
			rotation: turn
		};
		return {
			...part(body.id + ':tile' + i, '--paper', form),
			pattern: 'schachbrett',
			edges: false,
			shade: ((column + row) % 2) * 0.8
		};
	});
}
