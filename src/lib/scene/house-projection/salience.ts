import { Random } from '../../core/random';
import type { HouseFeatures } from '../../domain/house-court';
import { defaults } from '../../../config/house-projection';
import type { SurfaceLevel } from '../../domain/material';

const { salientShareRatio, salientBlockCap, salientViewCap } = defaults;

/** One house of a view as the salience rule reads it: its ID, its block, its features, and
 * whether it is the subject in focus or selected (or hovered). */
export type SalienceCandidate = Readonly<{
	id: string;
	block: string;
	features: HouseFeatures;
	focus?: boolean;
	selected?: boolean;
}>;

type Ranked = Readonly<{ id: string; block: string; rank: number; draw: number }>;

// Exact arithmetic: ranks order the salient kinds; zero is an ordinary house.
function rankOf(candidate: SalienceCandidate, tallest: number, random: Random) {
	const { large, corner, storeys } = candidate.features;
	if (large) return /* Exact arithmetic: large house rank. */ 4;
	if (corner) return /* Exact arithmetic: corner house rank. */ 3;
	if (storeys >= tallest && tallest > 0) return /* Exact arithmetic: tall house rank. */ 2;
	return random.derive(candidate.id).number() < salientShareRatio ? 1 : 0;
}

function tallestByBlock(candidates: readonly SalienceCandidate[]) {
	const tallest = new Map<string, number>();
	for (const { block, features } of candidates)
		tallest.set(block, Math.max(tallest.get(block) ?? 0, features.storeys));
	return tallest;
}

/** The surface level each house of a view is drawn at (MAT-15): every house is `plain` by
 * default; the subject in focus and a selected house are `near`; large houses, corner houses, the
 * tallest of a block and a seeded share of the rest are granted detail, at most
 * `salientBlockCap` per block and `salientViewCap` per view, ranked in that order with a seeded
 * draw breaking ties. The first granted house of a block is `near`, the others `mid`. Deterministic
 * for the same candidates and seed. */
// Exact arithmetic: ranks and the first house of a block.
export function readHouseSalience(
	candidates: readonly SalienceCandidate[],
	seed = /* Exact arithmetic: neutral default draw seed. */ 0
): ReadonlyMap<string, SurfaceLevel> {
	const random = Random.create({ seed }).derive('salience');
	const tallest = tallestByBlock(candidates);
	const levels = new Map<string, SurfaceLevel>(candidates.map(({ id }) => [id, 'plain']));
	for (const { id, focus, selected } of candidates) if (focus || selected) levels.set(id, 'near');
	const ranked: Ranked[] = candidates
		.filter(({ focus, selected }) => !focus && !selected)
		.map((candidate) => ({
			id: candidate.id,
			block: candidate.block,
			rank: rankOf(candidate, tallest.get(candidate.block) ?? 0, random),
			draw: random.derive(`${candidate.id}/order`).number()
		}))
		.filter(({ rank }) => rank > 0)
		.sort((a, b) => b.rank - a.rank || a.draw - b.draw);
	const perBlock = new Map<string, number>();
	let granted = 0;
	for (const { id, block } of ranked) {
		const count = perBlock.get(block) ?? 0;
		if (count >= salientBlockCap || granted >= salientViewCap) continue;
		levels.set(id, count === 0 ? 'near' : 'mid');
		perBlock.set(block, count + 1);
		granted += /* Exact arithmetic: grant one candidate. */ 1;
	}
	return levels;
}
