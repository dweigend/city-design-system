import { Color, type Object3D } from 'three/webgpu';
import {
	Discard,
	Fn,
	float,
	mix,
	normalWorldGeometry,
	output,
	renderGroup,
	screenCoordinate,
	uniform,
	vec3,
	vec4
} from 'three/tsl';
import type { Palette3D } from '../../data/city3d';
import { studioKeyDirection } from '../studio-light';

export type TerrainLook = ReturnType<typeof createTerrainLook>;

/** Shades retained structures as plain volumes in the studio beauty pass. */
export function createTerrainLook() {
	const tones = new WeakMap<Object3D, number>();
	// The view and palette belong to the pass. Cached draws still refresh shared bindings.
	const enabled = uniform(0).setGroup(renderGroup);
	const schematic = uniform(0).setGroup(renderGroup);
	const light = uniform(new Color()).setGroup(renderGroup);
	const shade = uniform(new Color()).setGroup(renderGroup);
	const ghosts = new WeakSet<Object3D>();
	const ghost = uniform(0).onObjectUpdate(({ object }) => Number(object && ghosts.has(object)));
	const tone = uniform(0).onObjectUpdate(({ object }) => (object ? (tones.get(object) ?? 0) : 0));
	const face = normalWorldGeometry.dot(vec3(studioKeyDirection)).mul(0.5).add(0.5);
	const form = mix(shade, light, face.mul(tone));
	return {
		beauty: Fn(() => {
			const ghosted = schematic.mul(ghost);
			const dot = screenCoordinate.x.floor().add(screenCoordinate.y.floor()).mod(2);
			Discard(ghosted.mul(dot).greaterThan(0.5));
			const relief = mix(output.rgb, form, enabled.mul(float(tone.greaterThan(0))));
			return vec4(mix(relief, mix(light, shade, 0.4), ghosted), output.a);
		})(),
		/** Registers the projected batch and its fixed terrain tone, including moving parts. */
		mark(this: void, group: Object3D, key: string) {
			const wooded = key.startsWith('forest:');
			const house = key.startsWith('house:') || key.startsWith('visual:stock-overview:');
			group.traverse((object) => {
				tones.set(object, wooded ? 0.35 : 1);
				if (house) ghosts.add(object);
			});
		},
		/** Uses the lighter of the palette's two neutrals for the paper volumes. */
		setPalette(palette: Palette3D) {
			const paper = new Color(palette.paper);
			const ink = new Color(palette.ink);
			const daylight = paper.r >= ink.r;
			const bright = daylight ? paper : ink;
			const dark = daylight ? ink : paper;
			light.value.copy(bright).lerp(dark, 0.08);
			shade.value.copy(bright).lerp(dark, 0.68);
		},
		/** Enables the terrain display without changing geometry or materials. */
		set(enabledView: boolean, schematicView: boolean) {
			enabled.value = Number(enabledView);
			schematic.value = Number(schematicView);
		}
	};
}
