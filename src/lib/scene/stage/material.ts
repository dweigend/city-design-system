import { Color, DoubleSide, MeshBasicNodeMaterial, SRGBColorSpace } from 'three/webgpu';
import { materialColor, mix, normalWorldGeometry, uniform, vec2 } from 'three/tsl';
import type { Finish, TerrainField } from '../surface';
import { projectTerrainField } from './field';
import { graphite, grain, levels, sun, type drawingPalette } from './tone';
import { terrainColor } from './terrain';

const finishes = { matte: 1, gloss: 1, glass: 0.7, line: 0, terrain: 1 } satisfies Record<
	Finish,
	number
>;

const displays = {
	normal: (finish: Finish) => ({ opacity: finishes[finish], paper: false }),
	transparency: (finish: Finish, hull: number) => ({
		opacity: finish === 'line' ? 0 : hull,
		paper: true
	})
};
export type Display = keyof typeof displays;
export function readDisplay(display: Display) {
	if (!Object.hasOwn(displays, display)) throw new RangeError(`Unknown stage display "${display}"`);
	return displays[display];
}

export function fillMaterial(
	palette: ReturnType<typeof drawingPalette>,
	field?: TerrainField,
	evenRoof = false
) {
	const material = new MeshBasicNodeMaterial({
		side: DoubleSide,
		forceSinglePass: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1
	});
	const terrain = uniform(0);
	const flat = uniform(0);
	const heightScale = uniform(1);
	const normal = normalWorldGeometry;
	const roof = normal.z.greaterThan(0.7);
	const facesLight = normal.xy.dot(vec2(...sun)).greaterThanEqual(0);
	// Planning canopies inherit small slopes from the ground. Keep a continuous roof tone.
	const top = evenRoof ? roof : roof.and(facesLight);
	const shadow = roof.or(facesLight).not();
	const level = top.select(levels.top, shadow.select(levels.shadow, levels.lit));
	const pressure = top.select(grain.top, shadow.select(grain.shadow, grain.lit));
	const fill = graphite(
		materialColor,
		level.add(palette.dark.mul(0.076)).mul(palette.hull.oneMinus()),
		mix(pressure, grain.top, palette.hull)
	);
	const atlas = field ? projectTerrainField(field) : undefined;
	material.colorNode = mix(
		mix(fill, materialColor, flat),
		terrainColor(palette, heightScale, atlas?.sample),
		terrain
	);
	return { material, terrain, flat, heightScale, atlas: atlas?.image };
}

export function readColors(css: CSSStyleDeclaration, document: Document) {
	const pixel = document.createElement('canvas');
	pixel.width = pixel.height = 1;
	const context = pixel.getContext('2d', { willReadFrequently: true });
	if (!context) throw new Error('Cannot resolve the stage CSS palette');
	const colors = new Map<string, Color>();
	return (token: string): Color => {
		const cached = colors.get(token);
		if (cached) return cached;
		context.clearRect(0, 0, 1, 1);
		context.fillStyle =
			css.getPropertyValue(token).trim() || css.getPropertyValue('--paper').trim();
		context.fillRect(0, 0, 1, 1);
		const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
		const color = new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
		colors.set(token, color);
		return color;
	};
}
