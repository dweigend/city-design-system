import { expect, spyOn, test } from 'bun:test';
import { WebGPURenderer } from 'three/webgpu';
import * as rig from './studio-light';
import { studioConfig } from './studio-quality';

test('the sandbox and all three bible stages pass the same config object to the studio rig', async () => {
	const shim = !('$state' in globalThis);
	if (shim)
		Object.defineProperty(globalThis, '$state', {
			configurable: true,
			value: (value: unknown) => value
		});
	const [
		{ createSandboxStage },
		{ createFormlaborScene },
		{ createMaterialBuehne },
		{ createParametrikScene }
	] = await Promise.all([
		import('./sandbox/stage'),
		import('./formlabor'),
		import('./materialBuehne'),
		import('./parametrik')
	]).finally(() => {
		if (shim) Reflect.deleteProperty(globalThis, '$state');
	});
	const canvas = { width: 1, height: 1, style: {} } as HTMLCanvasElement;
	const palette = {
		paper: '#fff',
		ink: '#222',
		blueprint: '#222',
		blueprintSoft: '#fff',
		categories: {}
	};
	const init = spyOn(WebGPURenderer.prototype, 'init').mockImplementation(
		() => new Promise(() => {})
	);
	const stop = new Error('captured rig setup');
	const create = spyOn(rig, 'createStudioLight').mockImplementation(() => {
		throw stop;
	});
	const pixelRatio = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');
	Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, configurable: true });
	try {
		const fail = () => {
			throw new Error('Unexpected renderer failure');
		};
		for (const mount of [
			() => createSandboxStage(canvas, fail),
			() => createMaterialBuehne(canvas, { studio: true, bewegung: false }),
			() => createFormlaborScene(canvas, palette, fail),
			() => createParametrikScene(canvas, palette, fail)
		])
			expect(mount).toThrow(stop);
		expect(create.mock.calls).toHaveLength(4);
		for (const [config] of create.mock.calls) expect(config).toBe(studioConfig('desktop'));
	} finally {
		create.mockRestore();
		init.mockRestore();
		if (pixelRatio) Object.defineProperty(globalThis, 'devicePixelRatio', pixelRatio);
		else Reflect.deleteProperty(globalThis, 'devicePixelRatio');
	}
});

test('phone lighting keeps contact shading at a lower sampling and shadow budget', () => {
	const tiers = ['phone', 'desktop', 'high'] as const;
	for (const [lower, higher] of [
		[tiers[0], tiers[1]],
		[tiers[1], tiers[2]]
	] as const) {
		for (const key of ['aoSamples', 'aoScale', 'shadowSize'] as const) {
			expect(studioConfig(lower)[key]).toBeGreaterThan(0);
			expect(studioConfig(lower)[key]).toBeLessThan(studioConfig(higher)[key]);
		}
	}
});
