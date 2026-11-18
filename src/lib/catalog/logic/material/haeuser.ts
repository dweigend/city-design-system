/**
 * Reference-shaped building studies in meters (x right, y depth with the entrance face at −y,
 * z up). Houses stand directly on the stage ground; the comparison changes one finish only.
 */
import type { MaterialHausId } from '../../data/materialHaeuser';
import type { Stueck, Vec3 } from './formen';
import { beton, block, graphit, hausRezept, kiste, moebel, type Haut } from './hausBausteine';

const holz: Haut = { familie: 'holz', finish: 'holz-aufrecht' };
const kalk: Haut = { familie: 'metall', strom: 'food', finish: 'metall-kalkgruen' };
const scheit: Haut = { familie: 'holz', finish: 'holz-natur' };

/** Six round-ended logs stacked against the footing, running along y. */
function holzstapel(): Stueck[] {
	const r = 0.12;
	const lagen = [[-2.32, -2.04, -1.76], [-2.18, -1.9], [-2.04]];
	return lagen.flatMap((reihe, ebene) =>
		reihe.map((x, i) =>
			block(`log-${ebene}-${i}`, [2 * r, 0.95, 2 * r], [x, -2.98, ebene * r * 1.72], scheit, {
				art: 'fase',
				radius: r
			})
		)
	);
}

function holzhaus(anders: boolean): Stueck[] {
	const haut = anders ? beton : holz;
	return [
		block('lime-footing-right', [3.1, 5, 1.5], [0.95, 0, 0], kalk),
		block('lime-footing-left', [0.9, 5, 1.5], [-2.05, 0, 0], kalk),
		block('entry-recess', [1.0, 4.1, 1.5], [-1.1, 0.45, 0], beton),
		block('entry-door', [0.62, 0.05, 1.22], [-1.1, -1.625, 0], graphit),
		block('concrete-band', [5, 5, 0.55], [0, 0, 1.5], beton),
		...kiste(
			'timber',
			[5, 5, 2.95],
			[0, 0, 2.05],
			haut,
			[
				[0.14, 0.52, 0.15, 0.21],
				[0.5, 0.66, 0.1, 0.14],
				[0.74, 0.24, 0.14, 0.19]
			],
			[
				[0.1, 0.56, 0.16, 0.22],
				[0.44, 0.24, 0.13, 0.18],
				[0.72, 0.6, 0.15, 0.2]
			]
		),
		...holzstapel()
	];
}

/** Thin graphite frame: about 0.7 % of the pavilion width. */
function glasrahmen(): Stueck[] {
	const s = 0.04,
		x0 = 2.8,
		y0 = 2.2,
		h = 3.2,
		boden = 0.12;
	const pfosten: [number, number][] = [
		[-x0, -y0],
		[-0.93, -y0],
		[0.93, -y0],
		[x0, -y0],
		[x0, 0]
	];
	const posts = pfosten.map(([x, y], i) =>
		block(`mullion-${i}`, [s, s, h], [x, y, boden], graphit)
	);
	const riegel = [boden, 1.75, boden + h - s].flatMap((z, i) => [
		block(`front-rail-${i}`, [2 * x0 + s, s, s], [0, -y0, z], graphit),
		block(`side-rail-${i}`, [s, 2 * y0, s], [x0, 0, z], graphit)
	]);
	return [
		...posts,
		...riegel,
		block('left-top-rail', [s, 2 * y0, s], [-x0, 0, boden + h - s], graphit)
	];
}

