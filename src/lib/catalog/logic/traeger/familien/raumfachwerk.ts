import { familienTexte } from '../../../data/traeger';
import { belege } from '../belegung';
import {
	kantenId,
	type Flaeche,
	type Kante,
	type Knoten,
	type TraegerFamilie,
	type TraegerPlan,
	type Vec3,
	type Zelle
} from '../plan';

// FCC principle / shared face ownership after city_game:
// prototype/src/lib/experiments/volume-houses/core/volume-grid.ts.
// New here: Delaunay cells instead of FCC Voronoi cells, in [111] orientation.
// Rule paths (i,j,k) address ABC layers; no coordinate keys.
const STAB_M = 3.5 / Math.sqrt(2 / 3);
const LAGENHOEHE_M = 3.5;
const HOCHWEG_M = 8;
const TETRA_M3 = STAB_M ** 3 / (6 * Math.sqrt(2));
const OKTA_M3 = (STAB_M ** 3 * Math.sqrt(2)) / 3;
const ABSTAND_EPS_M = STAB_M * 1e-9;
function vorhanden<T>(map: Map<string, T>, id: string): T {
	const value = map.get(id);
	if (!value) throw new Error(`Missing incidence element ${id}`);
	return value;
}
const adresse = (i: number, j: number, k: number) => `raumfachwerk:k:${i}:${j}:${k}`;

