import { BufferAttribute, BufferGeometry } from 'three/webgpu';
import type { ValleyField } from '../../logic/valley';

/** Projects the field to triangles at the greater of bed and mean water. */
export function valleyGeometry(field: ValleyField, exaggeration: number): BufferGeometry {
	const side = field.windowM / field.spacingM + 1;
	const half = field.windowM / 2;
	const position = new Float32Array(side ** 2 * 3);
	const signedDepth = new Float32Array(side ** 2);
	for (let row = 0; row < side; row++) {
		for (let column = 0; column < side; column++) {
			const i = row * side + column;
			const bed = field.bedMm[i];
			const water = field.meanWaterMm[i];
			position[3 * i] = column * field.spacingM - half;
			position[3 * i + 1] = (Math.max(bed, water) / 1000) * exaggeration;
			position[3 * i + 2] = row * field.spacingM - half;
			signedDepth[i] = (bed - water) / 1000;
		}
	}

	const faces = new Uint16Array((side - 1) ** 2 * 6);
	let face = 0;
	for (let row = 0; row < side - 1; row++) {
		for (let column = 0; column < side - 1; column++) {
			const nw = row * side + column;
			const sw = nw + side;
			faces.set([nw, sw, nw + 1, nw + 1, sw, sw + 1], face);
			face += 6;
		}
	}

	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new BufferAttribute(position, 3));
	geometry.setAttribute('signedDepth', new BufferAttribute(signedDepth, 1));
	geometry.setIndex(new BufferAttribute(faces, 1));
	geometry.computeVertexNormals();
	return geometry;
}
