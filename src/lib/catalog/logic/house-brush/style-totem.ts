import { STORY } from '../../data/grid';
import { hash } from '../hash-random';
import type { Primitive } from '../parametrik/types';
import { inradius, sideLength } from '../quad-grid';
import { accentOf, part, type Form, type Site } from './form';
import type { Mass, Story } from './massing';
import { boundaryRings, ringArea } from './outline';
import { storiesOf } from './stacks';
import { checkeredBlock } from './totem-checker';
import { joinedBarrel } from './totem-barrels';
import { totemSolid } from './totem-solids';

const PATTERNS = ['schachbrett', 'punkte', 'diagonal'];
const CHANNEL = { shape: 31, finish: 32, direction: 33, beam: 34, pattern: 35, portal: 36 };

/** One continuous ceramic bar bends around all reentrant corners and courtyards. */
function bar(mass: Mass, z: number, height: number): Primitive {
	const cells = mass.stories.map((s) => s.cell);
	const ids = new Set(cells.map((c) => c.id));
	const [polygon, ...holes] = boundaryRings(cells, (id) => ids.has(id)).sort(
		(a, b) => ringArea(b) - ringArea(a)
	);
	return {
		...part(mass.id + ':bar', accentOf(mass.use) ?? '--paper', {
			kind: 'prism',
			polygon,
			holes,
			z,
			height
		}),
		edges: false
	};
}

function body(site: Site, story: Story, seed: number, z: number, h: number): Form {
	const { cell, level } = story;
	const draw = (channel: number) => hash(seed, cell.index, channel);
	const side = Math.floor(draw(CHANNEL.direction) * 4);
	const a = cell.corners[side],
		b = cell.corners[(side + 1) % 4];
	const r = Math.min(inradius(cell) * 0.96, sideLength(cell, side) * 0.5);
	const top = storiesOf(site.stacks, cell.id).length === level + 1;
	const choice = Math.floor(draw(CHANNEL.shape) * 10);
	const shape = (!top && [5, 6].includes(choice)) || (level > 0 && choice === 0) ? 8 : choice;
	return totemSolid(
		{
			x: cell.center[0],
			y: cell.center[1],
			z,
			r,
			h: top ? h + r * 1.15 : h,
			turn: Math.atan2(b[1] - a[1], b[0] - a[0])
		},
		shape
	);
}

function finishOf(mass: Mass, story: Story, seed: number, form: Form): Primitive {
	const { cell, level } = story;
	const draw = (channel: number) => hash(seed, cell.index, channel);
	const finish = draw(CHANNEL.finish);
	const pattern =
		finish < 0.32 ? PATTERNS[Math.floor(draw(CHANNEL.pattern) * PATTERNS.length)] : undefined;
	return {
		...part(
			cell.id + '@' + level + ':solid',
			finish > 0.44 ? (accentOf(mass.use) ?? '--paper') : '--paper',
			form
		),
		pattern,
		shade: pattern ? 0.48 : 0.04,
		edges: false
	};
}

/** Stacks ceramic bodies on a common bar, fusing neighboring seats into portals and barrels. */
export function totemMass(site: Site, mass: Mass): Primitive[] {
	const anchor = mass.stories[0];
	const seed = Math.floor(hash(site.seed, anchor.cell.index, anchor.level) * 0x100000000);
	const thickness = Math.min(STORY * 0.22, inradius(anchor.cell) * 0.44);
	const z = mass.floor + thickness;
	const members = new Map(mass.stories.map((story) => [story.cell.id, story]));
	const consumed = new Set<string>();
	const solids: Primitive[] = [];
	for (const story of mass.stories) {
		if (consumed.has(story.cell.id)) continue;
		consumed.add(story.cell.id);

		const joined = pair(site, story, members, consumed, seed, z);
		const solid = finishOf(
			mass,
			story,
			seed,
			joined ?? body(site, story, seed, z, STORY - thickness)
		);
		if (
			solid.kind === 'box' ||
			(mass.use === 'living' && solid.kind === 'cylinder' && story.level > 0)
		)
			solids.push(...checkeredBlock(solid));
		else solids.push(solid);
	}
	return [
		...mass.stories.flatMap((story) => foot(mass, story)),
		bar(mass, mass.floor, thickness),
		...solids
	];
}

/** Sky-exposed neighbors can share a single horizontal body over their seats. */
function pair(
	site: Site,
	story: Story,
	members: Map<string, Story>,
	consumed: Set<string>,
	seed: number,
	z: number
) {
	const exposed = (s: Story) => storiesOf(site.stacks, s.cell.id).length === s.level + 1;
	if (!exposed(story) || hash(seed, story.cell.index, CHANNEL.beam) > 0.58) return;
	for (const [side, id] of story.cell.neighbors.entries()) {
		const neighbor = id && members.get(id);
		if (!neighbor || consumed.has(neighbor.cell.id) || !exposed(neighbor)) continue;
		const form = joinedBarrel(
			story.cell,
			side,
			neighbor.cell,
			z,
			hash(seed, story.cell.index, CHANNEL.portal) < 0.68
		);
		if (form) {
			consumed.add(neighbor.cell.id);
			return form;
		}
	}
}

/** A short bearing embeds each ground seat into its local terrain, including raised pads. */
function foot(mass: Mass, { cell, level }: Story): Primitive[] {
	if (level !== 0) return [];
	const radius = inradius(cell) * (mass.raised ? 0.35 : 0.63);
	const z = Math.min(mass.floor, ...cell.corners.map((p) => p[2])) - radius * 0.17;
	return [
		{
			...part(cell.id + '@0:bearing', '--paper', {
				kind: 'cylinder',
				position: [cell.center[0], cell.center[1], z],
				radius,
				height: mass.floor - z
			}),
			edges: false,
			shade: 0.12
		}
	];
}
