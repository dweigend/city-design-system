/** Deterministic construction studies in meters: x right, y depth, z up. */
import type { AusfuehrungId } from '../../data/materialAusfuehrung';
import type { FamilieId } from '../../data/materialSeite';
import { ausfuehrungenVon } from './ausfuehrung';
import type { Stueck, Vec3 } from './formen';
import { rezept, voreinstellung, type Rezept, type Strom, type Wahl } from './rezept';
import { referenzTeile, type BauTeil } from './referenzStudien';

const fase = { art: 'fase', radius: 0.035 } as const;

function teil(b: BauTeil, r: Rezept, support = false): Stueck {
	return {
		id: b.name,
		teil: {
			art: 'quader',
			mass: [...b.mass],
			lage: [...b.lage],
			rolle: support ? 'bestand' : 'neu',
			profil: { ...(b.profil ?? fase) }
		},
		rezept: r
	};
}

function fest(
	name: string,
	mass: Vec3,
	lage: Vec3,
	fam: FamilieId = 'bestand',
	strom: Strom = 'neutral'
): Stueck {
	return teil({ name, mass, lage }, rezept(fam, voreinstellung(fam, strom)), true);
}

function sockel(): Stueck {
	return fest('plinth', [6.2, 4.6, 0.22], [0, 0, 0]);
}

function metall(): BauTeil[] {
	return [
		{
			name: 'perforated-screen',
			mass: [3.1, 0.12, 2.9],
			lage: [-0.8, 0.7, 0.22],
			profil: { art: 'lochplatte' }
		},
		{
			name: 'folded-screen',
			mass: [1.6, 0.38, 2.3],
			lage: [1.7, 0.7, 0.22],
			profil: { art: 'faltblech' }
		},
		{
			name: 'open-tube',
			mass: [0.8, 0.8, 1.7],
			lage: [1.3, -1.1, 0.22],
			profil: { art: 'rohr', wand: 0.065 }
		}
	];
}

function mineral(fam: FamilieId): BauTeil[] {
	if (fam === 'keramik')
		return [
			{
				name: 'clay-shell',
				mass: [2.1, 2.1, 1.7],
				lage: [-1.35, 0.1, 0.22],
				profil: { art: 'rohr', wand: 0.15 }
			},
			...[0, 1, 2].map((i) => ({
				name: `glazed-tile-${i}`,
				mass: [1.55, 0.34, 0.72] as Vec3,
				lage: [1.25, 0.2, 0.22 + i * 0.77] as Vec3
			}))
		];
	return [
		{
			name: 'cast-block',
			mass: [2.6, 2.5, 2.5],
			lage: [-1.25, 0.15, 0.22],
			profil: { art: 'fase', radius: 0.09 }
		},
		{ name: 'cut-slab', mass: [1.75, 2.1, 0.35], lage: [1.35, 0.2, 0.22] },
		{ name: 'standing-slab', mass: [1.75, 0.34, 2.0], lage: [1.35, 0.95, 0.57] }
	];
}

function holz(): BauTeil[] {
	const boards: BauTeil[] = Array.from({ length: 5 }, (_, i) => ({
		name: `deck-board-${i}`,
		mass: [4.1, 0.55, 0.2],
		lage: [0, (i - 2) * 0.59, 0.46],
		profil: { art: 'fase', radius: 0.018 }
	}));
	return [
		...[-1, 1].map((y, i) => ({
			name: `deck-runner-${i}`,
			mass: [4.1, 0.18, 0.24] as Vec3,
			lage: [0, y, 0.22] as Vec3
		})),
		...boards,
		{ name: 'long-grain-beam', mass: [3.8, 0.65, 0.65], lage: [0, 0.65, 1.35] },
		{ name: 'front-cut-end', mass: [1.1, 0.85, 0.85], lage: [1.15, -0.65, 0.66] },
		...[-1.5, 1.5].map((x, i) => ({
			name: `beam-support-${i}`,
			mass: [0.3, 0.65, 0.69] as Vec3,
			lage: [x, 0.65, 0.66] as Vec3
		}))
	];
}

function bestand(): BauTeil[] {
	const parts: BauTeil[] = [];
	// Two storeys with an offset upper footprint, open window reveals and recessed rear walls.
	for (const [i, level] of [
		{ w: 4.8, d: 2.8, h: 1.8, x: 0, y: 0, z: 0.22 },
		{ w: 3.2, d: 1.9, h: 1.5, x: -0.6, y: 0.35, z: 2.05 }
	].entries()) {
		const { w, d, h, x, y, z } = level;
		parts.push({ name: `stock-floor-${i}`, mass: [w, d, 0.1], lage: [x, y, z] });
		parts.push({
			name: `stock-facade-${i}`,
			mass: [w, 0.22, h - 0.1],
			lage: [x, y - d / 2 + 0.11, z + 0.1],
			profil: { art: 'fassade' }
		});
		parts.push({
			name: `stock-rear-${i}`,
			mass: [w, 0.18, h - 0.1],
			lage: [x, y + d / 2 - 0.09, z + 0.1]
		});
		for (const sign of [-1, 1])
			parts.push({
				name: `stock-return-${i}-${sign}`,
				mass: [0.18, d - 0.4, h - 0.1],
				lage: [x + sign * (w / 2 - 0.09), y, z + 0.1]
			});
		parts.push({ name: `stock-roof-${i}`, mass: [w + 0.08, d + 0.08, 0.1], lage: [x, y, z + h] });
	}
	return parts;
}

