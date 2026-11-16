import { kantenId, type TraegerFamilie, type TraegerPlan } from '../plan';
import { belege } from '../belegung';
/** Cell cluster after city_game: prototype/src/lib/experiments/volume-houses/core/volume-grid.ts.
 * Rule-path IDs replace the coordinate-based keys used there. Layers are independent decks. */
export const orthogonal: TraegerFamilie = {
	id: 'orthogonal',
	parameter: [
		{
			art: 'diskret',
			id: 'lagen',
			label: 'Layers',
			optionen: [1, 2, 3].map((wert) => ({ wert, label: String(wert) })),
			start: 2
		},
		{
			art: 'stetig',
			id: 'versatz',
			label: 'Offset',
			min: 0,
			max: 1,
			schritt: 0.01,
			start: 0.5,
			einheit: ''
		}
	],
	planen(werte, saat) {
		const lagen = Math.max(1, Math.min(3, Math.round(werte.lagen ?? 2))),
			versatz = Math.max(0, Math.min(1, werte.versatz ?? 0.5));
		const p: TraegerPlan = {
			version: 1,
			familie: 'orthogonal',
			saat: saat >>> 0,
			werte: { lagen, versatz },
			knoten: [],
			kanten: [],
			flaechen: [],
			zellen: [],
			belegung: {}
		};
		const edges = new Set<string>(),
			faces = new Map<string, string>();
		for (let l = 0; l < lagen; l++) {
			const node = (x: number, y: number, z: number) => `orthogonal:k:${l}:${x}:${y}:${z}`;
			for (let z = 0; z < 2; z++)
				for (let y = 0; y < 4; y++)
					for (let x = 0; x < 4; x++)
						p.knoten.push({
							id: node(x, y, z),
							p: [3.5 * (x + (l === lagen - 1 && l > 0 ? versatz : 0)), y * 3.5, (l + z) * 3.5],
							rolle: l === 0 && z === 0 ? 'lager' : 'frei'
						});
			for (let y = 0; y < 3; y++)
				for (let x = 0; x < 3; x++) {
					const a = node(x, y, 0),
						b = node(x + 1, y, 0),
						c = node(x + 1, y + 1, 0),
						d = node(x, y + 1, 0),
						e = node(x, y, 1),
						f = node(x + 1, y, 1),
						g = node(x + 1, y + 1, 1),
						h = node(x, y + 1, 1);
					const rings = [
						[d, c, b, a],
						[e, f, g, h],
						[a, b, f, e],
						[b, c, g, f],
						[c, d, h, g],
						[d, a, e, h]
					];
					const zId = `orthogonal:z:${l}:${x}:${y}`;
					const flaechen = rings.map((knoten, i) => {
						const key = JSON.stringify([...knoten].sort());
						let id = faces.get(key);
						if (!id) {
							id = `orthogonal:f:${l}:${x}:${y}:${i}`;
							faces.set(key, id);
							p.flaechen.push({ id, knoten, rolle: i < 2 ? 'boden' : 'paneel' });
						}
						for (let j = 0; j < 4; j++) {
							const a = knoten[j],
								b = knoten[(j + 1) % 4],
								id = kantenId(a, b);
							if (!edges.has(id)) {
								edges.add(id);
								p.kanten.push({ id, a, b, rolle: 'stab' });
							}
						}
						return id;
					});
					p.zellen.push({ id: zId, flaechen, volumenM3: 3.5 ** 3 });
				}
		}
		p.belegung = belege(p, saat, 'orthogonal', {
			anteil: 0.35,
			stroeme: ['people', 'food', 'water']
		});
		return p;
	},
	loop: [
		{ name: 'Grid', werte: { lagen: 1, versatz: 0 }, ansicht: 'geruest', dauerS: 4 },
		{ name: 'Layers', werte: { lagen: 2, versatz: 0 }, ansicht: 'huelle', dauerS: 4 },
		{ name: 'Offset', werte: { lagen: 2, versatz: 0.5 }, ansicht: 'huelle', dauerS: 4 },
		{ name: 'Rooms', werte: { lagen: 2, versatz: 0.5 }, ansicht: 'belegt', dauerS: 4 }
	]
};
