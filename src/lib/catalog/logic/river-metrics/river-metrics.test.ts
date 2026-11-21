import { expect, test } from 'bun:test';
import { clipPolylineToSquare, sinuosity } from './index';

test('clips a straight line to its two interpolated border points', () => {
	const input = new Float64Array([-4, -2, 4, 2]);
	const reach = clipPolylineToSquare(input, 2);

	expect(reach).toEqual({ xy: new Float64Array([-1, -0.5, 1, 0.5]), borderHits: 2 });
	if (!reach) throw new Error('Expected a clipped reach');
	expect(sinuosity(reach.xy)).toBe(1);
	expect(reach.xy.buffer).not.toBe(input.buffer);
});

test('approximates the analytic semicircle ratio pi / 2 at fine sampling', () => {
	const intervals = 65_536;
	const xy = new Float64Array(2 * (intervals + 1));
	for (let i = 0; i <= intervals; i++) {
		const angle = (Math.PI * i) / intervals;
		xy[2 * i] = Math.cos(angle);
		xy[2 * i + 1] = Math.sin(angle);
	}
	expect(Math.abs(sinuosity(xy) - Math.PI / 2)).toBeLessThan(1e-9);
});

test('agrees with independent Simpson quadrature for one period of a sine', () => {
	const intervals = 4096;
	const step = (2 * Math.PI) / intervals;
	const xy = new Float64Array(2 * (intervals + 1));
	for (let i = 0; i <= intervals; i++) {
		const x = i * step;
		xy[2 * i] = x;
		xy[2 * i + 1] = Math.sin(x);
	}

	const speed = (x: number) => Math.sqrt(1 + Math.cos(x) ** 2);
	let weightedSpeed = speed(0) + speed(2 * Math.PI);
	for (let i = 1; i < intervals; i += 2) weightedSpeed += 4 * speed(i * step);
	for (let i = 2; i < intervals; i += 2) weightedSpeed += 2 * speed(i * step);
	const expected = (step * weightedSpeed) / (3 * 2 * Math.PI);

	expect(Math.abs(sinuosity(xy) - expected)).toBeLessThan(1e-6);
});

test('keeps the longest contiguous reach and the first when lengths tie', () => {
	const xy = [-2, -0.5, 2, -0.5, 2, 2, 0, 0, -2, 2];
	expect(clipPolylineToSquare(xy, 2)).toEqual({
		xy: new Float64Array([1, 1, 0, 0, -1, 1]),
		borderHits: 2
	});
	expect(clipPolylineToSquare([-2, 0, 2, 0, 2, 0.5, -2, 0.5], 2)?.xy).toEqual(
		new Float64Array([-1, 0, 1, 0])
	);
});

test('handles border contacts and rejects degenerate measurements', () => {
	expect(clipPolylineToSquare([-2, 2, 0, 0, 2, 2], 2)?.borderHits).toBe(2);
	expect(clipPolylineToSquare([-2, 0, 0, 1, 2, 0], 2)?.borderHits).toBe(3);
	expect(clipPolylineToSquare([-2, 1, 2, 1], 2)?.borderHits).toBe(Infinity);
	expect(clipPolylineToSquare([0, 2, 2, 0], 2)).toBeNull();
	expect(() => clipPolylineToSquare([0, 0, 1, 1], 0)).toThrow('invalid-window');
	expect(() => sinuosity([0, 0, 0, 0])).toThrow('invalid-polyline');
	expect(() => sinuosity([0, 0, NaN, 1])).toThrow('invalid-polyline');
	expect(() => sinuosity([0, 0, 1, 0, 0, 0])).toThrow('zero-chord');
});