function glashaus(anders: boolean): Stueck[] {
	const glas: Haut = { familie: 'glas', finish: anders ? 'glas-matt' : 'glas-klar' };
	return [
		block('floor', [5.64, 4.44, 0.12], [0, 0, 0], beton),
		block('back-wall', [5.84, 0.3, 3.55], [0, 2.37, 0], beton),
		block('front-glass', [5.56, 0.03, 3.16], [0, -2.2, 0.14], glas),
		block('side-glass', [0.03, 4.36, 3.16], [2.8, 0, 0.14], glas),
		block('left-glass', [0.03, 4.36, 3.16], [-2.8, 0, 0.14], glas),
		block('glass-roof', [5.6, 4.4, 0.03], [0, 0, 3.32], { familie: 'glas' }),
		block('interior-core', [1.35, 1.35, 2.45], [-0.1, 0.55, 0.12], {
			familie: 'metall',
			strom: 'people',
			finish: 'metall-signalrot'
		}),
		block('front-sofa', [1.5, 0.62, 0.4], [-1.6, -1.15, 0.12], moebel),
		block('front-sofa-back', [1.5, 0.16, 0.72], [-1.6, -0.76, 0.12], moebel),
		block('side-sofa', [0.62, 1.3, 0.4], [1.95, 0.9, 0.12], moebel),
		block('blue-vessel', [0.34, 0.34, 0.5], [1.5, -1.35, 0.12], {
			familie: 'keramik',
			strom: 'water'
		}),
		block('green-lamp', [0.2, 0.2, 0.62], [-0.55, -1.6, 0.12], kalk),
		...glasrahmen()
	];
}

function mineralhaus(anders: boolean): Stueck[] {
	const haut: Haut = {
		familie: 'beton',
		strom: 'energy',
		finish: anders ? 'beton-schalung' : 'beton-terrazzo'
	};
	return [
		...kiste(
			'lower',
			[4.2, 3.6, 2.7],
			[0.25, 0, 0],
			haut,
			[],
			[[0.42, 0.38, 0.15, 0.24]],
			[0.58, 0.2, 0.62]
		),
		...kiste(
			'middle',
			[3.3, 3.1, 2.5],
			[-0.25, 0.2, 2.7],
			haut,
			[[0.24, 0.38, 0.17, 0.26]],
			[[0.36, 0.38, 0.19, 0.26]]
		),
		...kiste(
			'upper',
			[2.4, 2.4, 2.2],
			[0.2, 0.45, 5.2],
			haut,
			[[0.56, 0.4, 0.22, 0.28]],
			[[0.3, 0.4, 0.22, 0.28]]
		)
	];
}

function bemalthaus(anders: boolean): Stueck[] {
	const koerper: Haut = { familie: 'keramik', strom: 'people', finish: 'keramik-ton' };
	const lack: Haut = anders
		? { familie: 'metall', strom: 'water', finish: 'metall-lackiert' }
		: { familie: 'kunststoff', strom: 'water', finish: 'kunststoff-guss' };
	const [w, d, h]: Vec3 = [4.4, 3.8, 5.8];
	return [
		...kiste('body', [w - 0.2, d - 0.2, h - 0.045], [0, 0, 0], koerper, [], [], [0.56, 0.24, 0.27]),
		block('coating', [w, d, h], [0, 0, 0], lack, { art: 'lackfilm', saat: 57 }),
		kugel('accent-sphere', 0.5, [2.4, -0.35, 1.9], { familie: 'keramik', strom: 'water' }),
		kugel('accent-bead', 0.23, [-1.15, -1.88, 2.6], { familie: 'keramik', strom: 'water' })
	];
}

function kugel(id: string, r: number, [x, y, z]: Vec3, haut: Haut): Stueck {
	return {
		id,
		teil: { art: 'kugel', mass: [r, r, r], lage: [x, y, z], rolle: 'neu' },
		rezept: hausRezept(haut),
		ausfuehrung: haut.finish
	};
}

function geaderthaus(anders: boolean): Stueck[] {
	const stein: Haut = { familie: 'beton', finish: anders ? 'beton-schalung' : 'beton-geadert' };
	return [
		block('slab', [5.3, 5.3, 0.14], [0, 0, 0], beton),
		block('veined-block', [4.5, 4.5, 4.9], [0, 0, 0.14], stein, { art: 'brocken', saat: 23 })
	];
}

const haeuser = {
	timber: holzhaus,
	glazed: glashaus,
	aggregate: mineralhaus,
	painted: bemalthaus,
	veined: geaderthaus
};

/** Builds the selected house in meters. The optional comparison changes finish only.
 * Each call returns newly owned parts in stable order; positions and IDs do not depend on finish.
 */
export function materialHaus(id: MaterialHausId, anders = false): Stueck[] {
	return haeuser[id](anders);
}
