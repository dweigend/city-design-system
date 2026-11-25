import { defaults } from '../../../config/stage';
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

const opaqueFill = /* Exact arithmetic: full opacity renders an opaque fill. */ 1;
const noFill = /* Exact arithmetic: zero opacity omits the fill for line-only parts. */ 0;

const finishOpacity = {
	matte: opaqueFill,
	gloss: opaqueFill,
	glass: defaults.stageGlassOpacity,
	line: noFill,
	terrain: opaqueFill,
	shadow: opaqueFill
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
		polygonOffsetFactor: defaults.stageFillDepthFactor,
		polygonOffsetUnits: defaults.stageFillDepthBias
	});
	const terrain = uniform(
		/* Exact arithmetic: zero initializes a flag or disables its effect. */ 0
	);
	const flat = uniform(/* Exact arithmetic: zero initializes a flag or disables its effect. */ 0);
	const heightScale = uniform(
		/* Exact arithmetic: unit scale before applying drawable parameters. */ 1
	);
	const hatch = uniform(/* Exact arithmetic: zero initializes a flag or disables its effect. */ 0);
	const faces = uniform(new Vector3(levels.top, levels.lit, levels.shadow));
	const grainAmount = uniform(
		/* Exact arithmetic: zero initializes a flag or disables its effect. */ 0
	);
	const grainCell = uniform(
		/* Exact arithmetic: unit scale before applying drawable parameters. */ 1
	);

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
	const roof = normal.z.greaterThan(defaults.stageRoofNormalZ);
	const facesLight = normal.xy.dot(vec2(...sun)).greaterThanEqual(-flatTolerance);
	const top = roof.and(facesLight);
	const shadow = roof.or(facesLight).not();
	const level = top.select(faces.x, shadow.select(faces.z, faces.y));
	const pressure = top.select(grain.top, shadow.select(grain.shadow, grain.lit));
	// Fine even grain of cork and card: one random lightness per world-space speck. The cell index
	// wraps every 509 specks, so the hash input stays exact in single precision at city scale.
	const speck = positionWorld.div(grainCell).floor().mod(defaults.stageSpeckPeriod);
	const speckle = hash(
		speck.x
			.add(speck.y.mul(defaults.stageSpeckPeriod))
			.add(speck.z.mul(defaults.stageSpeckPeriod ** 2))
	).sub(/* Exact arithmetic: center the normalized phase around zero. */ 0.5);
	const fill = graphite(
		color,
		level
			.add(palette.dark.mul(defaults.stageDarkFillLift))
			.add(speckle.mul(grainAmount))
			.mul(palette.hull.oneMinus()),
		mix(pressure, grain.top, palette.hull)
	);
	// Sparse 45° pencil strokes, 5 CSS pixels apart, on the faces turned from the sun.
	const pixel = screenCoordinate.div(screenDPR);
	const across = pixel.x
		.add(pixel.y)
		.div(defaults.stageHatchSpacingPx)
		.fract()
		.sub(/* Exact arithmetic: center the normalized phase around zero. */ 0.5)
		.abs()
		.mul(defaults.stageHatchSpacingPx);
	const hatching = across
		.smoothstep(...defaults.stageHatchSoftEdgePx)
		.oneMinus()
		.mul(shadow.select(hatch, /* Exact arithmetic: zero omits hatching on lit faces. */ 0));
	return mix(fill, palette.ink, hatching.mul(defaults.stageHatchInkShare));
}

export function readColors(css: CSSStyleDeclaration, document: Document) {
	const pixel = document.createElement('canvas');
	pixel.width = pixel.height = /* Exact arithmetic: the color probe needs one pixel. */ 1;
	const context = pixel.getContext('2d', { willReadFrequently: true });
	if (!context) throw new Error('Cannot resolve the stage CSS palette');
	const colors = new Map<string, Color>();
	return (token: string): Color => {
		const cached = colors.get(token);
		if (cached) return cached;
		context.clearRect(
			/* Exact arithmetic: one-pixel origin. */ 0,
			/* Exact arithmetic: one-pixel origin. */ 0,
			/* Exact arithmetic: width of the color probe. */ 1,
			/* Exact arithmetic: height of the color probe. */ 1
		);
		context.fillStyle =
			css.getPropertyValue(token).trim() || css.getPropertyValue('--paper').trim();
		context.fillRect(
			/* Exact arithmetic: one-pixel origin. */ 0,
			/* Exact arithmetic: one-pixel origin. */ 0,
			/* Exact arithmetic: width of the color probe. */ 1,
			/* Exact arithmetic: height of the color probe. */ 1
		);
		const [r, g, b] = context.getImageData(
			/* Exact arithmetic: one-pixel origin. */ 0,
			/* Exact arithmetic: one-pixel origin. */ 0,
			/* Exact arithmetic: width of the color probe. */ 1,
			/* Exact arithmetic: height of the color probe. */ 1
		).data;
		const color = new Color().setRGB(
			r / /* Exact arithmetic: maximum unsigned 8-bit channel value. */ 255,
			g / /* Exact arithmetic: maximum unsigned 8-bit channel value. */ 255,
			b / /* Exact arithmetic: maximum unsigned 8-bit channel value. */ 255,
			SRGBColorSpace
		);
		colors.set(token, color);
		return color;
	};
}
