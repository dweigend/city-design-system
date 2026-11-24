import { Color, type Scene } from 'three/webgpu';
import type { Drawable } from '../surface';
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
	let colors: ReturnType<typeof readColors>;
	let css: CSSStyleDeclaration;
	let previousDark: boolean | undefined;
	let previousDisplay: Display | undefined;
	const tint = new Color();
	return (display: Display, dark: boolean) => {
		const themeChanged = previousDark !== dark;
		if (themeChanged) {
			css = getComputedStyle(canvas);
			colors = readColors(css, canvas.ownerDocument);
			previousDark = dark;
		}
		const changed = themeChanged || previousDisplay !== display;
		previousDisplay = display;
		const color = colors;
		const paper = color('--paper');
		const hull = Number(css.getPropertyValue('--alpha-hull'));
		const ink = color('--ink-2');
		if (changed) {
			scene.background = paper;
			palette.ink.value.copy(ink);
			strokes.outer.color.copy(ink);
			strokes.crease.color.copy(ink);
			if (landscape) strokes.crease.color.lerp(paper, dark ? 0.13 : 0.04);
			strokes.ground.color.copy(paper).lerp(ink, 0.48);
			palette.dark.value = Number(dark);
			palette.hull.value = Number(display === 'transparency');
		}
		content.ground?.shadow.material.color.copy(paper).lerp(ink, dark ? 0.016 : 0.32);
		const style = readDisplay(display);
		content.update((drawable: Drawable, hasFill) => {
			const shade = drawable.finish === 'shadow';
			const { opacity: displayOpacity, paper: paperDisplay } = style(drawable.finish, hull);
			const usePaper = paperDisplay && !drawable.preserveColor && !shade;
			const alpha = shade
				? 1
				: (drawable.fillAlpha ?? 1) *
					(!usePaper && drawable.opacity
						? Number(css.getPropertyValue(drawable.opacity) || displayOpacity)
						: displayOpacity);
			const visible = drawable.visible !== false;
			const opacity = visible && hasFill && drawable.fillVisible !== false ? alpha : 0;
			if (shade) tint.copy(paper).lerp(color(drawable.color), drawable.fillAlpha ?? 1);
			else if (usePaper) tint.copy(paper).lerp(color('--ink'), dark ? 0.09 : 0.19);
			else {
				tint.copy(color(drawable.color));
				if (drawable.colorMix) tint.lerp(color(drawable.colorMix.token), drawable.colorMix.amount);
			}
			const scale = drawable.vertical?.scale ?? 1;
			const stroke = drawable.stroke;
			return {
				color: tint,
				strokeColor:
					usePaper && drawable.strokeSegments ? ink : color(stroke?.color ?? drawable.color),
				opacity,
				strokeOpacity: visible ? (stroke?.opacity ?? 1) : 0,
				width: stroke?.width ?? 1,
				hidden: stroke?.hidden ?? 0,
				recede: stroke?.recede ?? 0,
				visible,
				veil: opacity > 0 && opacity < 1 && drawable.occlude === true,
				scale,
				offset: (drawable.vertical?.pivot ?? 0) * (1 - scale)
			};
		}, changed);
	};
}
