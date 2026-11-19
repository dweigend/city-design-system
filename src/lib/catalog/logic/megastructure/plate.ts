import { required } from '../required';
import type { Vec3 } from '../traeger';
import { buildRoofFrame, type RoofCell } from './roof-frame';
import { dockModule, type ModuleKind, type Bounds, type DockedModule } from './dock';
import { routeSlope } from './slope';
import { moduleBridge } from './bridge';
const roofs: RoofCell[] = [0, 10, 20].map((x, i) => ({
	id: 'roof-' + i,
	height: [6, 7, 5][i],
	polygon: [
		[x, 0],
		[x + 8, 0],
		[x + 7 + i / 2, 7],
		[x + 1, 6 + i]
	]
}));
function roofBounds(r: RoofCell): Bounds {
	const xs = r.polygon.map((p) => p[0]),
		ys = r.polygon.map((p) => p[1]);
	return {
		min: [Math.min(...xs), Math.min(...ys), 0],
		max: [Math.max(...xs), Math.max(...ys), r.height]
	};
}
/** Generates the three-roof plate in world meters. Fixed survey and load case, no RNG.
 * The returned geometry is detached. A broken fixture constraint raises an invariant error. */
export function infrastructurePlate() {
	const result = buildRoofFrame(roofs, undefined, 'leitstil');
	if (result.status !== 'assembled') throw new Error('Plate roof frame: ' + result.status);
	const { frame } = result;
	const rods = frame.rods.map(({ a, b, radius }) => ({ a: a.p, b: b.p, radius }));
	const stock = roofs.map(roofBounds),
		modules: DockedModule[] = [];
	const place = (kind: ModuleKind, point: Vec3, normal: Vec3) => {
		const m = dockModule(kind, { point, normal, tangent: [1, 0, 0] }, [
			...stock,
			...rods,
			...modules.map((m) => m.bounds)
		]);
		modules.push(required(m, kind));
	};
	place('capsule', [4, 0, 4], [0, -1, 0]);
	place('capsule', [14, 0, 5], [0, -1, 0]);
	const head = frame.structure.knoten.find((n) => n.p[2] === 10);
	const [x, y, z] = required(head, 'high chord').p;
	place('tank', [x, y, z + rods[0].radius], [0, 0, 1]);
	place('garden', [23.7, 3.3, 5], [0, 0, 1]);
	place('solar-ring', [17.75, 3.5, 10 + rods[0].radius], [0, 0, 1]);
	const points: Vec3[] = [
		[17, -12, 0.35],
		[26, -9, 3.45],
		[17, -6, 6.55]
	];
	const slope = required(
		routeSlope(
			{
				points,
				links: [
					[0, 2],
					[0, 1],
					[1, 2]
				]
			},
			0,
			2
		),
		'hillside'
	);
	return {
		roofs: structuredClone(roofs),
		rods,
		modules,
		slope,
		bridge: moduleBridge([6, -1, 3.8], [12, -1, 4.8]),
		analysis: frame.analysis
	};
}
