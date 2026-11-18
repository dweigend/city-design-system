import { STORY } from '../../data/grid';
import { hash } from '../hash-random';
import type { Primitive, Vec3 } from '../parametrik/types';
import { inradius } from '../quad-grid';
import { bayOf, panel } from './collage-bay';
import { collageFigure } from './collage-figure';
import { part, type Site } from './form';
import type { Mass, Story } from './massing';
import { MAX_STORIES, storiesOf } from './stacks';

const CHANNEL = { figureSeat: 31, figureSide: 32 };

function pencil(id: string, points: Vec3[], closed = false): Primitive {
	return { ...part(id, '--paper', { kind: 'polyline', points, closed }), role: 'bestand' };
}

function drawBay({ cell, level }: Story, floor: number): Primitive[] {
	const at = bayOf(cell, 0);
	const id = cell.id + '@' + level;
	const base = level === 0;
	const top = floor + STORY;
	const corners = panel(at, 0.05, 0.05, 0.9, 0.9, top);
	const skin = base ? corners : panel(at, 0.05, 0.86, 0.9, 0.09, top);
	const shell = part(id + ':stock', '--paper', {
		kind: 'prism',
		polygon: skin.map(([x, y]) => [x, y]),
		z: floor,
		height: STORY,
		glass: !base,
		edges: false
	});
	const strokes = corners.map(([x, y, z], i) =>
		pencil(id + ':post' + i, [
			[x, y, floor],
			[x, y, z]
		])
	);
	if (base) {
		const ridge = top + Math.min(inradius(cell) * 0.48, STORY * 0.3);
		strokes.push(
			pencil(id + ':gable', [corners[0], at(0.5, 0.05, ridge), corners[1]]),
			pencil(id + ':ridge', [at(0.5, 0.05, ridge), at(0.5, 0.95, ridge)])
		);
	}
	return [
		{ ...shell, role: base ? 'bestand' : 'neu', shade: base ? 0.14 : 0 },
		pencil(id + ':cut', corners, true),
		...strokes
	];
}

/** Section drawing of the painted stories, with one use-bearing insertion on an exposed bay. */
export function collageMass(site: Site, mass: Mass): Primitive[] {
	const parts = mass.stories.flatMap((story) => drawBay(story, mass.floor));
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
	if (seat)
		parts.push(
			...collageFigure(
				mass,
				seat.cell,
				Math.floor(hash(site.seed, key(seat), CHANNEL.figureSide) * 4)
			)
		);
	return parts;
}
