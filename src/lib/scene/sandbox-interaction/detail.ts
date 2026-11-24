import { defaults } from '../../../config/sandbox-interaction';

/** How much of a house is drawn: its plain volume, flat cladding or cladding relief. */
export type HouseDetail = 'volume' | 'flat' | 'relief';

/** What the level rule reads about one house: whether the player selected or points at it. */
export type DetailSubject = Readonly<{ selected: boolean; hovered: boolean }>;

/** The thin level policy of the sandbox: every house is a plain volume; the hovered house shows
 * flat cladding and the selected house relief. A salience rule may replace this function behind
 * the same output. */
export function selectHouseDetail({ selected, hovered }: DetailSubject): HouseDetail {
	if (selected) return 'relief';
	return hovered ? 'flat' : 'volume';
}

/** Splits one block triangle budget evenly among the placed houses of the block, so the relief
 * houses of a block never exceed it together. A share changes only when the block's houses change,
 * not when the hover moves. Returns each house's budget by ID. */
export function shareBlockBudget(
	subjects: readonly Readonly<{ id: string; block: string }>[],
	blockBudget: number
) {
	const perBlock = Map.groupBy(subjects, ({ block }) => block);
	return new Map(
		subjects.map(({ id, block }) => [
			id,
			Math.floor(blockBudget / (perBlock.get(block)?.length ?? 1))
		])
	);
}

/** The height of the plain body that stands in for a house while it is built: about its eaves. */
export function readPreviewHeight(houseHeightM: number) {
	return houseHeightM * defaults.previewEavesRatio;
}
