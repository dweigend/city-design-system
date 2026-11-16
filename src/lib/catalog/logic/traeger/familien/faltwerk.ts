import { belege } from '../belegung';
import { kantenId, type TraegerFamilie, type TraegerPlan, type Vec3, type Kante } from '../plan';

const KANTE_M = 3.5;
const ALPHA_RAD = Math.PI / 3;
const START_NEIGUNG_RAD = Math.PI / 3;
const nodeId = (seite: number, i: number, j: number) => `faltwerk:k:${seite}:${i}:${j}`;
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
const dot = (a: Vec3, b: Vec3) => a.reduce((s, v, i) => s + v * b[i], 0);

function point(nodes: Map<string, Vec3>, id: string): Vec3 {
	const p = nodes.get(id);
	if (!p) throw new Error(`Missing folded plate node ${id}`);
	return p;
}

type Eckpunkt = { id: string; p: Vec3 };

const isSupport = (id: string) =>
	id.startsWith('faltwerk:fuss:') || id === nodeId(0, 0, 0) || id === nodeId(1, 0, 0);

/** Ported from city_game: prototype/src/lib/experiments/folding/core/folding.ts.
 * Every strip is only rotated and translated rigidly. Two half-planes
 * cut partial polygons out of the rigid Miura panels, no arc mapping.
 * The cut ridge lies at x=0, the foot line at z=0. Both can zigzag within
 * their plane: a plane cut is no guarantee of a straight line.
 * Cut nodes inherit the IDs of their original lattice edge.
 */
function createSheets(p: TraegerPlan) {
	const { faltwinkel: theta, bahnen, felder, neigung, phase, zuschnitt } = p.werte;
	const H = KANTE_M * Math.sin(theta) * Math.sin(ALPHA_RAD);
	const L = KANTE_M * Math.sqrt(1 - (Math.sin(theta) * Math.sin(ALPHA_RAD)) ** 2);
	const V = (KANTE_M ** 2 * Math.cos(ALPHA_RAD)) / L;
	const S = (KANTE_M ** 2 * Math.sin(ALPHA_RAD) * Math.cos(theta)) / L;
	const nodes = new Map<string, Eckpunkt>();
	for (const seite of [0, 1]) {
		const beta = zuschnitt
			? neigung
			: neigung * (seite === 0 ? Math.min(1, 2 * phase) : Math.max(0, 2 * phase - 1));
		const c = Math.cos(beta),
			s = Math.sin(beta);
		// The end cuts stay strictly inside the broad alternating column gaps:
		// eave in 0→1, ridge in (bahnen−1)→bahnen. See topology tests.
		const ridge = (((2 * bahnen - 1) * L + V) * c - H * s) / 2;
		const foot = ((V + L) * s + H * c) / 2;
		const grid = (i: number, j: number): Eckpunkt => {
			const x = i * L + (j % 2) * V,
				z = (i % 2) * H;
			return {
				id: nodeId(seite, i, j),
				p: [
					x * c - z * s - (zuschnitt ? ridge : -KANTE_M),
					j * S - (felder * S) / 2,
					x * s + z * c - (zuschnitt ? foot : 0)
				]
			};
		};
		const clip = (ring: Eckpunkt[], axis: 0 | 2, keepPositive: boolean): Eckpunkt[] => {
			const out: Eckpunkt[] = [];
			for (let k = 0; k < ring.length; k++) {
				const a = ring[k],
					b = ring[(k + 1) % ring.length];
				const insideA = keepPositive ? a.p[axis] >= 0 : a.p[axis] <= 0;
				const insideB = keepPositive ? b.p[axis] >= 0 : b.p[axis] <= 0;
				if (insideA) out.push(a);
				if (insideA !== insideB) {
					// Both cut planes intersect original edges only; they never intersect
					// each other on the retained sheet. Canonical order also fixes rounding.
					const [u, v] = a.id < b.id ? [a, b] : [b, a];
					const t = -u.p[axis] / (v.p[axis] - u.p[axis]);
					const q = u.p.map((x, i) => x + t * (v.p[i] - x)) as Vec3;
					q[axis] = 0;
					const edge = [u.id.replace(`k:${seite}:`, 'k:'), v.id.replace(`k:${seite}:`, 'k:')];
					out.push({
						id:
							axis === 0
								? `faltwerk:first:${JSON.stringify(edge)}`
								: `faltwerk:fuss:${seite}:${JSON.stringify(edge)}`,
						p: q
					});
				}
			}
			return out;
		};
		for (let i = 0; i < bahnen; i++)
			for (let j = 0; j < felder; j++) {
				let ring = [grid(i, j), grid(i + 1, j), grid(i + 1, j + 1), grid(i, j + 1)];
				if (zuschnitt) {
					ring = clip(ring, 0, false);
					ring = clip(ring, 2, true);
				}
				if (ring.length < 3) continue;
				for (const k of ring) {
					// Mirror only after clipping. First points are written once, identically.
					const q: Vec3 = [seite === 0 ? k.p[0] : -k.p[0], k.p[1], k.p[2]];
					if (!nodes.has(k.id)) nodes.set(k.id, { id: k.id, p: q });
				}
				p.flaechen.push({
					id: `faltwerk:f:${seite}:${i}:${j}`,
					rolle: 'paneel',
					knoten: (seite === 0 ? ring : [...ring].reverse()).map((k) => k.id)
				});
			}
	}
	for (const k of nodes.values())
		p.knoten.push({ ...k, rolle: isSupport(k.id) ? 'lager' : 'frei' });
}

