import { familienTexte } from '../../../data/traeger';
import { belege } from '../belegung';
import { kantenId, type TraegerFamilie, type TraegerPlan, type Vec3 } from '../plan';

const SEITE_M = 3.5;
const LAGENHOEHE_M = 3.5;
type Axial = readonly [number, number];
const NACHBARN: readonly Axial[] = [
	[1, 0],
	[0, 1],
	[-1, 1],
	[-1, 0],
	[0, -1],
	[1, -1]
];
const adresse = (q: number, r: number) => `q${q}r${r}`;
const abstand = (q: number, r: number) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));

/** Same flat orientation as logic/parametrik/raster/index.ts::hexagons.
 * Corner identity is the sorted triple of incident grid sites, not a position key.
 * Order: q, then r, layer ascending, corners counterclockwise.
 * The site (0,0) is an unoccupied shaft with its own use.
 */
function ecke(q: number, r: number, i: number, ebene: number) {
	const a = NACHBARN[(i + 5) % 6],
		b = NACHBARN[i];
	return `wabe:k:${[adresse(q, r), adresse(q + a[0], r + a[1]), adresse(q + b[0], r + b[1])].sort().join(':')}:e${ebene}`;
}

function bauen(werte: Record<string, number>, saat: number): TraegerPlan {
	const ringe = werte.ringe ?? 2,
		lagen = werte.lagen ?? 7;
	const stufen = werte.stufen ?? 2,
		aufbau = werte.aufbau ?? 1;
	const belegung = werte.belegung ?? 0.2;
	const plan: TraegerPlan = {
		version: 1,
		familie: 'wabe',
		saat: saat >>> 0,
		werte: { ringe, lagen, stufen, aufbau, belegung },
		knoten: [],
		kanten: [],
		flaechen: [],
		zellen: [],
		belegung: {}
	};
	const knoten = new Set<string>(),
		kanten = new Set<string>();
	const flaechen = new Map<string, string>();
	const dachDecks = new Set<string>();
	for (let q = -ringe; q <= ringe; q++) {
		for (let r = -ringe; r <= ringe; r++) {
			const ring = abstand(q, r);
			if (ring > ringe || (aufbau === 0 && (q !== 1 || r !== 0))) continue;
			// Discrete: other end states remove whole prisms, never deformed remnant cells.
			const hoehe = Math.max(1, lagen - stufen * Math.max(0, ring - 1));
			for (let l = 0; l < hoehe; l++) {
				const zelle = `wabe:z:${adresse(q, r)}l${l}`;
				const ringKnoten = (ebene: number) =>
					Array.from({ length: 6 }, (_, i) => {
						const id = ecke(q, r, i, ebene);
						if (!knoten.has(id)) {
							knoten.add(id);
							const winkel = (i * Math.PI) / 3;
							const p: Vec3 = [
								SEITE_M * (1.5 * q + Math.cos(winkel)),
								SEITE_M * (Math.sqrt(3) * (r + q / 2) + Math.sin(winkel)),
								ebene * LAGENHOEHE_M
							];
							plan.knoten.push({ id, p, rolle: ebene === 0 ? 'lager' : 'frei' });
						}
						return id;
					});
				const unten = ringKnoten(l),
					oben = ringKnoten(l + 1);
				const rings = [
					unten.slice().reverse(),
					oben,
					...unten.map((a, i) => [a, unten[(i + 1) % 6], oben[(i + 1) % 6], oben[i]])
				];
				const ids = rings.map((faceRing, i) => {
					const key = JSON.stringify([...faceRing].sort());
					let id = flaechen.get(key);
					if (!id) {
						id =
							i < 2
								? `wabe:f:${adresse(q, r)}:e${l + i}`
								: `wabe:f:${adresse(q, r)}l${l}:s${i - 2}`;
						flaechen.set(key, id);
						// Transparent walls keep the cell cluster legible even with an envelope.
						plan.flaechen.push({
							id,
							knoten: faceRing,
							rolle: ring === 0 && i < 2 ? 'offen' : i < 2 ? 'boden' : 'glas'
						});
					}
					for (let j = 0; j < faceRing.length; j++) {
						const a = faceRing[j],
							b = faceRing[(j + 1) % faceRing.length],
							edge = kantenId(a, b);
						if (kanten.has(edge)) continue;
						kanten.add(edge);
						plan.kanten.push({
							id: edge,
							a,
							b,
							rolle: a.split(':e')[1] === b.split(':e')[1] ? 'nebenstab' : 'stab'
						});
					}
					return id;
				});
				plan.zellen.push({
					id: zelle,
					flaechen: ids,
					volumenM3: ((3 * Math.sqrt(3)) / 2) * SEITE_M ** 2 * LAGENHOEHE_M,
					...(ring === 0 ? { nutzung: 'schacht' as const } : {})
				});
				if (ring > 0 && l === hoehe - 1 && hoehe < lagen) dachDecks.add(ids[1]);
			}
		}
	}
	// Rooms and roof gardens have separate targets: a garden never colors the room below.
	plan.belegung = belege(plan, saat, 'wabe', {
		anteil: belegung,
		stroeme: ['people', 'material'],
		ziele: plan.zellen.filter((z) => z.nutzung !== 'schacht').map((z) => z.id)
	});
	Object.assign(
		plan.belegung,
		belege(plan, saat, 'wabe', {
			anteil: 0.25,
			stroeme: ['food'],
			ziele: [...dachDecks]
		})
	);
	for (const z of plan.zellen.filter((z) => z.nutzung === 'schacht')) plan.belegung[z.id] = 'leer';
	return plan;
}

export const wabe: TraegerFamilie = {
	id: 'wabe',
	parameter: [
		{
			art: 'diskret',
			id: 'ringe',
			label: 'Rings',
			optionen: [1, 2, 3].map((wert) => ({ wert, label: String(wert) })),
			start: 2
		},
		{
			art: 'diskret',
			id: 'lagen',
			label: 'Layers',
			optionen: [1, 3, 5, 7].map((wert) => ({ wert, label: String(wert) })),
			start: 7
		},
		{
			art: 'diskret',
			id: 'stufen',
			label: 'Terrace steps',
			optionen: [0, 1, 2].map((wert) => ({ wert, label: String(wert) })),
			start: 2
		},
		{
			art: 'stetig',
			id: 'belegung',
			label: 'Occupancy',
			min: 0,
			max: 1,
			schritt: 0.01,
			start: 0.2,
			einheit: ''
		},
		// Discrete loop construction helper.
		{
			art: 'diskret',
			id: 'aufbau',
			verborgen: true,
			label: 'Build-up',
			optionen: [
				{ wert: 0, label: 'Cell' },
				{ wert: 1, label: 'Cluster' }
			],
			start: 1
		}
	],
	planen: bauen,
	loop: (familienTexte.find((t) => t.id === 'wabe')?.schritte ?? []).map((s, i) => ({
		name: s.name,
		werte: {
			aufbau: i === 0 ? 0 : 1,
			ringe: i < 2 ? 1 : 2,
			lagen: i < 2 ? 1 : 7,
			stufen: i === 3 ? 2 : 0,
			belegung: 0.2
		},
		ansicht: i === 3 ? 'belegt' : 'geruest',
		dauerS: 4
	}))
};
