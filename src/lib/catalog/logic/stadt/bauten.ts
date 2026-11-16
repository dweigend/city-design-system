/**
 * Shared buildings of the city components: old building with punched facade, tree, base plate.
 * Every part belongs to a step (0 existing stock, 1 conversion, 2 extension); scenes without steps
 * take only the boxes. Dimensions in meters.
 */
import { BESTAND, GRUND, kiste, type Kiste, type Vec3 } from './kiste';

/** Floor height of an old building. */
export const G = 3.5;
/** Floor height of a new build. */
export const GN = 3.2;

export type Teil = { k: Kiste; stufe: 0 | 1 | 2 };

export const b = (k: Kiste): Teil => ({ k, stufe: 0 });
export const u = (k: Kiste): Teil => ({ k, stufe: 1 });
export const e = (k: Kiste): Teil => ({ k, stufe: 2 });

/** Converted floor: a color band around the old building. */
export type Umbau = { geschoss: number; fill: string; target: string };

/**
 * Old building with a punched facade to the south and east. `mansarde` adds a recessed attic floor.
 * Windows of a converted floor sit on the color band, so that the facade stays legible.
 */
export function altbau(
	id: string,
	x: number,
	y: number,
	w: number,
	d: number,
	geschosse: number,
	o: { mansarde?: boolean; umbau?: Umbau[]; target?: string } = {}
): Teil[] {
	const target = o.target ?? 'haus';
	const out: Teil[] = [
		b(
			kiste(`${id}`, [x, y, 0], [w, d, geschosse * G], BESTAND.fill, { edge: BESTAND.edge, target })
		)
	];
	// Cornice
	out.push(
		b(
			kiste(
				`${id}-gesims`,
				[x - 0.3, y - 0.3, geschosse * G],
				[w + 0.6, d + 0.6, 0.35],
				BESTAND.fill,
				{
					edge: BESTAND.edge,
					target
				}
			)
		)
	);
	if (o.mansarde)
		out.push(
			b(
				kiste(
					`${id}-dach`,
					[x + 0.8, y + 1.6, geschosse * G + 0.35],
					[w - 1.6, d - 3.2, 2.6],
					BESTAND.fill,
					{
						edge: BESTAND.edge,
						target
					}
				)
			)
		);
	const umbau = new Map((o.umbau ?? []).map((m) => [m.geschoss, m]));
	for (const m of umbau.values())
		out.push(
			u(
				kiste(
					`${id}-umbau-${m.geschoss}`,
					[x - 0.1, y - 0.1, m.geschoss * G],
					[w + 0.2, d + 0.2, G],
					m.fill,
					{
						target: m.target
					}
				)
			)
		);
	// Windows: dark openings, 1.2 × 2 m, sill height 1 m.
	const nx = Math.max(1, Math.floor(w / 3.2));
	const ny = Math.max(1, Math.floor(d / 3.2));
	for (let g = 0; g < geschosse; g++) {
		const vor = umbau.has(g) ? 0.16 : 0.05;
		const fenster = (fid: string, p: Vec3, s: Vec3) =>
			kiste(fid, p, s, '--ink-3', {
				edge: null,
				flat: true,
				target: umbau.get(g)?.target ?? target
			});
		for (let i = 0; i < nx; i++) {
			const fx = x + ((i + 0.5) * w) / nx - 0.6;
			const teil = fenster(`${id}-fs-${g}-${i}`, [fx, y - vor, g * G + 1], [1.2, 0.04, 2]);
			out.push(umbau.has(g) ? u(teil) : b(teil));
		}
		for (let j = 0; j < ny; j++) {
			const fy = y + ((j + 0.5) * d) / ny - 0.6;
			const teil = fenster(
				`${id}-fo-${g}-${j}`,
				[x + w + vor - 0.04, fy, g * G + 1],
				[0.04, 1.2, 2]
			);
			out.push(umbau.has(g) ? u(teil) : b(teil));
		}
	}
	return out;
}

export function baum(id: string, x: number, y: number): Teil[] {
	const t = { edge: BESTAND.edge, target: 'baum' };
	return [
		b(kiste(`${id}-stamm`, [x - 0.2, y - 0.2, 0], [0.4, 0.4, 3], BESTAND.fill, t)),
		b(kiste(`${id}-krone`, [x - 1.6, y - 1.6, 3], [3.2, 3.2, 3.6], BESTAND.fill, t))
	];
}

/** Ground (courtyard, parcels) and alley as flat slabs. */
export function grund(
	id: string,
	x: number,
	y: number,
	w: number,
	d: number,
	fill: string = GRUND.fill,
	target?: string
): Teil {
	return b(kiste(id, [x, y, -0.3], [w, d, 0.3], fill, { edge: GRUND.edge, target }));
}
