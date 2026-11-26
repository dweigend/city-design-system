import { positionWorld, reference } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { Drawable } from '../surface';

export function verticalTransform(vertical: Drawable['vertical']) {
	const scale = vertical?.scale ?? 1;
	return { scale, offset: (vertical?.pivot ?? 0) * (1 - scale) + (vertical?.offset ?? 0) };
}

// The inclusive half-space test keeps every point for a zero row.
const zero = /* Exact arithmetic: zero plane coefficients disable clipping. */ 0;
const unclipped = [zero, zero, zero, zero] as const;

export function sectionPlane(section: Drawable['section']) {
	if (!section) return unclipped;
	const { normal, constant } = section;
	const [x, y, z] = normal;
	const length = Math.hypot(x, y, z);
	if (!(length > 0 && Number.isFinite(length) && Number.isFinite(constant))) return unclipped;
	const distance = Math.fround(constant / length);
	if (Number.isFinite(distance))
		return [
			Math.fround(x / length),
			Math.fround(y / length),
			Math.fround(z / length),
			distance
		] as const;
	// Rescale all four coefficients together when normalizing by a tiny normal would overflow float32.
	const scale = Math.hypot(x, y, z, constant);
	if (!(scale > 0 && Number.isFinite(scale))) return unclipped;
	return [
		Math.fround(x / scale),
		Math.fround(y / scale),
		Math.fround(z / scale),
		Math.fround(constant / scale)
	] as const;
}

export function sectionMask(plane: Node<'vec4'>) {
	return positionWorld.dot(plane.xyz).add(plane.w).lessThanEqual(zero);
}

export function individualSectionMask() {
	return sectionMask(reference('userData.stageSection', 'vec4', null));
}
