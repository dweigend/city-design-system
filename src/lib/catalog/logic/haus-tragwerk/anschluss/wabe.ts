import type { TraegerPlan, Vec3 } from '../../traeger/plan';
import { anschluss, type Anschluss } from '../plan';
export function wabe(p: TraegerPlan): Anschluss[] {
	const nodes = new Map(p.knoten.map((n) => [n.id, n.p]));
	const result: Anschluss[] = [];
	const punkt = (id: string): Vec3 => {
		const p = nodes.get(id);
		if (!p) throw new RangeError(`Missing carrier node ${id}`);
		return p;
	};
	for (const z of p.zellen.filter((z) => z.nutzung !== 'schacht')) {
		const faces = p.flaechen.filter((f) => z.flaechen.includes(f.id));
		const points = faces.flatMap((f) => f.knoten.map((id) => punkt(id)));
		const floor = Math.min(...points.map((p) => p[2])),
			top = Math.max(...points.map((p) => p[2]));
		const bottom = faces.find((f) => f.knoten.every((id) => punkt(id)[2] === floor));
		if (!bottom) throw new RangeError(`Cell without floor: ${z.id}`);
		const polygon = bottom.knoten
			.map((id) => punkt(id))
			.reverse()
			.map(([x, y]) => [x, y] as [number, number]);
		const a = anschluss(
			z.id,
			'mittragend',
			polygon,
			floor,
			top - floor,
			bottom.knoten,
			faces.filter((f) => f.rolle === 'glas').map((f) => f.id)
		);

		const edge = polygon
			.map((v, i) => ({ v, b: polygon[(i + 1) % polygon.length] }))
			.sort(
				(a, b) =>
					(a.v[0] + a.b[0]) * 0.848 +
					(a.v[1] + a.b[1]) * 0.53 -
					((b.v[0] + b.b[0]) * 0.848 + (b.v[1] + b.b[1]) * 0.53)
			)[0];
		const len = Math.hypot(edge.b[0] - edge.v[0], edge.b[1] - edge.v[1]);
		a.tuer.p = [(edge.v[0] + edge.b[0]) / 2, (edge.v[1] + edge.b[1]) / 2, floor];
		a.tuer.tangente = [(edge.b[0] - edge.v[0]) / len, (edge.b[1] - edge.v[1]) / len];
		result.push(a);
		const roof = faces.find((f) => f.knoten.every((id) => punkt(id)[2] === top));
		if (roof && !p.zellen.some((other) => other.id !== z.id && other.flaechen.includes(roof.id))) {
			const g = anschluss(roof.id, 'mittragend', polygon, top, 0.2, roof.knoten);
			g.art = 'garten';
			g.traegt = `${z.id}/einbau`;
			g.tuer.p = [...a.tuer.p] as Vec3;
			result.push(g);
		}
	}
	return result;
}
