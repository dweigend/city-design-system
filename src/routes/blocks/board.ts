import { defaults } from '../../config/blocks-board';
import type { Vec3 } from '../../lib/core/geometry';
import { PlaceableObject } from '../../lib/core/object';
import { type Family, type FamilySlot } from '../../lib/domain/material';
import type { DisplayLevel } from '../../lib/scene/focus';
import { houseLevels, projectHouse } from '../../lib/scene/house-projection';
import {
	existing,
	readMaterialSurface,
	resolveSurfaces,
	type Drawable,
	type Surface
} from '../../lib/scene/surface';
import { buildAsset, type AssetDefinition } from '../../lib/world/asset-registry';

import { specimenHost } from './hosts';
import { mountSpecimen } from './mount-specimen';

const {
	boardMaximumColumns,
	boardCompactColumns,
	boardCompactLimit,
	boardPlotSideM,
	boardColumnPitchM,
	boardRowPitchM,
	boardPlinthHeightM,
	boardPlinthRimM,
	boardSeed
} = defaults;

function paint(object: PlaceableObject, asset: AssetDefinition): Drawable[] {
	if (asset.kind === 'house') return projectHouse(object, 'full');
	const surface = (slot: string): Surface => {
		if (asset.kind === 'surface')
			return readMaterialSurface(
				asset.tags[1] as Family,
				slot.split('/').at(-1) as FamilySlot,
				'normal'
			);
		if (slot === 'deck' || slot === 'stairs') return { ...existing.wall, color: '--path' };
		if (slot === 'solid') return { ...existing.roof, color: '--stock-veil' };
		return { ...existing.wall, color: '--ink-3' };
	};
	return resolveSurfaces(
		object,
		Object.fromEntries(object.slots.map((slot) => [slot, surface(slot)]))
	).map((part) => {
		if (asset.kind === 'lattice' && part.id === 'solid')
			return { ...part, fillAlpha: houseLevels.transparent.fillAlpha, occlude: true };
		// Printed pattern marks draw no outline (MAT-8).
		return asset.kind === 'surface' && part.id.endsWith('/mark')
			? { ...part, strokeSegments: [] }
			: part;
	});
}

function plinth(id: string, x: number, y: number) {
	const side = boardPlotSideM + 2 * boardPlinthRimM;
	const center: Vec3 = [x, y, -boardPlinthHeightM / 2];
	const base = PlaceableObject.create({
		id,
		slots: ['plinth'],
		parts: [
			{
				id: `${id}/plinth`,
				slot: 'plinth',
				shape: { kind: 'box', center, size: [side, side, boardPlinthHeightM], rotation: 0 }
			}
		],
		anchors: [],
		footprint: { width: side, depth: side }
	});
	return resolveSurfaces(base, { plinth: existing.roof });
}

/** Builds every listed specimen with the registry defaults on one metric display grid. */
export function buildBoard(assets: readonly AssetDefinition[]) {
	const specimens: Drawable[] = [];
	const bases: Drawable[] = [];
	const columns =
		assets.length <= boardCompactLimit
			? Math.min(boardCompactColumns, assets.length)
			: boardMaximumColumns;
	for (const [index, asset] of assets.entries()) {
		const { id } = asset;
		const x = (index % columns) * boardColumnPitchM;
		const y = -Math.floor(index / columns) * boardRowPitchM;
		const object = buildAsset(id, specimenHost(asset), {}, boardSeed);
		const mounted = mountSpecimen(object, x, y, boardPlotSideM);
		specimens.push(...paint(mounted, asset).map((part) => ({ ...part, id: `${id}/${part.id}` })));
		bases.push(...plinth(id, x, y));
	}
	return { specimens, bases, drawables: [...bases, ...specimens] };
}

/** Styles existing geometry while the display level changes. */
export function presentBoard(board: ReturnType<typeof buildBoard>, level: DisplayLevel) {
	if (level !== 'pencil' && level !== 'transparent') return board.drawables;
	const pencil = level === 'pencil';
	const { surfaces, hatch, fillAlpha } = houseLevels[level];
	const specimens = board.specimens.map((part) => ({
		...part,
		...surfaces.mass,
		hatch,
		fillAlpha,
		occlude: !pencil
	}));
	return [...board.bases, ...specimens];
}
