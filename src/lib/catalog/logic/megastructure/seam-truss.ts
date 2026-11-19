import { FRAME_DIAMETER } from '../../data/frame-sections';
import { schneidet, type Prisma } from '../haus-tragwerk';
import { crossesGap, interiorLength } from './clearance';
import { type Aufgabe, type Vec3 } from '../statik';
import { sizeMembers } from './sections';

export type BaySurvey = Readonly<{
	id: string;
	a: Vec3;
	b: Vec3;
	back: Vec3;
	gateShoes?: Vec3[];
	clearVolumes?: readonly Prisma[];
	crown?: number;
	clearances?: readonly (readonly Vec3[])[];
	gaps?: readonly (readonly [Vec3, Vec3])[];
}>;
const LOAD_CASE = 'service-probe';
/** A preview in metres. Both columns land on the surveyed wall crown. */
export function bayAxes(bay: BaySurvey) {
	const p = (point: Vec3): Vec3 => [point[0], point[1], bay.crown ?? point[2] + 2];
	const a = p(bay.a),
		b = p(bay.b);
	return {
		a,
		b,
		axes: [
			[bay.a, a],
			[bay.b, b],
			[a, b]
		] satisfies [Vec3, Vec3][]
	};
}

/** Builds the surveyed pair of columns, chord and clear local braces. The service probe
 * selects drawing diameters. A mechanism keeps the same geometry with nominal sections. */
export function trimBay(bay: BaySurvey, drawing: 'service' | 'nominal' = 'service') {
	const { a, b } = bayAxes(bay);
	if (!validBearings(bay, a, b))
		return {
			status: 'rejected' as const,
			reason: 'no-bearing',
			geometry: bay,
			element: bay.id,
			loadCase: LOAD_CASE
		};
	const points = [bay.a, bay.b, bay.back, a, b];
	if (bay.gateShoes) points.push(...bay.gateShoes);
	const candidates=clearMembers(bay,points);
	if (![0, 1, 2].every((i) => candidates.some((c) => c.id === String(i))))
		return {
			status: 'rejected' as const,
			reason: 'clearance',
			element: bay.id,
			geometry: bay,
			loadCase: LOAD_CASE
		};
	const result=drawing==='service' ? serviceSections(bay,points,candidates) : undefined;
	const sections = new Map(
		result?.status === 'ok' ? result.staebe.map((r) => [r.id, r.querschnitt.durchmesserM]) : []
	);
	return {
		status: 'sized' as const,
		sizing: result?.status ?? 'nominal',
		candidates: candidates.length,
		rods: candidates.map((r) => ({
			id: r.id,
			a: points[Number(r.a)],
			b: points[Number(r.b)],
			diameter: sections.get(r.id) ?? nominalDiameter(r.id)
		}))
	};
}

function validBearings(bay: BaySurvey, a: Vec3, b: Vec3) {
	const points = [a, b, bay.a, bay.b, bay.back, ...(bay.gateShoes ?? [])];
	if (!points.every((p) => p.every(Number.isFinite))) return false;
	if (bay.gateShoes && bay.gateShoes.length !== 4) return false;
	return Math.hypot(a[0] - b[0], a[1] - b[1]) > 0 && a[2] > bay.a[2] && b[2] > bay.b[2];
}

function nominalDiameter(id: string) {
	if (id === '2') return FRAME_DIAMETER.main;
	return Number(id) < 2 ? 0.14 : FRAME_DIAMETER.brace;
}

function clearMembers(bay:BaySurvey,points:Vec3[]) {
	const edges = bay.gateShoes
		? [
				[0, 3],
				[1, 4],
				[3, 4],
				[5, 3],
				[6, 3],
				[7, 4],
				[8, 4]
			]
		: [
				[0, 3],
				[1, 4],
				[3, 4],
				[2, 3],
				[2, 4],
 [0, 4],
 [1, 3]
			];
	return edges.flatMap(([i, j], index) => {
		const span = Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]);
		const p = points[i],
			q = points[j];
		if (bay.clearVolumes?.some((volume) => schneidet(p, q, volume))) return [];
		if (bay.gaps?.some((gap) => crossesGap(p, q, gap))) return [];
		if (
			bay.clearances?.some(
				(ring) =>
					interiorLength(p, q, ring) > 0 ||
					ring.every((u, k) => {
						const v = ring[(k + 1) % ring.length];
						return (v[0] - u[0]) * (p[1] - u[1]) - (v[1] - u[1]) * (p[0] - u[0]) > 0;
					})
			)
		)
			return [];
		if (index >= 3 && span > 5) return [];
		return [
			{
				id: String(index),
				a: String(i),
				b: String(j),
				rolle: 'tragstab' as const,
				bleibt: true
			}
		];
	});
}

function serviceSections(bay:BaySurvey,points:Vec3[],candidates:Aufgabe["kandidaten"]) {
	const nodes = points.map((p, i) => ({ id: String(i), p }));
	const task: Omit<Aufgabe, 'werkstoff'> = {
		knoten: nodes.filter((_, i) => !bay.gateShoes || i !== 2),
		kandidaten: candidates,
		lager: nodes
			.filter((_, i) => i !== 3 && i !== 4 && (!bay.gateShoes || i !== 2))
			.map((n) => ({ knotenId: n.id, fest: [true, true, true] })),
		lastfaelle: [
			{
				id: LOAD_CASE,
				lasten: nodes.slice(3, 5).map((n) => ({ knotenId: n.id, kraftN: [0, 0, -1000] }))
			}
		]
	};
	return sizeMembers(task);
}
