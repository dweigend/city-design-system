import { anschluss } from '../plan';
/** Truncated sphere: horizontal floor and roof, a hexagonal usable prism inside the sphere. */
export function kuppel() {
	const radius = 3,
		halfHeight = 2.4,
		usableRadius = Math.sqrt(radius ** 2 - halfHeight ** 2);
	const polygon = Array.from({ length: 6 }, (_, i): [number, number] => [
		8 + usableRadius * Math.cos((i * Math.PI) / 3),
		usableRadius * Math.sin((i * Math.PI) / 3)
	]);
	const a = anschluss('kuppel:f:boden', 'eigenstaendig', polygon, 8, halfHeight * 2);
	a.tuer.p = [8 - 2.45, -1.53, 8];
	a.tuer.tangente = [0.53, -0.848];
	a.huelle = { zentrum: [8, 0, 8 + halfHeight], radiusM: radius };
	return [a];
}
