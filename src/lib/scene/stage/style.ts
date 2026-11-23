import type { Scene } from 'three/webgpu';
import type { createContent } from './content';
import type { strokeMaterials } from './edges';
import { readColors, readDisplay, type Display } from './material';
import type { drawingPalette } from './tone';

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
		for (const {
			drawable,
			mesh,
			lines,
			grid,
			terrain,
			flat,
			heightScale,
			stretch,
			pivot
		} of content.parts) {
			const { opacity: displayOpacity, paper: paperDisplay } = style(drawable.finish, hull);
			const usePaper = paperDisplay && !drawable.preserveColor;
			const opacity =
				(drawable.fillAlpha ?? 1) *
				(!usePaper && drawable.opacity
					? Number(css.getPropertyValue(drawable.opacity) || displayOpacity)
					: displayOpacity);
			const visible = drawable.visible !== false;
			const material = mesh.material;
			const transparent = opacity < 1;
			const polygonOffset = !landscape && drawable.finish !== 'glass';
			terrain.value = Number(drawable.finish === 'terrain');
			flat.value = Number(drawable.flat === true);
			heightScale.value = drawable.heightScale ?? 1;
			const vertical = drawable.vertical;
			const scale = vertical?.scale ?? 1;
			const origin = vertical?.pivot ?? 0;
			stretch.value = vertical?.pinFillBelow ? scale - 1 : 0;
			pivot.value = origin;
			mesh.frustumCulled = !vertical;
			mesh.scale.z = vertical?.pinFillBelow ? 1 : scale;
			mesh.position.z = vertical?.pinFillBelow ? 0 : origin * (1 - scale);
			if (material.transparent !== transparent || material.polygonOffset !== polygonOffset)
				material.needsUpdate = true;
			Object.assign(material, { opacity, transparent, polygonOffset, depthWrite: !transparent });
			if (usePaper) material.color.copy(paper).lerp(color('--ink'), dark ? 0.09 : 0.19);
			else {
				material.color.copy(color(drawable.color));
				if (drawable.colorMix)
					material.color.lerp(color(drawable.colorMix.token), drawable.colorMix.amount);
			}
			mesh.visible =
				visible &&
				drawable.fillVisible !== false &&
				opacity > 0 &&
				mesh.geometry.attributes.position.count > 0;
			for (const line of lines) {
				if (grid) line.material.color.copy(color(drawable.color));
				if (drawable.strokeSegments) {
					const stroke = drawable.stroke;
					line.material.color.copy(usePaper ? ink : color(stroke?.color ?? drawable.color));
					line.material.linewidth = stroke?.width ?? 1;
					line.material.opacity = stroke?.opacity ?? 1;
				}
				line.scale.z = scale;
				line.position.z = origin * (1 - scale);
				line.frustumCulled = !vertical;
				line.visible = visible && line.geometry.instanceCount > 0 && line.material.opacity > 0;
			}
		}
	};
}
