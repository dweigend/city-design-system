import { defaults } from '../../config/blocks-board';
import type { Vec3 } from '../../lib/core/geometry';
import { PlaceableObject } from '../../lib/core/object';
import type { DisplayLevel } from '../../lib/scene/focus';
import { houseLevels, projectHouse } from '../../lib/scene/house-projection';
import { projectPathAsset } from '../../lib/scene/paths-projection';
import {
	existing,
	projectGrove,
	readMaterialSurface,
	resolveSurfaces,
	type Drawable,
	type Surface
} from '../../lib/scene/surface';
import {
	buildAssetResult,
	type AssetDefinition,
	type SpecimenMaterials
} from '../../lib/world/asset-registry';

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

function paint(object: PlaceableObject, kind: string, materials?: SpecimenMaterials): Drawable[] {
	if (kind === 'park') return projectGrove(object);
	if (kind === 'house') return projectHouse(object, 'full');
	const path = projectPathAsset(object, kind);
	if (path) return path;
	const materialAt = (slot: string) =>
		materials && Object.hasOwn(materials, slot) ? materials[slot] : undefined;
	const surface = (slot: string): Surface => {
		const material = materialAt(slot);
		if (material) return readMaterialSurface(material.family, material.role, 'normal');
		if (kind === 'surface' || kind === 'sculpture')
			throw new RangeError(`Missing specimen material for slot "${slot}"`);
		if (slot === 'solid') return { ...existing.roof, color: '--stock-veil' };
		return { ...existing.wall, color: '--ink-3' };
	};
	return resolveSurfaces(
		object,
		Object.fromEntries(object.slots.map((slot) => [slot, surface(slot)]))
	).map((part, index) => {
		if (kind === 'lattice' && part.id === 'solid')
			return { ...part, fillAlpha: houseLevels.transparent.fillAlpha, occlude: true };
		// Printed pattern marks draw no outline (MAT-8).
		return materialAt(object.parts[index].slot)?.role === 'mark'
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
		const { object, metadata } = buildAssetResult(id, specimenHost(asset), {}, boardSeed);
		const mounted = mountSpecimen(object, x, y, boardPlotSideM);
		for (const part of paint(mounted, asset.kind, metadata))
			specimens.push({ ...part, id: `${id}/${part.id}` });
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
