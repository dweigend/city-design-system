import type { Node } from 'three/webgpu';
import { float, mix, normalWorldGeometry } from 'three/tsl';

/** Attenuates fixed-volume grain as its narrowest projected repeat approaches two pixels. */
export function grainVisibility(chart: Node<'vec3'>) {
	const footprint = chart.fwidth();
	return footprint.x.max(footprint.y).max(footprint.z).smoothstep(0.22, 0.5).oneMinus();
}

/** Projects a repeating motif onto its dominant face plane and blends neighbouring world-space pitches. */
export function townPattern(
	p: Node<'vec3'>,
	pitch: number,
	motif: (uv: Node<'vec2'>) => Node<'float'>,
	mode: 'blend' | 'fixed' | 'grid' = 'blend'
) {
	const n = normalWorldGeometry.abs();
	const uv = n.y
		.greaterThanEqual(n.x.max(n.z))
		.select(p.xz, n.x.greaterThan(n.z).select(p.zy, p.xy));
	if (mode === 'fixed') {
		const chart = uv.div(pitch);
		return motif(chart).mul(float(1).sub(chart.fwidth().length().smoothstep(0.18, 0.52)));
	}
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
	if (mode === 'grid') return motif(uv.div(octave.round().exp2().mul(pitch)));
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

/** Three low-contrast stone slivers per 15 cm repeat. Subpixel chips fade into the matrix. */
export function pavingFlecks(p: Node<'vec3'>) {
	return townPattern(
		p,
		0.15,
		(uv) => {
			const tile = uv.fract();
			const flake = (x: number, y: number, width: number, slope: number) => {
				const u = tile.x.sub(x);
				const across = tile.y.sub(y).add(u.mul(slope)).abs().div(0.07);
				const along = u.abs().div(width);
				return along.max(across).smoothstep(0.86, 1).oneMinus();
			};
			return flake(0.24, 0.28, 0.15, 0.32)
				.negate()
				.add(flake(0.72, 0.76, 0.19, -0.27))
				.add(flake(0.73, 0.29, 0.085, 0.41).mul(-0.44));
		},
		'fixed'
	);
}
