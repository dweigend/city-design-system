import { expect, test } from 'bun:test';
import init from 'manifold-3d';
import { envelopeForm, type Roof } from './index';

const kernel = await init();
kernel.setup();

for (const roof of ['gable', 'hip', 'shed', 'sawtooth'] satisfies Roof[]) {
	test(roof + ' exposes a closed indexed roof with pencil creases in world metres', () => {
		const cell = {
			roof,
			polygon: [
				[100, 20],
				[112, 20],
				[112, 28],
				[100, 28]
			] as [number, number][],
			base: 12,
			storeys: [{ height: 4 }, { height: 4 }]
		};
		const form = envelopeForm(kernel, cell);
		expect(form).toEqual(envelopeForm(kernel, cell));
		expect(Math.min(...form.points.map((p) => p[2]))).toBe(12);
		expect(Math.max(...form.points.map((p) => p[2]))).toBeGreaterThan(20);
		expect(form.lines.some((line) => line.every((i) => form.points[i][2] === 16))).toBe(true);
		expect(form.triangles.length % 3).toBe(0);
		expect(form.lines.length).toBeGreaterThan(5);
	});
}
