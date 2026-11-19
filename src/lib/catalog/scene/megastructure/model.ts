import { slopeMesh } from './slope-mesh';
import * as T from 'three';
import { infrastructurePlate, type RoofCell } from '../../logic/megastructure';
import { prism, rod, solid } from './geometry';
import { moduleMesh, type Pigments } from './modules';
function stock(roof: RoofCell, p: Pigments) {
	const group = new T.Group();
	group.add(prism(roof.polygon, 0, roof.height, p.stock, p.steel));
	for (const [i, a] of roof.polygon.entries()) {
		const b = roof.polygon[(i + 1) % roof.polygon.length],
			dx = b[0] - a[0],
			dy = b[1] - a[1];
		for (let z = 1.45; z < roof.height - 0.2; z += 1.6)
			for (let j = 1; j <= 5; j++) {
				const window = solid(new T.BoxGeometry(Math.hypot(dx, dy) * 0.12, 0.04, 0.52), p.window);
				window.rotation.z = Math.atan2(dy, dx);
				window.position.set(a[0] + (dx * j) / 6, a[1] + (dy * j) / 6, z);
				group.add(window);
			}
	}
	return group;
}
/** Assembles the evidence plate in local z-up meters for the scene's world transform. */
export function plateModel(p: Pigments) {
	const plate = infrastructurePlate(),
		group = new T.Group();
	for (const roof of plate.roofs) group.add(stock(roof, p));
	for (const r of plate.rods) group.add(rod(r.a, r.b, r.radius, p.steel));
	for (const m of plate.modules) group.add(moduleMesh(m, p));
	addBridge(group, plate.bridge, p);
	addTerraces(group, p);
	group.add(rod([7.5, 3.5, 10.1], [17.75, 3.5, 10.1], 0.055, p.yellow), slopeMesh(plate.slope, p));
	group.rotation.x = -Math.PI / 2;
	return group;
}
function addBridge(
	group: T.Group,
	bridge: ReturnType<typeof infrastructurePlate>['bridge'],
	p: Pigments
) {
	for (const part of bridge) {
		if (part.kind === 'prism') group.add(prism(part.polygon, part.z, part.height, p.pink, p.steel));
		if (part.kind === 'polyline') group.add(rod(part.points[0], part.points[1], 0.045, p.pink));
	}
}
function addTerraces(group: T.Group, p: Pigments) {
	for (let i = 0; i < 13; i++) {
		const y = -12.5 + i * 0.5,
			z = Math.max(0.12, (y + 12) * 1.033 - 0.85);
		group.add(
			prism(
				[
					[15, y],
					[28, y],
					[28, y + 0.5],
					[15, y + 0.5]
				],
				-0.2,
				z + 0.2,
				p.stock,
				p.steel
			)
		);
	}
}
