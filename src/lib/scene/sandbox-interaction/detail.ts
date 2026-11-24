import { defaults } from '../../../config/sandbox-interaction';

import { readHouseSalience, type SalienceCandidate } from '../house-projection';

/** One candidate with the sandbox's current selection and pointer state. */
export type DetailSubject = Omit<SalienceCandidate, 'focus' | 'selected'> &
	Readonly<{ selected: boolean; hovered: boolean }>;

/** Reads shared house salience for a sandbox view. The hovered house is the subject in focus. */
export function selectHouseDetail(subjects: readonly DetailSubject[], seed: number) {
	return readHouseSalience(
		subjects.map(({ hovered, ...subject }) => ({ ...subject, focus: hovered })),
		seed
	);
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
