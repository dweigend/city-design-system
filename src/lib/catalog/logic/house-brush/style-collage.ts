import { hash } from '../hash-random';
import { cellKey } from './cell-key';
import { STORY } from '../../data/grid';
import type { Primitive } from '../parametrik/types';
import { collageFigure } from './collage-figure';
import type { Site } from './form';
import { body } from './body';
import { isPlinth } from './ensemble-walls';
import { profileOf } from './profile';
import { printBands } from './print-bands';
import { BODY_TOKEN } from '../../data/house-body';
import { massStoreys, type Mass, type Story } from './massing';
import { MAX_STORIES, storiesOf } from './stacks';

const COLLAGE_DEFAULTS = {
	treeRadius: 0.36,
	treeHeight: 0.94,
	gardenDepth: 0.065
};
const CHANNEL = { figureSeat: 31, figureSide: 32 };

/** A printed colour body: streamlined wall in the use colour, white plate and roof steps. */
function printedBody(site: Site, mass: Mass, profile: ReturnType<typeof profileOf>): Primitive[] {
	const wall = BODY_TOKEN[mass.use];
	const plinth = isPlinth(mass);
	// One roof step only: stacked contours close up to a black cap at town scale.
	const pieces = body(site, mass, profile).filter((piece) => !/:tier[1-9]$/.test(piece.id));
	return pieces.map((piece): Primitive => {
		const coloured =
			!plinth && (/:(wall|foot|deck)$/.test(piece.id) || piece.id.includes(':stilt'));
		return {
			...piece,
			role: 'neu',
			envelope: true,
			token:
				coloured || (!plinth && !!mass.volume && piece.id.endsWith(':plate')) ? wall : '--paper',
			...(mass.volume && piece.id.endsWith(':plate') && { topToken: '--paper' }),
			shade: 0
		};
	});
}

/** Colour body of the painted stories, with one use-bearing figure on an exposed roof. */
export function collageMass(site: Site, mass: Mass, p = COLLAGE_DEFAULTS): Primitive[] {
	const profile = profileOf(site, mass);
	const parts = printedBody(site, mass, profile);
	const wall = parts[0];
	const bands = !mass.volume && wall?.kind === 'prism' ? printBands(site, mass, profile, wall) : [];
	const lift = massStoreys(mass) - 1;
	const exposed = mass.stories.filter(
		({ cell, level }) => storiesOf(site.stacks, cell.id).length === level + lift + 1
	);
	const paintedLevel = ({ cell, level }: Story) =>
		level + lift - (site.ensembles?.cells.get(cell.id)?.surcharge ?? 0);
	const key = (story: Story) => cellKey(story.cell) * MAX_STORIES + paintedLevel(story);
	const seat = exposed.reduce<Story | undefined>(
		(best, story) =>
			!best ||
			hash(site.seed, key(story), CHANNEL.figureSeat) >
				hash(site.seed, key(best), CHANNEL.figureSeat)
				? story
				: best,
		undefined
	);
	if (!seat) return [...parts, ...bands];
	const side = Math.floor(hash(site.seed, key(seat), CHANNEL.figureSide) * 4);
	const lifted = {
		...mass,
		floor: mass.floor + lift * STORY + Math.min(profile.tiers, 1) * profile.rise,
		...(mass.volume && {
			id: `${seat.cell.id}@${paintedLevel(seat)}`,
			use: storiesOf(site.stacks, seat.cell.id)[paintedLevel(seat)]
		})
	};
	parts.push(...collageFigure(lifted, seat.cell, side, p), ...bands);
	return parts;
}