/** Ported from city_game: prototype/src/lib/experiments/folding/core/folding-topology.ts.
 * The first face incidence gives the oriented axis; the sign of the dihedral angle
 * classifies mountain/valley. No coordinate-dependent IDs, no angle threshold.
 */
function createCreases(p: TraegerPlan, nodes: Map<string, Vec3>) {
	const owners = new Map<string, { edge: Kante; normals: Vec3[] }>();
	for (const f of p.flaechen) {
		const [a, b, c] = f.knoten.map((id) => point(nodes, id));
		const normal = cross(sub(b, a), sub(c, a));
		for (let i = 0; i < f.knoten.length; i++) {
			const a = f.knoten[i],
				b = f.knoten[(i + 1) % f.knoten.length],
				id = kantenId(a, b);
			const owner = owners.get(id);
			if (owner) owner.normals.push(normal);
			else owners.set(id, { edge: { id, a, b, rolle: 'rand' }, normals: [normal] });
		}
	}
	for (const { edge, normals } of owners.values()) {
		if (normals.length === 2) {
			const axis = sub(point(nodes, edge.b), point(nodes, edge.a));
			edge.rolle = dot(axis, cross(normals[0], normals[1])) > 0 ? 'berg' : 'tal';
		}
		p.kanten.push(edge);
	}
	return [...owners.values()].filter((e) => e.normals.length === 1).map((e) => e.edge);
}

function closeHouse(p: TraegerPlan, boundary: Kante[], nodes: Map<string, Vec3>) {
	// One floor and two vertical, planar end polygons follow the actual boundary.
	const groups = [
		{
			id: 'boden',
			rolle: 'boden' as const,
			edges: boundary.filter((e) => point(nodes, e.a)[2] === 0 && point(nodes, e.b)[2] === 0)
		},
		...[0, 1].map((end) => {
			const y = (end === 0 ? Math.min : Math.max)(...p.knoten.map((k) => k.p[1]));
			return {
				id: `stirn:${end}`,
				rolle: 'glas' as const,
				edges: boundary.filter((e) => point(nodes, e.a)[1] === y && point(nodes, e.b)[1] === y)
			};
		})
	];
	// Include floor/end corner links where the two eaves meet an end plane.
	const feet = p.knoten.filter((k) => k.rolle === 'lager');
	for (const end of [0, 1]) {
		const y = (end === 0 ? Math.min : Math.max)(...feet.map((k) => k.p[1]));
		const pair = feet.filter((k) => k.p[1] === y);
		if (pair.length !== 2) throw new Error('Folded tent: end cut does not have two foot points');
		const [a, b] = pair.map((k) => k.id);
		const edge: Kante = { id: kantenId(a, b), a, b, rolle: 'rand' };
		p.kanten.push(edge);
		groups[0].edges.push(edge);
		groups[end + 1].edges.push(edge);
	}
	for (const g of groups) {
		const ring = [g.edges[0].a];
		let current = g.edges[0].b;
		const unused = g.edges.slice(1);
		while (current !== ring[0]) {
			ring.push(current);
			const index = unused.findIndex((e) => e.a === current || e.b === current);
			if (index < 0) throw new Error(`Folded tent: open ${g.id} edge`);
			const e = unused.splice(index, 1)[0];
			current = e.a === current ? e.b : e.a;
		}
		// Boundary edges follow roof winding. Reverse for the closing face.
		if (ring[1] === g.edges[0].b) ring.reverse();
		p.flaechen.push({ id: `faltwerk:${g.id}`, rolle: g.rolle, knoten: ring });
	}
	// Orient every face coherently via edge incidence before the volume integral.
	const owners = new Map<string, { face: number; a: string; b: string }[]>();
	p.flaechen.forEach((f, face) =>
		f.knoten.forEach((a, i) => {
			const b = f.knoten[(i + 1) % f.knoten.length],
				key = kantenId(a, b);
			owners.set(key, [...(owners.get(key) ?? []), { face, a, b }]);
		})
	);
	const signs = new Map<number, number>([[0, 1]]),
		queue = [0];
	while (queue.length) {
		const face = queue.shift();
		if (face === undefined) break;
		const f = p.flaechen[face];
		f.knoten.forEach((a, i) => {
			const b = f.knoten[(i + 1) % f.knoten.length];
			for (const other of owners.get(kantenId(a, b)) ?? [])
				if (!signs.has(other.face)) {
					signs.set(other.face, (signs.get(face) ?? 1) * (other.a === a ? -1 : 1));
					queue.push(other.face);
				}
		});
	}
	let volume = 0;
	p.flaechen.forEach((f, index) => {
		if (signs.get(index) === -1) f.knoten.reverse();
		const points = f.knoten.map((id) => point(nodes, id));
		for (let i = 1; i + 1 < points.length; i++)
			volume += dot(points[0], cross(points[i], points[i + 1])) / 6;
	});
	p.zellen.push({
		id: 'faltwerk:z:haus',
		flaechen: p.flaechen.map((f) => f.id),
		volumenM3: Math.abs(volume)
	});
}

