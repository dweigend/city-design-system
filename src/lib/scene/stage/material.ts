import { Color, DoubleSide, MeshBasicNodeMaterial, SRGBColorSpace } from 'three/webgpu';
import {
	hash,
	materialColor,
	mix,
	normalWorldGeometry,
	screenCoordinate,
	screenDPR,
	uniform,
	vec2
} from 'three/tsl';
import type { Finish } from '../surface';

const finishes = {
	matte: { opacity: 1, shade: 0.44 },
	gloss: { opacity: 1, shade: 0.51 },
	glass: { opacity: 0.7, shade: 0.21 },
	line: { opacity: 0, shade: 0 }
} satisfies Record<Finish, { opacity: number; shade: number }>;

const displays = {
	normal: (finish: Finish) => ({ opacity: finishes[finish].opacity, paper: false }),
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

export function drawingPalette() {
	return {
		light: uniform(new Color()),
		shade: uniform(new Color()),
		ink: uniform(new Color()),
		hull: uniform(0)
	};
}

export function fillMaterial(finish: Finish, palette: ReturnType<typeof drawingPalette>) {
	const material = new MeshBasicNodeMaterial({
		side: DoubleSide,
		forceSinglePass: true,
		polygonOffset: finish !== 'glass',
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1
	});
	const normal = normalWorldGeometry;
	const top = normal.z.greaterThan(0.7);
	const shadow = normal.xy.dot(vec2(-0.6, -0.8)).lessThan(0);
	const tone = top.select(
		mix(materialColor, palette.light, 0.34),
		shadow.select(mix(materialColor, palette.shade, finishes[finish].shade), materialColor)
	);

	// Anchor graphite to CSS pixel cells, including on a high-DPR canvas.
	const pixel = screenCoordinate.div(screenDPR).floor();
	const grain = hash(pixel.x.add(pixel.y.mul(4093)));
	const pressure = top.select(0, shadow.select(0.21, 0.095));
	material.colorNode = mix(
		mix(tone, palette.ink, grain.mul(pressure)),
		materialColor,
		palette.hull
	);
	return material;
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
