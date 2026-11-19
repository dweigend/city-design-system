import { required } from '../required';
import type { HousePart } from './house-object';
import { roofLanding } from './deck-plan';
import type { HouseSurfaces } from './surfaces';
import type { Vec3 } from '../parametrik/types';
import { plotDeck } from './plot-deck';
import { access } from './access';
import { fitting, mountFitting } from './asset-fit';
import { column, pipeBetween, beam, slab } from './parts';
import type { Section } from './types';

function columns(s: Section, surfaces: HouseSurfaces) {
	const [x, y, z] = s.base,
		r = Math.min(s.width, s.depth) * 0.029;
	const posts = [
		[-0.23, -0.21],
		[0.23, -0.21],
		[-0.23, 0.21],
		[0, 0.21],
		[0.23, 0.21]
	];
	return posts.map(([u, v], i) =>
		column(
			s.id + '/post/' + i,
			[x + u * s.width, y + v * s.depth, z],
			r,
			(v < 0 ? required(s.decks.at(-1), 'upper deck').position[2] : s.top) - z + 0.25,
			surfaces.frame
		)
	);
}
function towers(s: Section, surfaces: HouseSurfaces): HousePart[] {
	if (s.stories < 3) return [];
	const [x, y, z] = s.base,
		h = s.top - z,
		side = Math.min(1.7, s.width * 0.14, s.depth * 0.15);
	const asset = fitting(
		'lattice-mast',
		s.id + '/lattice',
		s.seed,
		'deck',
		{ body: surfaces.frame, frame: surfaces.frame },
		s.stories < 5 ? 'compact' : 'extended'
	);
	const mast = mountFitting(asset, {
		position: [x - s.width * 0.31, y - s.depth * 0.27 + side / 2, z],
		size: [side, side, required(s.decks.at(-1), 'upper deck').position[2] - z + 0.35]
	});
	if (s.typology !== 'tower') return mast;
	const round = s.plan === 'round',
		cx = x + (round ? 0 : s.width * 0.27),
		cy = y + (round ? 0 : s.depth * 0.26);
	const rise = h + Math.min(2.2, side * 1.3);
	const core = round
		? column(s.id + '/core', [cx, cy, z], side * 0.85, rise, surfaces.frame)
		: slab(s.id + '/core', [cx, cy, z], side * 1.5, side * 1.4, rise, 0.04, surfaces.frame);
	return [
		...mast,
		core,
		slab(
			s.id + '/watch',
			[cx, cy, z + rise],
			side * 1.65,
			side * 1.55,
			side * 0.45,
			0.12,
			surfaces.pane
		),
		slab(
			s.id + '/watch-cap',
			[cx, cy, z + rise + side * 0.45],
			side * 1.8,
			side * 1.7,
			0.12,
			0.13,
			surfaces.deck
		)
	];
}
function mastBearings(s: Section, surfaces: HouseSurfaces) {
	if (!s.compact) return [];
	const [x, y] = s.stairAxis,
		centerY = y - 0.38;
	const mast = beam(
		s.id + '/access-mast',
		[x, centerY, s.base[2]],
		[0.5, 0.38, s.top - s.base[2]],
		surfaces.frame
	);
	const arms = s.decks.map((d, i) => {
		const reach = centerY - d.position[1];
		return beam(
			s.id + '/mast-arm/' + i,
			[x, centerY - reach / 2, d.position[2] - 0.18],
			[Math.min(0.18, d.width * 0.15), Math.abs(reach), 0.14],
			surfaces.frame
		);
	});
	return [mast, ...arms];
}
function deckParts(s: Section, surfaces: HouseSurfaces) {
	return s.decks.flatMap(({ position: [x, y, z], width: w, depth: d, round }, i) => {
		if (
			i === 0 &&
			(s.cells.length > 1 ||
				s.cells[0].corners.some(
					([x, y], j, c) => x !== c[(j + 1) % 4][0] && y !== c[(j + 1) % 4][1]
				))
		)
			return plotDeck(s, surfaces.deck);
		const t = Math.min(0.38, w * 0.04, d * 0.055),
			radius = round ? w / 2 : Math.min(w, d) * 0.12;
		return [
			slab(
				s.id + '/soffit/' + i,
				[x, y, z - t],
				w * 0.98,
				d * 0.98,
				t * 0.58,
				radius,
				surfaces.deck
			),
			{
				...slab(s.id + '/deck/' + i, [x, y, z - t * 0.42], w, d, t * 0.42, radius, surfaces.deck),
				roofCell: s.cells[0].id
			}
		];
	});
}
function supplies(s: Section, surfaces: HouseSurfaces) {
	return s.slots
		.filter((slot) => slot.kind === 'reservoir')
		.flatMap((slot, i) => {
			const [x, y, z] = slot.position,
				h = slot.size[2],
				[cx, cy] = s.base;
			const deck =
				s.decks.findLast((d) => d.use === slot.use) ??
				s.decks.findLast((d) => d.programme.includes(slot.use)) ??
				s.decks[0];
			const px = cx + s.width * (0.42 + i * 0.023),
				py = cy + s.depth * (-0.23 + i * 0.032),
				zz = deck.position[2] + 0.25;
			const points: Vec3[] = [
				[x, y, z + h],
				[x, y, z + h + 0.1],
				[px, py, z + h + 0.1],
				[px, py, zz],
				[px, cy + s.depth * 0.2, zz]
			];
			return points
				.slice(1)
				.map((p, j) =>
					pipeBetween(
						slot.id + '/pipe/' + j,
						points[j],
						p,
						Math.min(0.21, s.width * 0.023),
						surfaces[slot.use]
					)
				);
		});
}
/** Projects the continuous frame, tier slabs, access flights and service runs in metres. */
export function houseStructure(s: Section, surfaces: HouseSurfaces) {
	const [x, y] = roofLanding(s);
	const rear = s.base[1] + s.depth * 0.21;
	const beams = [-0.23, 0.23].map((u, i) =>
		beam(
			s.id + '/roof-beam/' + i,
			[s.base[0] + u * s.width, (y + rear) / 2, s.top - 0.35],
			[s.width * 0.035, y - rear + 0.12, 0.19],
			surfaces.frame
		)
	);
	const roof = slab(
		s.id + '/roof-walk',
		[x, y, s.top - 0.18],
		s.width * 0.72,
		s.depth * 0.14,
		0.18,
		0.18,
		surfaces.deck
	);
	return [
		...columns(s, surfaces),
		...mastBearings(s, surfaces),
		...towers(s, surfaces),
		...deckParts(s, surfaces),
		...beams,
		{ ...roof, roofCell: s.cells[0].id },
		...access(s, surfaces),
		...supplies(s, surfaces)
	];
}
