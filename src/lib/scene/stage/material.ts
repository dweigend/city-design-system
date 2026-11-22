import { Color, DoubleSide, MeshBasicNodeMaterial, SRGBColorSpace } from 'three/webgpu';
import { materialColor, normalWorldGeometry, uniform, vec3 } from 'three/tsl';
import type { Finish } from '../surface';

const finishes = {
	matte: { opacity: 1, shade: 0.19 },
	gloss: { opacity: 1, shade: 0.29 },
	glass: { opacity: 0.56, shade: 0.08 },
	line: { opacity: 0, shade: 0 }
} satisfies Record<Finish, { opacity: number; shade: number }>;

const displays = {
	normal: (finish: Finish) => ({ ...finishes[finish], paper: false }),
	transparency: (finish: Finish) => ({
		opacity: finish === 'line' ? 0 : 0.26,
		shade: 0.18,
		paper: true
	})
};

export type Display = keyof typeof displays;

export function readDisplay(display: Display) {
	if (!Object.hasOwn(displays, display)) throw new RangeError(`Unknown stage display "${display}"`);
	return displays[display];
}

export function fillMaterial(finish: Finish) {
	const shade = uniform(0);
	const material = new MeshBasicNodeMaterial({
		side: DoubleSide,
		forceSinglePass: true,
		polygonOffset: finish !== 'glass',
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1
	});
	const light = vec3(-0.38, -0.45, 0.81).normalize();
	const shadow = normalWorldGeometry.dot(light).mul(-0.5).add(0.5);
	material.colorNode = materialColor.mul(shadow.mul(shade).oneMinus());
	return { material, shade };
}

export function readColors(canvas: HTMLCanvasElement) {
	const css = getComputedStyle(canvas);
	const pixel = canvas.ownerDocument.createElement('canvas');
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
