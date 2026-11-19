/**
 * Material resolution: primitive (material, color, role) → display values.
 * Implements the combination rules from data/material.ts. Pure, without three.js.
 */
import {
	alphaSteps,
	diffusionSteps,
	edgeSteps,
	finishSteps,
	materialSpec,
	milkSteps,
	type PatternId,
	type Tint
} from '../../data/material';
import type { ColorToken, MaterialId, Primitive, Role } from './types';

/** Without the material system only these ids draw (existing stock of labs L1–L11). */
export const legacyMaterials: MaterialId[] = ['concrete', 'wood', 'metal'];

/** true if the primitive is drawn through the material system. */
export const usesMaterialSystem = (material: MaterialId, enabled = false) =>
	enabled || !legacyMaterials.includes(material);

/** Rules color × material × role. Returns the material and color actually drawn. */
export function resolveMaterial(p: {
	material: MaterialId;
	token: ColorToken;
	role: Role;
	kind?: Primitive['kind'];
	glass?: boolean;
}): { material: MaterialId; token: ColorToken } {
	let material = p.glass && legacyMaterials.includes(p.material) ? 'glass' : p.material;
	let token = p.token;
	const colored = token !== '--paper';
	// Existing stock: only matte white architectural model or ghost, never colored.
	if (p.role === 'bestand') {
		return { material: material === 'ghost' ? 'ghost' : 'paper', token: '--paper' };
	}
	// Flow color never on clear glass.
	if (material === 'glass' && colored) material = 'acrylic';
	// Water takes its color from the water flow.
	if (material === 'water') token = '--cat-health';
	return { material, token };
}

/** Drawing order of the translucent materials: inside and back first, hulls last. */
const order: Partial<Record<MaterialId, number>> = {
	water: 1,
	ghost: 2,
	greenhouse: 3,
	glass: 4,
	acrylic: 5,
	membrane: 6
};

export type MaterialLook = {
	material: MaterialId;
	/** Color: token, share of paper on top (sRGB mix), own tone for neutral surfaces. */
	token: ColorToken;
	paper: number;
	tint: Tint;
	/** Opacity of the surface after diffusion (the share that does not show through sharply). */
	opacity: number;
	transparent: boolean;
	/** Share of the surface that shows the blurred background; blur = mip level. */
	backdrop: number;
	blur: number;
	milk: number;
	contrast: number;
	sheen: number;
	gloss: number;
	pattern: PatternId | null;
	/** Edge: share of paper in the ink, relative width; null = no edge. */
	edge: { paper: number; width: number } | null;
	renderOrder: number;
};

/** Display values from the vocabulary. Few steps → few variants in the material cache. */
export function materialLook(material: MaterialId, token: ColorToken): MaterialLook {
	const spec = materialSpec(material);
	const alpha = alphaSteps[spec.alpha];
	const diffusion = diffusionSteps[spec.diffusion];
	const finish = finishSteps[spec.finish];
	const colored = token !== '--paper';
	// Visible: a surface, (1 − a)·d blurred, (1 − a)·(1 − d) sharp.
	const opacity = 1 - (1 - alpha) * (1 - diffusion.share);
	const backdrop = opacity > 0 ? ((1 - alpha) * diffusion.share) / opacity : 0;
	const paper =
		spec.color === 'neutral'
			? colored
				? spec.pigment
				: 1
			: spec.color === 'eigen'
				? spec.pigment
				: colored
					? spec.pigment
					: 1;
	return {
		material,
		token: spec.color === 'eigen' ? (spec.tint.toward ?? token) : token,
		paper,
		// With a flow color only the grain of natural materials stays (half the ink); lacquer stays pure.
		tint:
			colored && spec.color !== 'eigen'
				? { ink: spec.finish === 'matt' || material === 'wood' ? (spec.tint.ink ?? 0) / 2 : 0 }
				: spec.tint,
		opacity,
		transparent: opacity < 1,
		backdrop,
		blur: diffusion.blur,
		milk: milkSteps[spec.milk],
		contrast: finish.contrast,
		sheen: finish.sheen,
		gloss: finish.gloss,
		pattern: spec.pattern,
		edge: edgeSteps[spec.edge],
		renderOrder: order[material] ?? 0
	};
}
