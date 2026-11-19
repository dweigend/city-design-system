import { structuralSurface, type Surface } from './surfaces';
import type { Primitive, Vec3 } from '../parametrik/types';
type Strip<T> = T extends unknown
	? Omit<T, 'id' | 'role' | 'material' | 'token' | 'finish'>
	: never;
type Form = Strip<Primitive>;
/** Gives a primitive its stable name and assigned surface. */
export const piece = (id: string, form: Form, surface: Surface): Primitive => ({
	id,
	role: 'neu',
	...structuralSurface(surface),
	...form
});
function rounded(x: number, y: number, w: number, d: number, r: number): [number, number][] {
	const radius = Math.min(w / 2, d / 2, r);
	return Array.from({ length: 4 }, (_, i) => {
		const sx = i === 0 || i === 3 ? 1 : -1,
			sy = i < 2 ? 1 : -1;
		return Array.from({ length: 5 }, (_, j): [number, number] => {
			const a = ((i + j / 4) * Math.PI) / 2;
			return [
				x + sx * (w / 2 - radius) + radius * Math.cos(a),
				y + sy * (d / 2 - radius) + radius * Math.sin(a)
			];
		});
	}).flat();
}
/** Extrudes a filleted, centred plan from its bottom elevation in metres. */
export function slab(
	id: string,
	p: Vec3,
	w: number,
	d: number,
	height: number,
	r: number,
	surface: Surface
) {
	return piece(
		id,
		{ kind: 'prism', polygon: rounded(p[0], p[1], w, d, r), z: p[2], height, bearing: 'slab' },
		surface
	);
}