function optik(r: Rezept): Stueck[] {
	const pieces = [sockel()];
	pieces.push(
		teil(
			{
				name: 'optical-panel',
				mass: [4.3, 0.13, 2.65],
				lage: [0, -0.8, 0.3],
				profil: { art: 'fase', radius: 0.025 }
			},
			r
		)
	);
	for (const [i, strom] of (['people', 'energy', 'food'] as const).entries()) {
		pieces.push(
			fest(
				`interior-${i}`,
				[0.7, 0.7, 0.8 + i * 0.48],
				[(i - 1) * 1.25, 0.6, 0.22],
				'keramik',
				strom
			)
		);
	}
	for (const [i, x] of [-2.25, 0, 2.25].entries()) {
		pieces.push(fest(`mullion-${i}`, [0.065, 0.2, 2.85], [x, -0.8, 0.22], 'metall'));
	}
	pieces.push(fest('top-rail', [4.56, 0.2, 0.075], [0, -0.8, 3.0], 'metall'));
	pieces.push(fest('bottom-rail', [4.56, 0.2, 0.075], [0, -0.8, 0.22], 'metall'));
	// Open sides and back allow orbiting into the display; no opaque box encloses the targets.
	return pieces;
}

/** Deep four-lobed enclosure on the plinth (refs 4 and 8); light seam ribbons pinch the lobes. */
function membran(r: Rezept): Stueck[] {
	const mass: Vec3 = [5.8, 4.4, 2.7];
	const lage: Vec3 = [0, 0, 0.22];
	return [
		sockel(),
		teil({ name: 'inflated-envelope', mass, lage, profil: { art: 'kissen', form: 'kreuz' } }, r),
		teil(
			{ name: 'welded-seam-relief', mass, lage, profil: { art: 'naht', form: 'kreuz' } },
			rezept('bestand', voreinstellung('bestand', 'neutral')),
			true
		)
	];
}

function wasser(r: Rezept): Stueck[] {
	return [
		sockel(),
		fest('basin-bottom', [4.8, 3.3, 0.16], [0, 0, 0.22], 'beton'),
		...[-1, 1].flatMap((sign) => [
			fest(`basin-bank-x-${sign}`, [0.18, 3.65, 0.55], [sign * 2.5, 0, 0.22], 'beton'),
			fest(`basin-bank-y-${sign}`, [4.82, 0.18, 0.55], [0, sign * 1.74, 0.22], 'beton')
		]),
		// Three broad landing steps descend from the quay under the surface.
		...[0, 1, 2].map((i) =>
			fest(`quay-step-${i}`, [1.05, 0.28, 0.29 - i * 0.09], [-1.2, 1.5 - i * 0.28, 0.38], 'beton')
		),
		teil(
			{
				name: 'water-volume',
				mass: [4.8, 3.3, 0.22],
				lage: [0, 0, 0.43],
				profil: { art: 'fase', radius: 0.015 }
			},
			r
		)
	];
}

function referenzSzene(teile: readonly BauTeil[], r: Rezept, finish?: AusfuehrungId): Stueck[] {
	const teileMitFinish = teile.map((b) => ({ ...teil(b, r), ausfuehrung: finish }));
	if (finish !== 'glas-photovoltaik') return [sockel(), ...teileMitFinish];
	const traeger = fest('array-frame', [3.61, 2.43, 0.33], [-0.5, 0.6, 0.22], 'metall');
	return [sockel(), traeger, ...teileMitFinish];
}

/**
 * Detached native construction specimen for a valid family and lab choice. Stable part order/IDs,
 * no RNG or mutation, meters, fewer than 40 parts. Only featured parts receive the choice;
 * supports/interior retain fixed recipes. A named reference finish can select dedicated pieces.
 */
export function probeSzene(fam: FamilieId, wahl: Wahl, finish?: AusfuehrungId): Stueck[] {
	// Standalone consumers own each part's recipe independently.
	return probeMitRezept(rezept(fam, wahl), finish).map((s) => ({
		...s,
		rezept: structuredClone(s.rezept)
	}));
}

