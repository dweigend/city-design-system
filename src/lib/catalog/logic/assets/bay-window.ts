import { mount, type AssetRecipe } from './definition';
import { rod, surface } from './parts';

export const bayWindow: AssetRecipe = {
	id: 'bay-window',
	slotNames: ['body', 'glass'],
	category: 'facades',
	variants: ['canted', 'wide', 'deep'],
	footprint: [1.6, 4.8],
	anchors: [mount('facade')],
	draw(variant, sample) {
		const d = [0.88, 0.74, 1.46][variant],
			w = [2.8, 4.6, 3.15][variant],
			h = 1.25 + 0.15 * sample;
		const polygon: [number, number][] = [
			[0, -w / 2],
			[d, -w * 0.31],
			[d, w * 0.31],
			[0, w / 2]
		];
		const section = (z: number, height: number, slot: string) => ({
			...surface(slot),
			kind: 'prism' as const,
			polygon,
			z,
			height
		});
		return [
			section(0, 0.18, 'body'),
			section(0.18, h, 'glass'),
			section(h + 0.18, 0.17, 'body'),
			...[-1, 1].map((sign) =>
				rod([d - 0.065, sign * w * 0.31, 0.18], [d - 0.065, sign * w * 0.31, h + 0.18], 0.065)
			)
		];
	}
};
