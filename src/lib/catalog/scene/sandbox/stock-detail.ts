import type { Primitive, Vec3 } from '../../logic/parametrik/types';

/** Traces window subdivisions on the existing panels and cornices around surveyed plates. */
export function stockDetail(parts: Primitive[]) {
	const lines: number[] = [];
	function stroke(a: Vec3, b: Vec3) {
		lines.push(a[0], a[2], -a[1], b[0], b[2], -b[1]);
	}
	for (const p of parts) {
		if (p.role !== 'bestand') continue;
		if (p.kind === 'prism' && p.id.endsWith(':plate')) {
			for (const ring of [p.polygon, ...(p.holes ?? [])]) {
				const z = p.z + p.height * 0.48;
				ring.forEach(([x, y], i) => stroke([x, y, z], [...ring[(i + 1) % ring.length], z]));
			}
		}
		if (p.kind !== 'box' || !p.id.includes(':opening')) continue;
		const [w, d, h] = p.size,
			[x, y, z] = p.position,
			angle = p.rotation ?? 0;
		const point = (u: number, v: number, side: number): Vec3 => [
			x + w / 2 + Math.cos(angle) * w * u - Math.sin(angle) * side,
			y + d / 2 + Math.sin(angle) * w * u + Math.cos(angle) * side,
			z + h * v
		];
		for (const face of [-1, 1]) {
			const side = face * (d / 2 + 0.004);
			const lights = Math.max(2, Math.round(w / 1.15));
			for (let i = 1; i < lights; i++)
				stroke(point(i / lights - 0.5, 0, side), point(i / lights - 0.5, 1, side));
			stroke(point(-0.5, 0.72, side), point(0.5, 0.72, side));
		}
	}
	return lines;
}
