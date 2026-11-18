import { hash } from '../hash-random';

/** Lattice identity of an integer node; ±4096 nodes per axis cover every chart in this module. */
const LATTICE_OFFSET = 4096;
const LATTICE_SPAN = 8192;

const fade = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function node(seed: number, ix: number, iy: number, channel: number): number {
	return hash(seed, (ix + LATTICE_OFFSET) * LATTICE_SPAN + (iy + LATTICE_OFFSET), channel);
}

/**
 * Smooth value noise in [0, 1) on an integer lattice, C¹ continuous.
 * Slope bound: at most 1.5 per lattice unit along each axis.
 * @param x lattice coordinate (world length divided by the wavelength)
 * @param y lattice coordinate
 */
export function valueNoise(seed: number, x: number, y: number, channel: number): number {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	const tx = fade(x - ix);
	const ty = fade(y - iy);
	const south = mix(node(seed, ix, iy, channel), node(seed, ix + 1, iy, channel), tx);
	const north = mix(node(seed, ix, iy + 1, channel), node(seed, ix + 1, iy + 1, channel), tx);
	return mix(south, north, ty);
}
