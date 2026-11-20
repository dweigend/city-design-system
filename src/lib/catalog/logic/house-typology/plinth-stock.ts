import { assetRegistry, buildObject } from '../assets';
import type { Solid } from './types';

const variants = assetRegistry
	.filter((a) => a.id.startsWith('kit-plinth-chamfer-'))
	.flatMap((a) =>
		a.variants.map((variant) => {
			const p = buildObject(a.id, variant, 0).geometry[0];
			if (p.kind !== 'prism') throw Error('Expected chamfered plinth');
			const w = 2 * Math.max(...p.polygon.map(([x]) => x)),
				d = 2 * Math.max(...p.polygon.map(([, y]) => y));
			return { id: a.id, variant, p, w, d };
		})
	);
/** Reserves a released base with the largest footprint inside a compact surveyed bay. */
export function blockBase(width: number, depth: number) {
	const fits = variants
		.map((k) => {
			const s = Math.max(0.85, width / k.w, depth / k.d);
			return { w: s * k.w, d: s * k.d, height: s * k.p.height, s };
		})
		.filter(
			(k) =>
				k.s <= 1.15 &&
				k.height >= 0.6 &&
				k.height <= 1.2 &&
				k.w <= width + 1.2 &&
				k.d <= depth + 0.9
		);
	fits.sort((a, b) => a.w * a.d - b.w * b.d || a.height - b.height);
	return fits[0] ?? { w: width, d: depth, height: 0.6 };
}
/** Uses a released chamfered plinth when one uniform transform seats the surveyed footprint and height. */
export function fitPlinthStock(base: Solid): Solid {
	if (base.kind !== 'prism' || base.holes?.length) return base;
	const [w, d, h] = base.size;
	const kit = variants.find((k) => {
		const s = h / k.p.height;
		return (
			s >= 0.85 &&
			s <= 1.15 &&
			k.w * s <= w + 1e-9 &&
			k.d * s <= d + 1e-9 &&
			w - k.w * s < 0.02 &&
			d - k.d * s < 0.02
		);
	});
	if (!kit) return base;
	const x = Math.min(...base.polygon.map(([u]) => u)) + w / 2,
		y = Math.min(...base.polygon.map(([, v]) => v)) + d / 2;
	const s = h / kit.p.height;
	return {
		...base,
		polygon: kit.p.polygon.map(([u, v]) => [x + u * s, y + v * s]),
		source: { objectId: kit.id, variant: kit.variant },
		scale: [s, s, s]
	};
}
