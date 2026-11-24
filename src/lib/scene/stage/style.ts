import { CustomBlending, MinEquation, NormalBlending, OneFactor, type Scene } from 'three/webgpu';
import { warpPart, type createContent } from './content';
import type { strokeMaterials } from './edges';
import { readColors, readDisplay, type Display } from './material';
import { levels, type drawingPalette } from './tone';

export function createStyle(
	canvas: HTMLCanvasElement,
	content: ReturnType<typeof createContent>,
	palette: ReturnType<typeof drawingPalette>,
	strokes: ReturnType<typeof strokeMaterials>,
	scene: Scene,
	landscape: boolean
) {
	let colors: ReturnType<typeof readColors> | undefined;
	let css: CSSStyleDeclaration;
	let previousDark: boolean | undefined;
	return (display: Display, dark: boolean) => {
		if (!colors || previousDark !== dark) {
			css = getComputedStyle(canvas);
			colors = readColors(css, canvas.ownerDocument);
			previousDark = dark;
		}
		const color = colors;
		const paper = color('--paper');
		const hull = Number(css.getPropertyValue('--alpha-hull'));
		scene.background = paper;
		const ink = color('--ink-2');
		palette.ink.value.copy(ink);

		strokes.outer.color.copy(ink);
		strokes.crease.color.copy(ink);
		if (landscape) strokes.crease.color.lerp(paper, dark ? 0.13 : 0.04);
		strokes.ground.color.copy(paper).lerp(ink, 0.48);
		content.ground?.shadow.material.color.copy(paper).lerp(ink, dark ? 0.016 : 0.32);
		palette.dark.value = Number(dark);
		palette.hull.value = Number(display === 'transparency');
		const style = readDisplay(display);
		for (const part of content.parts) {
			const { drawable, mesh, veil, lines, recede, grid, terrain, flat, heightScale, hatch } = part;
			warpPart(part);
			const shade = drawable.finish === 'shadow';
			const { opacity: displayOpacity, paper: paperDisplay } = style(drawable.finish, hull);
			const usePaper = paperDisplay && !drawable.preserveColor && !shade;
			const opacity = shade
				? 1
				: (drawable.fillAlpha ?? 1) *
					(!usePaper && drawable.opacity
						? Number(css.getPropertyValue(drawable.opacity) || displayOpacity)
						: displayOpacity);
			const visible = drawable.visible !== false;
			const material = mesh.material;
			const transparent = opacity < 1;
			const polygonOffset = !landscape && drawable.finish !== 'glass';
			terrain.value = Number(drawable.finish === 'terrain');
			flat.value = Number(drawable.flat === true || shade);
			heightScale.value = drawable.heightScale ?? 1;
			hatch.value = drawable.hatch ?? 0;
			part.grain.amount.value = drawable.grain?.amount ?? 0;
			part.grain.cell.value = drawable.grain?.cellM ?? 1;
			const face = drawable.faces ?? levels;
			part.faces.value.set(face.top, face.lit, face.shadow);
			const vertical = drawable.vertical;
			const scale = vertical?.scale ?? 1;
			const offset = (vertical?.pivot ?? 0) * (1 - scale);
			mesh.scale.z = scale;
			mesh.position.z = offset;
			const blending = shade ? CustomBlending : NormalBlending;
			if (
				material.transparent !== transparent ||
				material.polygonOffset !== polygonOffset ||
				material.blending !== blending
			)
				material.needsUpdate = true;
			// Ground shade keeps the darker of shade and ground, so overlapping shadows never stack.
			Object.assign(material, {
				opacity,
				transparent,
				polygonOffset,
				blending,
				blendEquation: MinEquation,
				blendSrc: OneFactor,
				blendDst: OneFactor,
				depthTest: !shade,
				depthWrite: !transparent && !shade
			});
			if (shade) material.color.copy(paper).lerp(color(drawable.color), drawable.fillAlpha ?? 1);
			else if (usePaper) material.color.copy(paper).lerp(color('--ink'), dark ? 0.09 : 0.19);
			else {
				material.color.copy(color(drawable.color));
				if (drawable.colorMix)
					material.color.lerp(color(drawable.colorMix.token), drawable.colorMix.amount);
			}
			mesh.visible =
				visible &&
				drawable.fillVisible !== false &&
				(opacity > 0 || shade) &&
				mesh.geometry.attributes.position.count > 0;
			veil.visible = mesh.visible && transparent && drawable.occlude === true;
			for (const [index, line] of lines.entries()) {
				if (grid) line.material.color.copy(color(drawable.color));
				if (drawable.strokeSegments) {
					const stroke = drawable.stroke;
					const hidden = index === 1;
					line.material.color.copy(usePaper ? ink : color(stroke?.color ?? drawable.color));
					line.material.linewidth = (stroke?.width ?? 1) * (hidden ? 0.75 : 1);
					line.material.opacity = (stroke?.opacity ?? 1) * (hidden ? (stroke?.hidden ?? 0) : 1);
					recede[index].value = stroke?.recede ?? 0;
				}
				line.scale.z = scale;
				line.position.z = offset;
				line.frustumCulled = !vertical && !drawable.warp;
				line.visible = visible && line.geometry.instanceCount > 0 && line.material.opacity > 0;
			}
		}
	};
}
