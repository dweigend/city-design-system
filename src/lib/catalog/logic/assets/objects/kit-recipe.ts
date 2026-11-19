import { flowToken } from '../../../data/focus';
import { mount, type AssetCategory, type AssetRecipe, type AssetSurface } from '../definition';
import { plate } from '../assembly';
import { surface } from '../parts';
import type { ObjectGeometry } from '../object-geometry';
import type { Vec3 } from '../../parametrik/types';

const white = { material: 'metal', finish: 'metall-lackiert', token: '--paper' } as const;
const surfaces = {
	body: white,
	deck: white,
	shell: white,
	accent: white,
	trim: { material: 'metal', finish: 'metall-gebuerstet', token: '--paper' },
	frame: { material: 'metal', finish: 'metall-graphit', token: '--blueprint' },
	edge: { material: 'metal', finish: 'metall-graphit', token: '--ink' },
	glass: { material: 'glass', finish: 'glas-klar', token: '--blueprint' },
	access: { material: 'metal', finish: 'metall-lackiert', token: flowToken.people },
	channel: { material: 'metal', finish: 'metall-lackiert', token: flowToken.water },
	planting: { material: 'metal', finish: 'city-drawing', token: flowToken.food }
} satisfies Record<string, AssetSurface>;

/** Registers a fixed metre-space design with its authored mounting reservation. */
export function kitRecipe(
	id: string,
	category: AssetCategory,
	footprint: [number, number],
	slotNames: readonly (keyof typeof surfaces)[],
	variants: readonly string[],
	draw: AssetRecipe['draw']
): AssetRecipe {
	return {
		id,
		category,
		footprint,
		slotNames,
		variants,
		draw,
		suggestions: surfaces,
		anchors: [mount('deck')]
	};
}

/** A solid with quarter-circle plan corners; z measures its mounting face. */
export function rounded(
	x: number,
	y: number,
	z: number,
	w: number,
	d: number,
	h: number,
	slot: string,
	r: 0.15 | 0.45 = 0.15
) {
	const points: [number, number][] = [];
	for (let q = 0; q < 4; q++) {
		const cx = x + (q === 0 || q === 3 ? 1 : -1) * (w / 2 - r);
		const cy = y + (q < 2 ? 1 : -1) * (d / 2 - r);
		for (let i = 0; i <= 4; i++) {
			const a = ((q + i / 4) * Math.PI) / 2;
			points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
		}
	}
	return plate(points, z, h, slot);
}

/** Rounded solid specified by its two end-cap centres, in metres. */
export function capsule(from: Vec3, to: Vec3, radius: number, slot: string): ObjectGeometry {
	return { ...surface(slot), kind: 'capsule', from, to, radius };
}
