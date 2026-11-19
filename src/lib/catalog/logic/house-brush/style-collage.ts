import { hash } from '../hash-random';
import type { Primitive } from '../parametrik/types';
import { collageFigure } from './collage-figure';
import type { Site } from './form';
import { body } from './body';
import { profileOf } from './profile';
import { flowToken } from '../../data/focus';
import type { Mass, Story } from './massing';
import { MAX_STORIES, storiesOf } from './stacks';

const COLLAGE_DEFAULTS = {
	treeRadius: 0.36,
	treeHeight: 0.94,
	gardenDepth: 0.065
};
const CHANNEL = { figureSeat: 31, figureSide: 32 };

/** Wall colour of each use. Housing takes the pale planning tint; paths alone stay pink. */
const BODY_TOKEN = {
	living: '--blueprint-2',
	water: flowToken.water,
	energy: flowToken.energy,
	food: flowToken.food,
	material: flowToken.material
} as const;

/** A printed colour body: streamlined wall in the use colour, white plate and roof steps. */
function printedBody(site: Site, mass: Mass): Primitive[] {
	const wall = BODY_TOKEN[mass.use];
	// One roof step only: stacked contours close up to a black cap at town scale.
	const pieces = body(site, mass, profileOf(site, mass)).filter(
		(piece) => !/:tier[1-9]$/.test(piece.id)
	);
	return pieces.map((piece): Primitive => {
		const coloured = /:(wall|foot|deck)$/.test(piece.id) || piece.id.includes(':stilt');
		return {
			...piece,
			role: 'neu',
			envelope: true,
			token: coloured ? wall : '--paper',
			shade: 0
		};
	});
}

/** Colour body of the painted stories, with one use-bearing figure on an exposed roof. */
export function collageMass(site: Site, mass: Mass, p = COLLAGE_DEFAULTS): Primitive[] {
	const parts = printedBody(site, mass);
	const exposed = mass.stories.filter(
		({ cell, level }) => storiesOf(site.stacks, cell.id).length === level + 1
	);
	const key = ({ cell, level }: Story) => cell.index * MAX_STORIES + level;
	const seat = exposed.reduce<Story | undefined>(
		(best, story) =>
			!best ||
			hash(site.seed, key(story), CHANNEL.figureSeat) >
				hash(site.seed, key(best), CHANNEL.figureSeat)
				? story
				: best,
		undefined
	);
	if (!seat) return parts;
	const profile = profileOf(site, mass);
	const side = Math.floor(hash(site.seed, key(seat), CHANNEL.figureSide) * 4);
	const lifted = { ...mass, floor: mass.floor + Math.min(profile.tiers, 1) * profile.rise };
	parts.push(...collageFigure(lifted, seat.cell, side, p));
	return parts;
}
