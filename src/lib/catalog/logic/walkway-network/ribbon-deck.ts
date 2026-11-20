import { contourApproach } from './ribbon-approach';
import { column, ribbonProfile } from './ribbon-column';
import { pathSupports, pathTube, profileSolid, contours } from '../linear-path';
import type { Primitive, Vec3 } from '../parametrik/types';
import { guardRuns, landingGround } from './guard-runs';
import { gradeRibbon } from './ribbon-grade';
import type { Section } from './ribbon-curve';
import { pathSurfaces } from './town-palette';
import { ribbonNetwork } from './ribbon-network';
type Ground = (x: number, y: number) => number;
function deck(id: string, sections: Section[], ground: Ground, supported: boolean): Primitive[] {
	const lower = ([x, y, z]: Vec3): Vec3 => [x, y, z - ribbonProfile.depth];
	const rings = sections.map(({ left, right }) => [lower(right), lower(left), left, right]);
	const mesh: Primitive = { ...pathSurfaces.walking, id: id + '/ramp', ...profileSolid(rings) };
	if (!supported) return [mesh];
	const path = sections.map((s) => s.centre);
	return [
		mesh,
		...pathSupports(path, ribbonProfile.bay).flatMap((p, i) => column(id + '/pier/' + i, p, ground))
	];
}
function guard(path: Vec3[], id: string): Primitive[] {
	const railHeight = 1.04;
	return [
		{
			...pathSurfaces.structure,
			id,
			...pathTube(
				path.map(([x, y, z]): Vec3 => [x, y, z + railHeight]),
				ribbonProfile.railRadius
			)
		},
		...pathSupports(path, 3).map((p, j): Primitive => ({
			...pathSurfaces.structure,
			id: id + '/post/' + j,
			kind: 'cylinder',
			position: p,
			height: railHeight,
			radius: ribbonProfile.postRadius
		}))
	];
}
function fitApproaches(
	network: ReturnType<typeof ribbonNetwork>,
	ground: Ground,
	clear?: (a: Vec3, b: Vec3) => boolean
) {
	const places = gradeRibbon(network, ground);
	if (!clear || !places.length) return;
	for (const { reach, side, base, top } of places) {
		const original = side ? reach.sections.toReversed() : reach.sections;
		const fit = contourApproach(original, base, top, ground, clear);
		if (fit === original) continue;
		reach.sections = side
			? fit.toReversed().map((s) => ({ ...s, left: s.right, right: s.left }))
			: fit;
	}
	gradeRibbon(network, ground);
}
/** Projects one constant-section ribbon, its exposed guards and axial columns in world metres. */
export function ribbonDeck(
	network: ReturnType<typeof ribbonNetwork>,
	ground: Ground,
	courts: Primitive[],
	{
		inside = false,
		clear,
		railId = 'town-walk/rail'
	}: { inside?: boolean; clear?: (a: Vec3, b: Vec3) => boolean; railId?: string } = {}
) {
	if (!inside) fitApproaches(network, ground, clear);
	const support = landingGround(courts, ground),
		rails: Vec3[][] = [];
	const exposed = (edge: Vec3[], side: 1 | -1) =>
		rails.push(...guardRuns(edge, support, (p) => p[2], side));
	const parts = network.reaches.flatMap(({ id, sections }) => {
		if (!inside) {
			exposed(
				sections.map((s) => s.left),
				-1
			);
			exposed(
				sections.map((s) => s.right),
				1
			);
		}
		return deck(id, sections, ground, !inside);
	});
	for (const f of network.forks) {
		const id = 'town-walk/joint/' + f.id;
		parts.push(
			{
				...pathSurfaces.walking,
				id,
				kind: 'prism',
				polygon: f.rim.flat().map(([x, y]) => [x, y]),
				z: f.position[2] - ribbonProfile.depth,
				height: ribbonProfile.depth
			},
			...column(id + '/pier/0', f.position, ground)
		);
		for (const edge of f.rim) exposed(edge, 1);
	}
	return [...parts, ...contours(rails).flatMap((p, i) => guard(p, railId + '/' + i))];
}
