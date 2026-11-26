import { defaults } from '../../../config/envelope';
import { crossProduct, displacement, isFiniteVector, length, type Vec3 } from '../../core/geometry';
import type { MeshShape } from '../../core/mesh';

export type EnvelopeGrip = Readonly<{ id: string; position: Vec3 }>;

const coordinateStride = /* Exact arithmetic: XYZ coordinates per mesh vertex. */ 3;
const zeroArea = /* Exact arithmetic: zero cross-product magnitude marks a collapsed triangle. */ 0;

export function validateGrips(id: string, grips: readonly EnvelopeGrip[], minimum: number) {
	if (typeof id !== 'string' || !id.trim() || grips.length < minimum)
		throw new RangeError('Envelope requires an address and enough surveyed grips');
	const names = new Set<string>();
	for (const grip of grips) {
		if (!grip || typeof grip.id !== 'string' || !grip.id.trim() || names.has(grip.id))
			throw new RangeError('Expected unique, nonempty grip addresses');
		if (!isFiniteVector(grip.position, coordinateStride))
			throw new RangeError('Expected finite XYZ grips');
		names.add(grip.id);
	}
}

export function spanM(from: Vec3, to: Vec3) {
	const span = length(displacement(from, to));
	if (!Number.isFinite(span) || span <= defaults.envelopeGripToleranceM)
		throw new RangeError('Expected a finite, nondegenerate grip span');
	return span;
}

export function clipFraction(span: number) {
	return Math.min(defaults.envelopeClipSpanRatio, defaults.envelopeClipLengthM / span);
}

export function validateMeshTriangles(shape: MeshShape | undefined) {
	if (!shape) throw new RangeError('Expected nondegenerate envelope geometry');
	const { positions, indices } = shape;
	const vertex = (index: number): Vec3 => [
		positions[index * coordinateStride],
		positions[index * coordinateStride + 1],
		positions[index * coordinateStride + 2]
	];
	for (let i = 0; i < indices.length; i += coordinateStride) {
		const a = vertex(indices[i]);
		const b = vertex(indices[i + 1]);
		const c = vertex(indices[i + 2]);
		const twiceArea = length(crossProduct(displacement(a, b), displacement(a, c)));
		if (!Number.isFinite(twiceArea) || twiceArea <= zeroArea)
			throw new RangeError('Envelope dimensions collapse at the supplied coordinates');
	}
	return shape;
}