export const faltwerk: TraegerFamilie = {
	id: 'faltwerk',
	parameter: [
		{
			art: 'stetig',
			id: 'faltwinkel',
			label: 'Fold angle',
			min: 0.05,
			max: 1,
			schritt: 0.01,
			start: 1,
			einheit: 'rad'
		},
		{
			art: 'stetig',
			id: 'neigung',
			label: 'Tilt',
			min: (50 * Math.PI) / 180,
			max: (60 * Math.PI) / 180,
			schritt: 0.01,
			start: START_NEIGUNG_RAD,
			einheit: 'rad'
		},
		{
			art: 'diskret',
			id: 'bahnen',
			label: 'Strips',
			optionen: [4, 6, 8].map((wert) => ({ wert, label: String(wert) })),
			start: 6
		},
		{
			art: 'diskret',
			id: 'felder',
			label: 'Bays',
			optionen: [4, 6].map((wert) => ({ wert, label: String(wert) })),
			start: 6
		},
		{
			art: 'stetig',
			id: 'phase',
			label: 'Raise',
			min: 0,
			max: 1,
			schritt: 0.01,
			start: 1,
			einheit: '',
			verborgen: true
		},
		{
			art: 'diskret',
			id: 'zuschnitt',
			label: 'Cut',
			optionen: [0, 1].map((wert) => ({ wert, label: String(wert) })),
			start: 1,
			verborgen: true
		}
	],
	planen(werte, saat) {
		const p: TraegerPlan = {
			version: 1,
			familie: 'faltwerk',
			saat: saat >>> 0,
			werte: {
				faltwinkel: werte.faltwinkel ?? 1,
				neigung: werte.neigung ?? START_NEIGUNG_RAD,
				bahnen: werte.bahnen ?? 6,
				felder: werte.felder ?? 6,
				phase: werte.phase ?? 1,
				zuschnitt: werte.zuschnitt ?? 1
			},
			knoten: [],
			kanten: [],
			flaechen: [],
			zellen: [],
			belegung: {}
		};
		createSheets(p);
		const nodes = new Map(p.knoten.map((k) => [k.id, k.p]));
		const boundary = createCreases(p, nodes);
		if (p.werte.zuschnitt) closeHouse(p, boundary, nodes);
		// Quiet solar occupation only on the same sun-facing sheet, via shared API.
		p.belegung = belege(
			{ zellen: [], flaechen: p.flaechen.filter((f) => f.id.startsWith('faltwerk:f:0:')) },
			saat,
			'faltwerk',
			{ anteil: 0.2, stroeme: ['energy'] }
		);
		return p;
	},
	loop: [
		{
			name: 'Sheet',
			werte: { faltwinkel: 0.05, phase: 0, zuschnitt: 0 },
			ansicht: 'huelle',
			dauerS: 4
		},
		{
			name: 'Fold',
			werte: { faltwinkel: 0.65, phase: 0, zuschnitt: 0 },
			ansicht: 'geruest',
			dauerS: 4
		},
		{
			name: 'Strip',
			werte: { faltwinkel: 1, phase: 0.5, zuschnitt: 0 },
			ansicht: 'huelle',
			dauerS: 4
		},
		{
			name: 'House',
			werte: { faltwinkel: 1, phase: 1, zuschnitt: 1 },
			ansicht: 'belegt',
			dauerS: 4
		}
	]
};
