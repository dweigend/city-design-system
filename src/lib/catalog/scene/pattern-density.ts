import type { Node } from 'three/webgpu';
import { mix, normalWorldGeometry } from 'three/tsl';

/** Projects a repeating motif onto its dominant face plane and blends neighbouring world-space pitches. */
export function townPattern(
	p: Node<'vec3'>,
	pitch: number,
	motif: (uv: Node<'vec2'>) => Node<'float'>
) {
	const n = normalWorldGeometry.abs();
	const uv = n.y
		.greaterThanEqual(n.x.max(n.z))
		.select(p.xz, n.x.greaterThan(n.z).select(p.zy, p.xy));
	// Eight framebuffer pixels per repeat leave room for both the motif and its ground.
	// Differentiate the metre coordinates before choosing the face. This avoids
	// artificial jumps at projection seams and retains grazing-angle foreshortening.
	const footprint = p.fwidth();
	const octave = n.y
		.greaterThanEqual(n.x.max(n.z))
		.select(
			footprint.x.max(footprint.z),
			n.x.greaterThan(n.z).select(footprint.z.max(footprint.y), footprint.x.max(footprint.y))
		)
		.mul(8 / pitch)
		.max(1)
		.log2();
	const chart = uv.div(octave.floor().exp2().mul(pitch));
	return mix(motif(chart), motif(chart.mul(0.5)), octave.fract().smoothstep(0, 1));
}

/** Signed coverage for pale and dark terrazzo inclusions on a seeded world chart. */
export function terrazzoChips(p: Node<'vec3'>, pitch: number) {
	// Two angular flecks on an offset lattice. The same graphic repeats at town zoom.
	return townPattern(p, pitch, (uv) => {
		const tile = uv.fract();
		const dark = tile.x.sub(0.29).abs().mul(1.3).add(tile.y.sub(0.32).abs());
		const pale = tile.x.sub(0.72).abs().add(tile.y.sub(0.74).abs().mul(1.7));
		return dark.smoothstep(0.23, 0.27).sub(pale.smoothstep(0.22, 0.26));
	});
}
