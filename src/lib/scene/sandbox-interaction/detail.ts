import { defaults } from '../../../config/sandbox-interaction';

/** The cladding level a house is drawn at. */
export type HouseDetail = 'relief' | 'flat';

/** What the level rule reads about one house: its ground distance from the view centre, whether
 * the player points at or selected it, and the block that shares its triangle budget. */
export type DetailSubject = Readonly<{
	id: string;
	block: string;
	distanceM: number;
	emphasised: boolean;
}>;

/** What the level rule reads about the view. */
export type DetailView = Readonly<{ metersPerPixel: number }>;

/** The thin level policy of the sandbox: flat by default; relief for the hovered or selected
 * house, and for houses within the relief radius of the view centre when the view is close enough
 * for relief to read. A later level table may replace this policy behind the same output. */
export function selectHouseDetail(subject: DetailSubject, view: DetailView): HouseDetail {
	if (subject.emphasised) return 'relief';
	const close = view.metersPerPixel <= defaults.reliefMaxMetersPerPixel;
	return close && subject.distanceM <= defaults.reliefRadiusM ? 'relief' : 'flat';
}

/** Splits one block triangle budget evenly among the placed houses of the block, so the relief
 * houses of a block never exceed it together. A share changes only when the block's houses change,
 * not when the hover moves. Returns each house's budget by ID. */
export function shareBlockBudget(subjects: readonly Pick<DetailSubject, 'id' | 'block'>[], blockBudget: number) {
	const perBlock = Map.groupBy(subjects, ({ block }) => block);
	return new Map(
		subjects.map(({ id, block }) => [
			id,
			Math.floor(blockBudget / (perBlock.get(block)?.length ?? 1))
		])
	);
}
