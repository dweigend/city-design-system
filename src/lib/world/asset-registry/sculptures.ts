import { defaults } from '../../../config/sculpture';
import { createAssetBuild, type AssetEntry } from '../../core/asset-registry';
import { size, type Vec3 } from '../../core/geometry';
import { bounds, move, type Part, type PlaceableObject } from '../../core/object';
import { defineParams } from '../../core/params';
import { Random } from '../../core/random';
import type { CityAssetHost } from './hosts';
import type { SpecimenMaterials } from './plates';

const [minScale, maxScale, scale, scaleStep] = defaults.sculptureScaleBand;
const [minRotation, maxRotation, rotation, rotationStep] = defaults.sculptureRotationBandRad;
const params = defineParams({
	scale: {
		label: 'Scale',
		unit: 'ratio',
		min: minScale,
		max: maxScale,
		default: scale,
		step: scaleStep
	},
	rotation: {
		label: 'Rotation',
		unit: 'rad',
		min: minRotation,
		max: maxRotation,
		default: rotation,
		step: rotationStep
	}
});

type BoxBounds = readonly [number, number, number, number, number, number];
type Layout = (scale: number, offsetM: number) => Part[];

const unmeasured = /* Exact arithmetic: placeholder before measuring the footprint. */ 0;
const origin: Vec3 = /* Exact arithmetic: local ground origin. */ [0, 0, 0];
const up: Vec3 = /* Exact arithmetic: ground anchor unit normal. */ [0, 0, 1];

function createBox(
	id: string,
	slot: string,
	[x0, x1, y0, y1, z0, z1]: BoxBounds,
	scale: number,
	offsetM = /* Exact arithmetic: a box is unshifted by default. */ 0
): Part {
	return {
		id,
		slot,
		shape: {
			kind: 'box',
			center: [
				/* Exact arithmetic: centers are midpoints of the bounds. */ ((x0 + x1) / 2 + offsetM) *
					scale,
				/* Exact arithmetic: midpoint. */ ((y0 + y1) / 2) * scale,
				/* Exact arithmetic: midpoint. */ ((z0 + z1) / 2) * scale
			],
			size: [(x1 - x0) * scale, (y1 - y0) * scale, (z1 - z0) * scale],
			rotation: /* Exact arithmetic: local boxes align with the axes. */ 0
		}
	};
}

function portal(scale: number, offsetM: number): Part[] {
	return [
		createBox('pier', 'frame', defaults.portalPierM, scale),
		createBox('corbel', 'step', defaults.portalCorbelM, scale),
		createBox('post', 'frame', defaults.portalPostM, scale),
		createBox('lintel', 'step', defaults.portalLintelM, scale),
		createBox('crest', 'accent', defaults.portalCrestM, scale, offsetM)
	];
}

function totem(scale: number, offsetM: number): Part[] {
	return [
		createBox('foot', 'base', defaults.totemFootM, scale),
		createBox('stem', 'frame', defaults.totemStemM, scale),
		createBox('lower-fin', 'accent', defaults.totemLowerFinM, scale),
		createBox('middle-fin', 'counterweight', defaults.totemMiddleFinM, scale),
		createBox('upper-fin', 'accent', defaults.totemUpperFinM, scale),
		createBox('crown', 'counterweight', defaults.totemCrownM, scale, offsetM)
	];
}

function canopy(scale: number, offsetM: number): Part[] {
	const [innerX, outerX, innerY, outerY] = defaults.canopyPierM;
	const [x0, x1, y0, y1, bottom, eave] = defaults.canopyEavesM;
	const [x, y, z] = defaults.canopyApexM;
	// Mirror the pier bounds across both ground axes.
	const piers = [
		['southwest', -outerX, -innerX, -outerY, -innerY],
		['southeast', innerX, outerX, -outerY, -innerY],
		['northeast', innerX, outerX, innerY, outerY],
		['northwest', -outerX, -innerX, innerY, outerY]
	] as const;
	return [
		...piers.map(([id, a, b, c, d]) =>
			createBox(id, 'frame', [a, b, c, d, origin[2], bottom], scale)
		),
		createBox('fascia', 'edge', defaults.canopyEavesM, scale),
		{
			id: 'roof',
			slot: 'roof',
			shape: {
				kind: 'mesh',
				positions: [x0, y0, eave, x1, y0, eave, x1, y1, eave, x0, y1, eave, x + offsetM, y, z].map(
					(value) => value * scale
				),
				// The roof has four outward triangles and two downward base triangles.
				indices: /* Exact arithmetic: indexed roof topology. */ [
					0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4, 0, 2, 1, 0, 3, 2
				]
			}
		}
	];
}

function sculpture(
	id: string,
	layout: Layout,
	materials: SpecimenMaterials
): AssetEntry<CityAssetHost, SpecimenMaterials> {
	for (const material of Object.values(materials)) Object.freeze(material);
	return {
		id,
		kind: 'sculpture',
		tags: ['civic', 'static'],
		hostKinds: ['ground'],
		params,
		build(host, { scale, rotation }, seed) {
			if (host.kind !== 'ground') throw new RangeError('Expected a ground point');
			const [min, max] = defaults.sculptureVariationM;
			const offsetM = Random.create({ seed }).derive(id).number({ min, max });
			const parts = layout(scale, offsetM);
			const local: PlaceableObject = {
				id,
				slots: [...new Set(parts.map(({ slot }) => slot))],
				parts,
				footprint: { width: unmeasured, depth: unmeasured },
				anchors: [{ name: 'ground', position: origin, normal: up }]
			};
			const [width, depth] = size(bounds(local));
			const object = move({ ...local, footprint: { width, depth } }, host.point, rotation);
			return createAssetBuild(object, materials);
		}
	};
}

export const sculptureAssets = [
	sculpture('sculpture/portal-arch', portal, {
		frame: { family: 'board', role: 'face' },
		step: { family: 'card', role: 'face' },
		accent: { family: 'perforated', role: 'face' }
	}),
	sculpture('sculpture/cantilever-totem', totem, {
		base: { family: 'board', role: 'face' },
		frame: { family: 'card', role: 'face' },
		accent: { family: 'perforated', role: 'face' },
		counterweight: { family: 'cork', role: 'face' }
	}),
	sculpture('sculpture/plaza-canopy', canopy, {
		frame: { family: 'board', role: 'face' },
		edge: { family: 'card', role: 'face' },
		roof: { family: 'cork', role: 'face' }
	})
];
