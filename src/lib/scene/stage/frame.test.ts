import { expect, spyOn, test } from 'bun:test';
import {
	BufferGeometry,
	Float32BufferAttribute,
	Group,
	Mesh,
	MeshBasicMaterial,
	type OrthographicCamera,
	type Scene
} from 'three/webgpu';
import type { Drawable } from '../surface';
import { Stage, stageNavigation, type ViewFit } from './index';
import { fitCamera } from './camera';
import { rayHit } from './content';
import * as stageRenderer from './renderer';

async function withHeadlessStage(
	run: (
		stage: Awaited<ReturnType<typeof Stage.create>>,
		canvas: HTMLCanvasElement,
		draw: () => void
	) => void,
	render: (scene: Scene, camera: OrthographicCamera) => void = () => {}
) {
	const open = spyOn(stageRenderer, 'openRenderer').mockResolvedValue({
		renderer: { render, info: { render: { drawCalls: 0 } }, setDrawingBufferSize() {} },
		hardware: false,
		adapterName: 'Headless test',
		stop() {},
		async delete() {}
	} as unknown as Awaited<ReturnType<typeof stageRenderer.openRenderer>>);
	let pending: FrameRequestCallback | undefined;
	const host = {
		requestAnimationFrame: (callback: FrameRequestCallback) => {
			pending = callback;
			return 1;
		},
		cancelAnimationFrame() {},
		MutationObserver: class {
			observe() {}
			disconnect() {}
		},
		devicePixelRatio: 1,
		getComputedStyle: () => ({ getPropertyValue: () => '1' })
	};
	const descriptors = Object.getOwnPropertyDescriptors(globalThis);
	for (const [key, value] of Object.entries(host))
		Object.defineProperty(globalThis, key, { value, configurable: true });
	const canvas = Object.assign(new EventTarget(), {
		dataset: {},
		getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 1000 }),
		ownerDocument: {
			documentElement: { dataset: {} },
			createElement: () => ({
				getContext: () => ({
					clearRect() {},
					fillRect() {},
					getImageData: () => ({ data: [0, 0, 0] })
				})
			})
		}
	}) as unknown as HTMLCanvasElement;
	let stage: Awaited<ReturnType<typeof Stage.create>> | undefined;
	try {
		stage = await Stage.create({ canvas, landscape: true });
		stage.resize(1000, 1000);
		run(stage, canvas, () => {
			if (!pending) throw new Error('No scheduled frame');
			const callback = pending;
			pending = undefined;
			callback(0);
		});
	} finally {
		await stage?.delete();
		for (const key of Object.keys(host)) {
			const original = descriptors[key];
			if (original) Object.defineProperty(globalThis, key, original);
			else Reflect.deleteProperty(globalThis, key);
		}
		open.mockRestore();
	}
}

test.each(['mesh', 'parent'] as const)('picks terrain scaled by its %s', (host) => {
	const positions = [-5, -5, 100, 5, -5, 100, 5, 5, 100, -5, 5, 100];
	const geometry = new BufferGeometry()
		.setAttribute('position', new Float32BufferAttribute(positions, 3))
		.setIndex([0, 1, 2, 0, 2, 3]);
	const material = new MeshBasicMaterial();
	const terrain = new Mesh(geometry, material);
	const group = new Group();
	const scaled = host === 'parent' ? group : terrain;
	scaled.scale.z = 10;
	group.add(terrain);
	try {
		expect(rayHit([terrain], [0, 0, 0], [0, 0, -1])).toEqual([0, 0, 1000]);
	} finally {
		geometry.dispose();
		material.dispose();
	}
});

test.each([false, true])(
	'keeps a 100 m terrain anchor at the cursor through exaggeration (warp %s)',
	async (warp) => {
		await withHeadlessStage((stage, canvas, draw) => {
			const initial: ViewFit = { width: 1600, elevation: Math.PI / 4 };
			const terrain: Drawable = {
				id: 'zoom-ground',
				color: '--paper',
				finish: 'terrain',
				shape: {
					kind: 'mesh',
					positions: [-2000, -2000, 100, 2000, -2000, 100, 2000, 2000, 100, -2000, 2000, 100],
					indices: [0, 1, 2, 0, 2, 3]
				},
				...(warp ? { warp: { fill: [20, 10, 20, 10, 20, 10, 20, 10], amount: 0 } } : {})
			};
			const offset = [0, 100] as const;
			stage.setFit(initial);
			stage.show([terrain], ({ width }) => {
				const wide = width >= 2000;
				return [
					{
						...terrain,
						vertical: { pivot: 0, scale: wide ? 3.61 : 1.69 },
						warp: terrain.warp && { ...terrain.warp, amount: wide ? 1 : 0 }
					}
				];
			});
			draw();
			const ground = stage.pickGround(offset);
			if (!ground) throw new Error('Expected a displayed terrain hit');
			expect(ground[2]).toBeCloseTo(169);
			const navigation = stageNavigation(
				canvas,
				() => stage.readViewport().metersPerPixel,
				(next) => stage.setFit({ ...initial, ...next }),
				(next) => stage.readFrame({ ...initial, ...next })
			);
			try {
				canvas.dispatchEvent(
					Object.assign(new Event('wheel', { cancelable: true }), {
						clientX: 500,
						clientY: 600,
						deltaMode: 0,
						deltaY: -Math.log(1600 / 2600) / 0.0017
					})
				);
				draw();
				expect(stage.readViewport().width).toBeCloseTo(2600);
				const after = stage.pickGround(offset);
				if (!after) throw new Error('Expected a displayed terrain hit after zooming');
				expect(after[0]).toBeCloseTo(ground[0] + (warp ? 20 : 0));
				expect(after[1]).toBeCloseTo(ground[1] + (warp ? 10 : 0));
				expect(after[2]).toBeCloseTo(361);
			} finally {
				navigation.delete();
			}
		});
	}
);

test.each(['fill', 'stroke'] as const)(
	'clips the 5 km presentation warp on the first draw of a %s',
	async (component) => {
		const wall = {
			id: 'warp-bounds',
			color: '--paper',
			finish: 'matte',
			shape: { kind: 'mesh', positions: [0, 0, 0, 0, 1, 0, 0, 0, 1], indices: [0, 1, 2] },
			strokeSegments: [0, 0, 0, 0, 1, 0],
			warp: {
				fill: component === 'fill' ? [5000, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 0, 0],
				stroke: component === 'stroke' ? [5000, 0, 5000, 0] : [0, 0, 0, 0],
				amount: 0
			}
		} satisfies Drawable;
		const bounds = { min: [0, 0, 0], max: [0, 1, 1] } as const;
		const clipping = { min: bounds.min, max: [5000, 1, 1] } as const;
		const expected = fitCamera('iso', bounds, 1, true, undefined, clipping).far;
		let far: number | undefined;
		await withHeadlessStage(
			(stage, _canvas, draw) => {
				stage.show([wall], () => [{ ...wall, warp: { ...wall.warp, amount: 1 } }]);
				draw();
				expect(far).toBeCloseTo(expected);
			},
			(_scene, camera) => (far = camera.far)
		);
	}
);
