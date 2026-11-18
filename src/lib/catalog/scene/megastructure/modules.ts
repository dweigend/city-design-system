import * as T from 'three';
import type { DockedModule } from '../../logic/megastructure';
import { solid } from './geometry';
export type Pigments = {
	paper: string;
	stock: string;
	steel: string;
	pink: string;
	blue: string;
	orange: string;
	yellow: string;
};
/** Projects a dock result in its orthonormal socket basis. Local z points outward. */
export function moduleMesh(m: DockedModule, p: Pigments) {
	const group = new T.Group(),
		[w, d, h] = m.size;
	const basis = new T.Matrix4().makeBasis(
		new T.Vector3(...m.tangent),
		new T.Vector3(...m.side),
		new T.Vector3(...m.normal)
	);
	group.quaternion.setFromRotationMatrix(basis);
	group.position.set(...m.center);
	if (m.kind === 'tank') group.add(solid(new T.SphereGeometry(w / 2, 40, 24), p.blue));
	else if (m.kind === 'capsule') addCapsule(group, w, d, h, p);
	else if (m.kind === 'solar-ring')
		group.add(solid(new T.TorusGeometry(w / 2 - h / 2, h / 2, 12, 48), p.steel));
	else addBeds(group, w, d, h, p);
	return group;
}
function addBeds(group: T.Group, w: number, d: number, h: number, p: Pigments) {
	const slab = solid(new T.BoxGeometry(w, d, h * 0.6), p.paper, p.steel);
	slab.position.z = -h * 0.2;
	group.add(slab);
	for (let i = 0; i < 5; i++) {
		const bed = solid(new T.BoxGeometry(w * 0.9, d * 0.12, h * 0.4), p.stock, p.steel);
		bed.position.set(0, (i - 2) * d * 0.18, h * 0.3);
		group.add(bed);
	}
}

function addCapsule(group: T.Group, w: number, d: number, h: number, p: Pigments) {
	const shell = solid(new T.CapsuleGeometry(d / 2, w - d, 12, 32), p.paper);
	shell.rotation.z = Math.PI / 2;
	group.add(shell);
	for (const x of [-w / 4, w / 4]) {
		const seam = solid(new T.TorusGeometry(d * 0.495, d * 0.005, 6, 48), p.steel);
		seam.rotation.y = Math.PI / 2;
		seam.position.x = x;
		group.add(seam);
	}
	const panel = solid(new T.BoxGeometry(w * 0.42, d * 0.22, h * 0.02), p.orange);
	panel.position.z = h * 0.49;
	group.add(panel);
}
