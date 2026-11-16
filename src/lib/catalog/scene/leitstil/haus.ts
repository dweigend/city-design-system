import type { Bauplan } from '../../logic/haus-tragwerk';
import type { Ansicht } from '../../logic/traeger';
import type { Koerper, LeitstilSzene, Stab, Vec3 } from '../../logic/leitstil';

/** Checks without mutation whether the existing house-style adapter can render the plan. */
export function hatHausLeitstil(
	haus: Bauplan
): haus is Bauplan & Required<Pick<Bauplan, 'statik' | 'bestand'>> {
	return haus.familie === 'raumfachwerk' && !!haus.statik && !!haus.bestand;
}

/** Read-only projection of the computed bridge house, metres. No sizing or RNG here.
 * The near facade is cut away to show use behind the white shell. Rounded footprints remain.
 */
export function hausLeitstil(haus: Bauplan, ansicht: Ansicht): LeitstilSzene {
	if (!hatHausLeitstil(haus))
		throw new RangeError(
			'The house-style adapter requires a computed space frame with existing stock.'
		);
	const statik = haus.statik;
	const ort = new Map(haus.traeger.knoten.map((n) => [n.id, n.p]));
	const punkt = (id: string) => {
		const p = ort.get(id);
		if (!p) throw new RangeError(`Missing carrier node ${id}`);
		return p;
	};
	const staebe: Stab[] = haus.traeger.kanten.flatMap((k) => {
		const s = statik.staebe[k.id];
		return s
			? [
					{
						a: punkt(k.a),
						b: punkt(k.b),
						durchmesser: s.durchmesserM,
						art: s.druck ? ('druck' as const) : ('zug' as const)
					}
				]
			: [];
	});
	const bewohnt = haus.einbauten.some((e) =>
		haus.anschluesse.some((a) => a.id === e.anschlussId && a.art === 'raum')
	);
	// The structural-frame view omits the capsule, so its hangers and braces have no visible attachment.
	if (bewohnt && ansicht !== 'geruest')
		for (const h of haus.statik.haenger)
			staebe.push({
				a: punkt(h.knotenId),
				b: h.p,
				durchmesser: h.durchmesserM,
				art: h.druck ? 'druck' : 'zug'
			});
	const koerper: Koerper[] = [];
	const prisma = (
		polygon: readonly (readonly [number, number])[],
		z: number,
		hoehe: number,
		rolle: Koerper['rolle'],
		strom?: Koerper['strom'],
		teil?: Koerper['teil']
	) => {
		koerper.push({
			rolle,
			strom,
			teil,
			polygon,
			min: [Math.min(...polygon.map((p) => p[0])), Math.min(...polygon.map((p) => p[1])), z],
			max: [Math.max(...polygon.map((p) => p[0])), Math.max(...polygon.map((p) => p[1])), z + hoehe]
		});
	};
	if (ansicht !== 'geruest')
		for (const e of haus.einbauten) {
			const a = haus.anschluesse.find((a) => a.id === e.anschlussId);
			if (!a) continue;
			if (a.art === 'garten') {
				// Open roof use, inset to retain the white perimeter of the shell.
				const xs = a.polygon.map((p) => p[0]),
					ys = a.polygon.map((p) => p[1]);
				const x = Math.min(...xs) + 1.5,
					X = Math.max(...xs) - 1.5;
				const y = Math.min(...ys) + 0.35,
					Y = Math.max(...ys) - 0.35;
				if (ansicht === 'belegt')
					prisma(
						[
							[x, y],
							[X, y],
							[X, Y],
							[x, Y]
						],
						a.z + 0.13,
						0.15,
						'raum',
						e.nutzung,
						'nutzflaeche'
					);
				continue;
			}
			prisma(a.polygon, a.z - 0.16, 0.16, 'huelle');
			prisma(a.polygon, a.z + a.hoeheM, 0.12, 'huelle');
			for (let i = 0; i < a.polygon.length; i++) {
				const p = a.polygon[i],
					q = a.polygon[(i + 1) % a.polygon.length];
				// Rear half of the real capsule perimeter; near half is the explicit section.
				if ((p[1] + q[1]) / 2 <= 0) continue;
				prisma([p, q, [q[0], q[1] - 0.08], [p[0], p[1] - 0.08]], a.z, a.hoeheM, 'huelle');
			}
			if (ansicht === 'belegt') {
				prisma(a.polygon, a.z + 0.01, 0.03, 'raum', e.nutzung, 'boden');
				const [x, y, z] = a.tuer.p;
				prisma(
					[
						[x - 0.015, y - 0.65],
						[x + 0.015, y - 0.65],
						[x + 0.015, y + 0.65],
						[x - 0.015, y + 0.65]
					],
					z,
					2.1,
					'raum',
					e.nutzung,
					'tuer'
				);
			}
		}
	const bestand = haus.bestand.koerper.map((k) => ({
		min: [k.x, k.y, 0] as Vec3,
		max: [k.x + k.breiteM, k.y + k.tiefeM, 8] as Vec3
	}));
	const minX = Math.min(...bestand.map((k) => k.min[0])) - 2;
	const maxX = Math.max(...bestand.map((k) => k.max[0])) + 2;
	const minY = Math.min(...bestand.map((k) => k.min[1])) - 2;
	const maxY = Math.max(...bestand.map((k) => k.max[1])) + 2;
	const [x, y, z] = haus.eingang.p;
	const tuer = haus.anschluesse.find((a) => a.art === 'raum')?.tuer;
	const [tx, ty] = tuer?.tangente ?? [0, -1];
	return {
		lager: haus.statik.lager.map((l) => {
			const p = punkt(l.knotenId);
			const w = l.art === 'fest' ? 0.6 : 0.9;
			const d = l.art === 'fest' ? 0.6 : 0.36;
			return {
				min: [p[0] - w / 2, p[1] - d / 2, p[2]] as Vec3,
				max: [p[0] + w / 2, p[1] + d / 2, p[2] + 0.14] as Vec3
			};
		}),
		bestand,
		staebe,
		koerper,
		wege: [
			{
				punkte: [
					[x + ty * 4, y - tx * 4, z],
					[x, y, z]
				],
				breite: 1.6
			}
		],
		figuren: [[x + ty * 1.3, y - tx * 1.3, z]],
		insel: { min: [minX, minY, -0.7], max: [maxX, maxY, -0.02] },
		blickziel: [0, 0, 5]
	};
}
