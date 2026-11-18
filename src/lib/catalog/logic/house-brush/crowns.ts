import { STORY } from '../../data/grid';
import { hash } from '../hash-random';
import type { ColorToken, Primitive } from '../parametrik/types';
import { inradius, type QuadCell } from '../quad-grid';
import { accentOf, CHANNEL, part, type Form, type Site } from './form';
import type { Mass, Story } from './massing';
import { storiesOf, type HouseUse } from './stacks';

/** Share of the cells of a wide roof that carry a small crown. */
const SMALL_CROWN_SHARE = 0.22;
const FIGURE_SHARE = { small: 0.52, solo: 0.62 };
const PLINTH = { width: 0.72, height: 0.38 };
const COLLAR = { width: 0.84, height: 0.2 };

const TANK = { center: 1.02, squash: 0.75, lidLevel: 1.7, lidWidth: 0.38, lidHeight: 0.16 };
const HALO = { center: 0.84, bore: 0.5, depth: 0.38 };
const VAULT_SPAN = 1.4;
const CONE_HEIGHT = 1.45;

/** Compositions in multiples of the seat radius. Rings stand upright on their pedestal. */
function figure(use: HouseUse, cell: QuadCell, z: number, r: number, turn: number): Piece[] {
	const [x, y] = cell.center;
	const at = (level: number): [number, number, number] => [x, y, z + level * r];
	const disc = (level: number, width: number, height: number): Form => ({
		kind: 'cylinder',
		position: at(level),
		radius: width * r,
		height: height * r
	});
	const plinth = disc(0, PLINTH.width, PLINTH.height);
	const collar = disc(PLINTH.height, COLLAR.width, COLLAR.height);
	const shoulder = PLINTH.height + COLLAR.height;
	const paper = (form: Form): Piece => ({ form, token: '--paper' });
	switch (use) {
		case 'living':
			return [
				paper(plinth),
				paper(collar),
				paper({ kind: 'dome', position: at(shoulder), radius: r })
			];
		case 'water':
			return [
				paper(plinth),
				{ form: { kind: 'sphere', position: at(TANK.center), radius: r, squash: TANK.squash } },
				paper(disc(TANK.lidLevel, TANK.lidWidth, TANK.lidHeight))
			];
		case 'energy':
			return [
				{ form: plinth },
				paper(collar),
				{
					form: {
						kind: 'ring',
						position: at(shoulder + HALO.center),
						radius: r,
						innerRadius: r * HALO.bore,
						depth: r * HALO.depth,
						rotation: turn
					}
				}
			];
		case 'food':
			return [
				paper(plinth),
				{ form: collar },
				{
					form: {
						kind: 'vault',
						position: at(shoulder),
						width: r * VAULT_SPAN,
						length: r * VAULT_SPAN,
						rise: r,
						rotation: turn
					}
				}
			];
		case 'material':
			return [
				{ form: plinth },
				paper(collar),
				{ form: { kind: 'cone', position: at(shoulder), radius: r, height: r * CONE_HEIGHT } }
			];
	}
}

type Piece = { token?: ColorToken; form: Form };

/** Stories of the mass that lie open to the sky. */
function roofStories(site: Site, mass: Mass): Story[] {
	return mass.stories.filter(
		(story) => storiesOf(site.stacks, story.cell.id).length === story.level + 1
	);
}

/**
 * Crowns of a mass. A mass of one cell gets the solo figure; wider roofs get small figures
 * on a seeded share of their cells. Deterministic per cell.
 */
export function crowns(site: Site, mass: Mass, roofHeight: number): Primitive[] {
	const solo = mass.stories.length === 1;
	const top = mass.floor + STORY + roofHeight;
	const exposed = roofStories(site, mass);
	const selected = exposed.filter(
		({ cell }) => solo || hash(site.seed, cell.index, CHANNEL.crown) < SMALL_CROWN_SHARE
	);
	if (roofHeight > 0 && !selected.length) selected.push(exposed[0]);
	return selected.flatMap((story) => {
		const cell = story.cell;
		const [a, b] = cell.corners;
		const quarter = Math.floor(hash(site.seed, cell.index, CHANNEL.crownTurn) * 4);
		const turn = Math.atan2(b[1] - a[1], b[0] - a[0]) + (quarter * Math.PI) / 2;
		const radius = inradius(cell) * (solo ? FIGURE_SHARE.solo : FIGURE_SHARE.small);
		return figure(mass.use, cell, top, radius, turn).map(({ token, form }, k) => ({
			...part(
				`${story.cell.id}@${story.level}:crown${k}`,
				token ?? accentOf(mass.use) ?? '--paper',
				form
			),
			detail: true
		}));
	});
}
