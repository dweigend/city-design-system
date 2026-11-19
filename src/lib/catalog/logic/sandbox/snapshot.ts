import type { BuildingMethod } from '../../data/sandbox';
import {
	EMPTY_STATE,
	type SandboxSnapshot,
	type SandboxState,
	type SnapshotStory,
	type StoryPart
} from './state';
import { constructionLayers } from './time-layers';

// The original boundaries only decode records written before the style field existed.
const LEGACY_EPOCHS = [
	[1900, 'terrace'],
	[1980, 'collage'],
	[2027, 'megastructure'],
	[2028, 'totem'],
	[2029, 'collage']
] as const;

function legacyStyle(year: number): BuildingMethod {
	return LEGACY_EPOCHS.findLast(([from]) => from <= year)?.[1] ?? 'terrace';
}

function storyHasStyle(part: SnapshotStory): part is StoryPart {
	return part.style !== undefined;
}

function hasStoredStyles(
	parts: SandboxSnapshot['storyParts']
): parts is SandboxState['storyParts'] {
	for (const stories of parts.values()) if (!stories.every(storyHasStyle)) return false;
	return true;
}

function restoreParts(parts: SandboxSnapshot['storyParts']): SandboxState['storyParts'] {
	if (hasStoredStyles(parts)) return parts;
	const updated = new Map<string, readonly StoryPart[]>();
	for (const [id, stories] of parts)
		updated.set(
			id,
			stories.every(storyHasStyle)
				? stories
				: stories.map((part) =>
						storyHasStyle(part) ? part : { ...part, style: legacyStyle(part.built) }
					)
		);
	return updated;
}

function restoreLayers(snapshot: SandboxSnapshot): SandboxState['timeLayers'] {
	const saved = snapshot.timeLayers ?? EMPTY_STATE.timeLayers;
	const byYear = new Map(
		saved.filter((layer) => layer.flows.length).map((layer) => [layer.year, layer])
	);
	for (const layer of constructionLayers(
		snapshot,
		(year) => year < snapshot.year && !byYear.has(year)
	))
		byYear.set(layer.year, layer);
	const layers = [...byYear.values()].sort((a, b) => a.year - b.year);
	return layers.length === saved.length && layers.every((layer, i) => layer === saved[i])
		? saved
		: layers;
}

function isNormalized(
	snapshot: SandboxSnapshot,
	storyParts: SandboxState['storyParts'],
	timeLayers: SandboxState['timeLayers']
): snapshot is SandboxState {
	return (
		snapshot.parts !== undefined &&
		snapshot.compositions !== undefined &&
		storyParts === snapshot.storyParts &&
		timeLayers === snapshot.timeLayers
	);
}

/** Normalizes a restored snapshot without changing IDs, anchors, or already saved styles. */
export function migrateSnapshot(snapshot: SandboxSnapshot): SandboxState {
	const storyParts = restoreParts(snapshot.storyParts);
	const timeLayers = restoreLayers(snapshot);
	if (isNormalized(snapshot, storyParts, timeLayers)) return snapshot;
	return {
		...snapshot,
		parts: snapshot.parts ?? EMPTY_STATE.parts,
		compositions: snapshot.compositions ?? EMPTY_STATE.compositions,
		storyParts,
		timeLayers
	};
}
