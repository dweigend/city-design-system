import { hash } from '../hash-random';
import { inradius } from '../quad-grid';
import { CHANNEL, type Site } from './form';
import type { Mass } from './massing';
import { MAX_STORIES, storiesOf } from './stacks';

const CORNER_RADII = [0, 0.48, 1.05];
const CONCAVE_SHARE = 0.45;
const BROAD_ROOF = 4;
const EXTRA_TIER_SHARE = 0.45;
const TIER_RISE = 0.23;
const TIER_SETBACK = 0.16;
const WALL_SETBACK = { standard: 0.18, arcade: 0.56 };

/** Derives one footprint profile from the anchor and its member cells. Distances in meters. */
export function profileOf(site: Site, mass: Mass) {
	const anchor = mass.stories[0];
	const key = anchor.cell.index * MAX_STORIES + anchor.level;
	const radius = mass.stories.reduce((r, story) => Math.min(r, inradius(story.cell)), Infinity);
	const corner = hash(site.seed, key, CHANNEL.corner);
	const convex = radius * CORNER_RADII[Math.floor(corner * CORNER_RADII.length)];
	const open = mass.stories.every(
		({ cell, level }) => storiesOf(site.stacks, cell.id).length === level + 1
	);
	const arcade =
		mass.stories.every((s) => s.level === 0) &&
		mass.stories.some((s) => storiesOf(site.stacks, s.cell.id).length >= 3);
	const extra = hash(site.seed, key, CHANNEL.tiers) < EXTRA_TIER_SHARE;
	const tiers = open ? 2 + Number(extra && mass.stories.length >= BROAD_ROOF) : 0;
	return {
		fillet: { convex, concave: convex * CONCAVE_SHARE },
		arcade,
		tiers,
		rise: radius * TIER_RISE,
		setback: radius * TIER_SETBACK,
		wallInset: radius * (arcade ? WALL_SETBACK.arcade : WALL_SETBACK.standard)
	};
}

export type Profile = ReturnType<typeof profileOf>;
