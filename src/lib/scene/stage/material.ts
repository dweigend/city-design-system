import {
	Color,
	DoubleSide,
	MeshBasicNodeMaterial,
	SRGBColorSpace,
	Vector3,
	type Node
} from 'three/webgpu';
import {
	hash,
	materialColor,
	mix,
	normalWorldGeometry,
	positionWorld,
	screenCoordinate,
	screenDPR,
	uniform,
	vec2
} from 'three/tsl';
import { createCatalog } from '../../core/catalog';
import { readDisplayPresentation } from '../focus';
import type { Finish, TerrainField } from '../surface';
import { projectTerrainField } from './field';
import { flatTolerance, graphite, grain, levels, sun, type drawingPalette } from './tone';
import { terrainColor } from './terrain';

const finishOpacity = {
	matte: 1,
	gloss: 1,
	glass: 0.7,
	line: 0,
	terrain: 1,
	shadow: 1
} satisfies Record<Finish, number>;

const finishes = createCatalog({
	rows: Object.entries(finishOpacity).map(([id, opacity]) => ({ id, opacity }))
});

const displays = createCatalog({
	rows: [
		{ id: 'normal', presentation: readDisplayPresentation('full') },
		{ id: 'transparency', presentation: readDisplayPresentation('transparent') }
	] as const,
	missingError: (id) => new RangeError(`Unknown stage display "${id}"`)
});

export type Display = (typeof displays.ids)[number];

export function readStagePresentation(display: Display) {
	return displays.get(display).presentation;
}

const displayStyles = {
	solid: (finish: Finish) => ({
		opacity: finishes.get(finish).opacity,
		paper: false
	}),
	ghost: (finish: Finish, hull: number) => ({ opacity: finish === 'line' ? 0 : hull, paper: true })
};

export function readDisplay(display: Display) {
	return displayStyles[readStagePresentation(display).treatment];
}

export function fillMaterial(palette: ReturnType<typeof drawingPalette>, field?: TerrainField) {
	const material = new MeshBasicNodeMaterial({
		side: DoubleSide,
		forceSinglePass: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1
	});
	const terrain = uniform(0);
	const flat = uniform(0);
	const heightScale = uniform(1);
	const hatch = uniform(0);
	const faces = uniform(new Vector3(levels.top, levels.lit, levels.shadow));
	const grainAmount = uniform(0);
	const grainCell = uniform(1);

	const atlas = field ? projectTerrainField(field) : undefined;
	material.colorNode = mix(
		mix(
			pencilFill(palette, materialColor, normalWorldGeometry, faces, grainAmount, grainCell, hatch),
			materialColor,
			flat
		),
		terrainColor(palette, heightScale, atlas?.sample),
		terrain
	);
	return {
		material,
		terrain,
		flat,
		heightScale,
		hatch,
		faces,
		grain: { amount: grainAmount, cell: grainCell },
		atlas: atlas?.image
	};
}

/** One pencil treatment for both retained batches and individually drawn surfaces. */
export function pencilFill(
	palette: ReturnType<typeof drawingPalette>,
	color: Node<'vec3'>,
	normal: Node<'vec3'>,
	faces: Node<'vec3'>,
	grainAmount: Node<'float'>,
	grainCell: Node<'float'>,
	hatch: Node<'float'>
) {
	const roof = normal.z.greaterThan(0.7);
	const facesLight = normal.xy.dot(vec2(...sun)).greaterThanEqual(-flatTolerance);
	const top = roof.and(facesLight);
	const shadow = roof.or(facesLight).not();
	const level = top.select(faces.x, shadow.select(faces.z, faces.y));
	const pressure = top.select(grain.top, shadow.select(grain.shadow, grain.lit));
	// Fine even grain of cork and card: one random lightness per world-space speck. The cell index
	// wraps every 509 specks, so the hash input stays exact in single precision at city scale.
	const speck = positionWorld.div(grainCell).floor().mod(509);
	const speckle = hash(speck.x.add(speck.y.mul(509)).add(speck.z.mul(259081))).sub(0.5);
	const fill = graphite(
		color,
		level.add(palette.dark.mul(0.076)).add(speckle.mul(grainAmount)).mul(palette.hull.oneMinus()),
		mix(pressure, grain.top, palette.hull)
	);
	// Sparse 45° pencil strokes, 5 CSS pixels apart, on the faces turned from the sun.
	const pixel = screenCoordinate.div(screenDPR);
	const across = pixel.x.add(pixel.y).div(5).fract().sub(0.5).abs().mul(5);
	const hatching = across.smoothstep(0.3, 0.9).oneMinus().mul(shadow.select(hatch, 0));
	return mix(fill, palette.ink, hatching.mul(0.55));
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