function planen(werte: Record<string, number>, saat: number): TraegerPlan {
	const phase = werte.phase ?? 3;
	const nx = phase < 2 ? 1 : (werte.felder ?? 4);
	const ny = phase < 2 ? 1 : (werte.tiefe ?? 3);
	const nz = phase < 3 ? 1 : (werte.lagen ?? 2);
	const knoten = new Map<string, Knoten>();
	const kanten = new Map<string, Kante>();
	const flaechen = new Map<string, Flaeche>();
	const zellen: Zelle[] = [];
	function punkt(i: number, j: number, k: number): string {
		const id = adresse(i, j, k);
		if (!knoten.has(id)) {
			const u = i + k / 3,
				v = j + k / 3;
			knoten.set(id, {
				id,
				p: [
					STAB_M * (u + v / 2),
					((STAB_M * Math.sqrt(3)) / 2) * v,
					(phase === 3 ? HOCHWEG_M : 0) + k * LAGENHOEHE_M
				],
				rolle: 'nabe'
			});
		}
		return id;
	}
	function stab(a: string, b: string, rolle: Kante['rolle'] = 'stab') {
		const id = kantenId(a, b);
		kanten.set(id, { id, a, b, rolle, ...(rolle === 'stab' ? { klasse: 'A' } : {}) });
	}
	function zelle(id: string, vertices: string[], volumenM3: number) {
		// Keep complete regular cells inside an axis-aligned window. Boundary rows
		// alternate half a member; no shear or shortened boundary members.
		if (
			phase >= 2 &&
			vertices.some((id) => {
				const p = vorhanden(knoten, id).p;
				return (
					p[0] < -ABSTAND_EPS_M ||
					p[0] > nx * STAB_M + ABSTAND_EPS_M ||
					p[1] < -ABSTAND_EPS_M ||
					p[1] > (ny * STAB_M * Math.sqrt(3)) / 2 + ABSTAND_EPS_M
				);
			})
		)
			return;
		const faces: string[] = [];
		// Exact incidence templates; geometry never decides topology.
		// Octahedron opposite pairs: (0,5), (1,4), (2,3).
		const facets =
			vertices.length === 4
				? [
						[0, 1, 2],
						[0, 1, 3],
						[0, 2, 3],
						[1, 2, 3]
					]
				: [
						[0, 1, 2],
						[0, 1, 3],
						[0, 2, 4],
						[0, 3, 4],
						[1, 2, 5],
						[1, 3, 5],
						[2, 4, 5],
						[3, 4, 5]
					];
		for (const facet of facets) {
			const ring = facet.map((i) => vertices[i]);
			const fid = `raumfachwerk:f:${[...ring].sort().join('/')}`;
			if (!flaechen.has(fid)) flaechen.set(fid, { id: fid, knoten: ring, rolle: 'offen' });
			for (let e = 0; e < 3; e++) stab(ring[e], ring[(e + 1) % 3]);
			faces.push(fid);
		}
		zellen.push({
			id,
			flaechen: faces,
			volumenM3,
			...(id.includes(':okt:') ? { nutzung: 'raum' as const } : {})
		});
	}
	for (let k = 0; k < nz; k++)
		for (let i = phase < 2 ? 0 : -ny - nz; i < nx; i++)
			for (let j = phase < 2 ? 0 : -nz; j < ny; j++) {
				const l = (a: number, b: number) => punkt(i + a, j + b, k);
				const u = (a: number, b: number) => punkt(i + a, j + b, k + 1);
				zelle(
					`raumfachwerk:z:tet:${i}:${j}:${k}:a`,
					[l(0, 0), l(1, 0), l(0, 1), u(0, 0)],
					TETRA_M3
				);
				if (phase === 0) continue;
				zelle(
					`raumfachwerk:z:okt:${i}:${j}:${k}`,
					[l(1, 0), l(0, 1), l(1, 1), u(0, 0), u(1, 0), u(0, 1)],
					OKTA_M3
				);
				if (phase === 1) continue;
				zelle(
					`raumfachwerk:z:tet:${i}:${j}:${k}:b`,
					[l(1, 1), u(1, 0), u(0, 1), u(1, 1)],
					TETRA_M3
				);
			}
	const used = new Set([...flaechen.values()].flatMap((f) => f.knoten));
	for (const id of knoten.keys()) if (!used.has(id)) knoten.delete(id);
	// Four corners of the lowest triangular grid row, each with one grounded support.
	if (phase === 3) {
		const bottom = [...knoten.values()].filter((n) => Math.abs(n.p[2] - HOCHWEG_M) < ABSTAND_EPS_M);
		const ys = bottom.map((n) => n.p[1]);
		for (const y of [Math.min(...ys), Math.max(...ys)]) {
			const row = bottom
				.filter((n) => Math.abs(n.p[1] - y) < ABSTAND_EPS_M)
				.sort((a, b) => a.p[0] - b.p[0]);
			for (const top of [row[0], row[row.length - 1]]) {
				const id = `raumfachwerk:lager:${top.id}`;
				knoten.set(id, { id, p: [top.p[0], top.p[1], 0], rolle: 'lager' });
				stab(id, top.id, 'nebenstab');
			}
		}
	}
	const belegung = belege({ zellen, flaechen: [...flaechen.values()] }, saat, 'raumfachwerk', {
		anteil: phase === 3 ? (werte.belegung ?? 0.15) : 0,
		stroeme: ['people', 'material'],
		ziele: zellen.filter((z) => z.id.includes(':okt:')).map((z) => z.id)
	});
	// Occupancy only changes surface roles/materials, never incidence or member IDs.
	// Only three side panels per occupied octahedron; the remaining frame stays open.
	for (const z of zellen) {
		if (!belegung[z.id] || belegung[z.id] === 'leer') continue;
		let panels = 0;
		for (const fid of z.flaechen) {
			const f = vorhanden(flaechen, fid);
			const zs = f.knoten.map((id) => vorhanden(knoten, id).p[2]);
			const bottom = Math.min(
				...z.flaechen.flatMap((id) =>
					vorhanden(flaechen, id).knoten.map((id) => vorhanden(knoten, id).p[2])
				)
			);
			const floor = zs.every((z) => Math.abs(z - bottom) < ABSTAND_EPS_M);
			const side = !zs.every((z) => Math.abs(z - zs[0]) < ABSTAND_EPS_M);
			if (floor || (side && panels < 3)) {
				f.rolle = floor ? 'boden' : 'paneel';
				f.zelle = z.id;
				if (!floor) panels++;
			}
		}
	}
	// Center the footprint; no effect on rule addresses or lengths.
	const points = [...knoten.values()];
	const center = [0, 1].map(
		(axis) =>
			(Math.min(...points.map((n) => n.p[axis])) + Math.max(...points.map((n) => n.p[axis]))) / 2
	);
	for (const n of points) n.p = [n.p[0] - center[0], n.p[1] - center[1], n.p[2]] as Vec3;
	return {
		version: 1,
		familie: 'raumfachwerk',
		saat: saat >>> 0,
		werte: { ...werte },
		knoten: points,
		kanten: [...kanten.values()],
		flaechen: [...flaechen.values()],
		zellen,
		belegung
	};
}
export const raumfachwerk: TraegerFamilie = {
	id: 'raumfachwerk',
	parameter: [
		...[
			{ id: 'felder', label: 'Bays', optionen: [3, 4, 6], start: 4 },
			{ id: 'tiefe', label: 'Depth', optionen: [2, 3], start: 3 },
			{ id: 'lagen', label: 'Layers', optionen: [1, 2, 3], start: 2 }
		].map((p) => ({
			...p,
			art: 'diskret' as const,
			optionen: p.optionen.map((wert) => ({ wert, label: String(wert) }))
		})),
		{
			art: 'stetig',
			id: 'belegung',
			label: 'Occupancy',
			min: 0,
			max: 1,
			schritt: 0.05,
			start: 0.15,
			einheit: ''
		},
		{
			art: 'diskret',
			id: 'phase',
			label: 'Build phase',
			optionen: [0, 1, 2, 3].map((wert) => ({ wert, label: String(wert) })),
			start: 3,
			verborgen: true
		}
	],
	planen,
	loop: (familienTexte.find((t) => t.id === 'raumfachwerk')?.schritte ?? []).map((s, i) => ({
		name: s.name,
		werte: { phase: i, belegung: i === 3 ? 0.15 : 0 },
		ansicht: i === 3 ? 'belegt' : 'geruest',
		dauerS: 4
	}))
};
