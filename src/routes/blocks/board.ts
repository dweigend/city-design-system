import type { Vec3 } from '../../lib/core/geometry';
import { PlaceableObject } from '../../lib/core/object';
import { parcelEdgeId, type Parcel } from '../../lib/domain/cell-space';
import { createFocusResolver, type DisplayLevel } from '../../lib/scene/focus';
import { houseLevels, projectHouse } from '../../lib/scene/house-projection';
import { existing, resolveSurfaces, type Drawable } from '../../lib/scene/surface';
import { buildAsset, type AssetDefinition } from '../../lib/world/asset-registry';

const columnCount = 2;
const plotSideM = 16;
const pitchM = 23;
const plinthHeightM = 0.6;
const plinthRimM = 0.5;
const storeys = 10;
const seed = 73;

export const boardFocus = createFocusResolver(
	{
		full: { label: 'Full', subject: ['specimens'] },
		transparent: { label: 'Transparent', subject: ['specimens'] },
		pencil: { label: 'Pencil', subject: ['specimens'] }
	},
	{ specimens: { full: 'full', transparent: 'transparent', pencil: 'pencil' } }
);

function specimenParcel(id: string, x: number, y: number): Parcel {
	return {
		id,
		corners: [
			{ id: 'a', position: [x, y] },
			{ id: 'b', position: [x + plotSideM, y] },
			{ id: 'c', position: [x + plotSideM, y + plotSideM] },
			{ id: 'd', position: [x, y + plotSideM] }
		],
		frontage: [parcelEdgeId('a', 'b')],
		baseZ: 0,
		storeyCount: storeys
	};
}

function plinth(id: string, x: number, y: number) {
	const side = plotSideM + 2 * plinthRimM;
	const center: Vec3 = [x + plotSideM / 2, y + plotSideM / 2, -plinthHeightM / 2];
	const base = PlaceableObject.create({
		id,
		slots: ['plinth'],
		parts: [
			{
				id: `${id}/plinth`,
				slot: 'plinth',
				shape: { kind: 'box', center, size: [side, side, plinthHeightM], rotation: 0 }
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
	for (const [index, { id }] of assets.entries()) {
		const x = (index % columnCount) * pitchM;
		const y = Math.floor(index / columnCount) * pitchM;
		const parcel = specimenParcel(id, x, y);
		const object = buildAsset(id, { kind: 'parcel', parcel }, {}, seed);
		specimens.push(
			...projectHouse(object, 'full').map((part) => ({ ...part, id: `${id}/${part.id}` }))
		);
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