/** Places one resolved recipe on the specimen's featured pieces. Supports keep their authored recipes. */
export function probeMitRezept(r: Rezept, finish?: AusfuehrungId): Stueck[] {
	const fam = r.familie;
	const referenz = referenzTeile(finish);
	if (referenz && ausfuehrungenVon(fam).some((a) => a.id === finish))
		return referenzSzene(referenz, r, finish);
	if (fam === 'glas' || fam === 'kunststoff') return optik(r);
	if (fam === 'membran') return membran(r);
	if (fam === 'wasser') return wasser(r);
	let parts: BauTeil[];
	switch (fam) {
		case 'metall':
			parts = metall();
			break;
		case 'holz':
			parts = holz();
			break;
		case 'bestand':
			parts = bestand();
			break;
		default:
			parts = mineral(fam);
	}
	return [sockel(), ...parts.map((b) => teil(b, r))];
}

/**
 * Original courtyard observatory: offset glazed lantern, timber walk, perforated wind screen,
 * pneumatic canopy and shallow reflecting channel. Detached, deterministic meters, stable order,
 * fixed native finishes and accents; no inputs, RNG, mutations or external resources. 31 parts.
 */
export function mischSzene(): Stueck[] {
	const pieces = [fest('court-foundation', [7.6, 6, 0.25], [0, 0, 0], 'beton')];
	for (let i = 0; i < 5; i++)
		pieces.push(fest(`walk-${i}`, [3, 0.84, 0.14], [-1.7, (i - 2) * 0.88, 0.25], 'holz'));
	pieces.push(fest('rear-service-volume', [2.55, 0.8, 2.8], [1.45, 1.85, 0.25], 'bestand'));
	pieces.push(fest('rear-cap', [2.75, 1, 0.12], [1.45, 1.85, 3.05], 'metall'));
	pieces.push(
		fest('painted-upper-module', [1.5, 1.05, 0.9], [1.9, 1.65, 3.17], 'metall', 'energy')
	);
	pieces.push(
		fest('painted-entry-module', [0.9, 1.2, 1.05], [-2.65, 1.45, 0.39], 'metall', 'people')
	);
	pieces.push(fest('lantern-side-return', [0.12, 1.7, 2.5], [2.76, 0.9, 0.55], 'glas'));
	pieces.push(fest('lantern-roof', [2.6, 1.8, 0.12], [1.5, 0.85, 3.15], 'metall'));
	pieces.push(fest('lantern-base', [2.5, 2.1, 0.3], [1.5, 1, 0.25], 'keramik'));
	pieces.push(
		teil(
			{ name: 'lantern-glass', mass: [2.4, 0.1, 2.5], lage: [1.5, 0, 0.55] },
			rezept('glas', voreinstellung('glas', 'neutral'))
		)
	);
	for (const [i, x] of [0.27, 1.5, 2.73].entries())
		pieces.push(fest(`lantern-post-${i}`, [0.07, 0.14, 2.6], [x, 0, 0.55], 'metall'));
	pieces.push(fest('lantern-lintel', [2.6, 0.17, 0.1], [1.5, 0, 3.1], 'metall'));
	pieces.push(fest('interior-orange', [0.55, 0.6, 1.25], [0.85, 1, 0.55], 'keramik', 'energy'));
	pieces.push(fest('interior-red', [0.55, 0.6, 0.7], [2, 1, 0.55], 'keramik', 'people'));
	pieces.push(
		teil(
			{
				name: 'wind-screen',
				mass: [2.3, 0.12, 2.3],
				lage: [-1.8, 2, 0.39],
				profil: { art: 'lochplatte' }
			},
			rezept('metall', voreinstellung('metall', 'neutral'))
		)
	);
	const roof = { mass: [3, 2.5, 0.85] as Vec3, lage: [-1.1, 0.3, 2.85] as Vec3 };
	pieces.push(
		teil(
			{ name: 'canopy', ...roof, profil: { art: 'kissen' } },
			rezept('membran', voreinstellung('membran', 'water'))
		)
	);
	pieces.push(
		teil(
			{ name: 'canopy-seams', ...roof, profil: { art: 'naht' } },
			rezept('bestand', voreinstellung('bestand', 'neutral')),
			true
		)
	);
	for (const [i, x] of [-2.4, 0.2].entries())
		pieces.push(fest(`canopy-post-${i}`, [0.08, 0.08, 2.55], [x, -0.6, 0.39], 'metall'));
	pieces.push(fest('channel-bottom', [3.3, 1.3, 0.12], [1.4, -1.8, 0.25], 'beton'));
	pieces.push(
		teil(
			{ name: 'channel-water', mass: [3.3, 1.3, 0.16], lage: [1.4, -1.8, 0.42] },
			rezept('wasser', voreinstellung('wasser', 'neutral'))
		)
	);
	for (const [i, y] of [-2.53, -1.07].entries())
		pieces.push(fest(`channel-bank-${i}`, [3.6, 0.16, 0.45], [1.4, y, 0.25], 'beton'));
	for (const [i, x] of [-0.33, 3.13].entries())
		pieces.push(fest(`channel-end-${i}`, [0.16, 1.3, 0.45], [x, -1.8, 0.25], 'beton'));
	return pieces;
}
