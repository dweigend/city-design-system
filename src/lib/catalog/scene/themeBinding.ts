import { onThemeChange } from '../theme';
import type { Palette3D } from '../data/city3d';
import { Color, type Scene, type ColorRepresentation } from 'three';
/**
 * Resolves color tokens in the context of host to #rrggbb (sRGB, 8 bit). The tokens live in OKLCH
 * and as step expressions in app.css; three.js reads only hex. The browser does the math: a
 * probe element for var() and relative colors, a 1-px canvas for the conversion to sRGB.
 */
export function resolveTokens(host: HTMLElement, names: readonly string[]): Record<string, string> {
	const probe = document.createElement('span');
	probe.hidden = true;
	host.appendChild(probe);
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 1;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	const out: Record<string, string> = {};
	for (const name of names) {
		probe.style.color = `var(${name})`;
		const css = getComputedStyle(probe).color;
		if (!ctx) {
			out[name] = css;
			continue;
		}
		ctx.clearRect(0, 0, 1, 1);
		ctx.fillStyle = '#000';
		ctx.fillStyle = css;
		ctx.fillRect(0, 0, 1, 1);
		const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
		out[name] = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
	}
	probe.remove();
	return out;
}

const CATEGORIES = ['living', 'health', 'mobility', 'business', 'nature', 'hazard'];

export function readPalette(host: HTMLElement): Palette3D {
	const names = [
		'paper',
		'ink',
		'blueprint',
		'blueprint-soft',
		'signal',
		...CATEGORIES.map((c) => `cat-${c}`)
	];
	const t = resolveTokens(
		host,
		names.map((n) => `--${n}`)
	);
	const token = (name: string) => t[`--${name}`];
	return {
		paper: token('paper'),
		ink: token('ink'),
		blueprint: token('blueprint'),
		blueprintSoft: token('blueprint-soft'),
		categories: {
			...Object.fromEntries(CATEGORIES.map((name) => [name, token(`cat-${name}`)])),
			'--signal': token('signal')
		}
	};
}

/** Bind once per renderer. CSS is read synchronously after theme/ projects its attributes.
 * Register after scene construction; dispose before releasing GPU resources.
 * Detached thumbnail canvases use the document palette. A palette projection can
 * hold studio paper and ink constant while still resolving live semantic tokens.
 */
export function bindSceneTheme(
	canvas: HTMLCanvasElement,
	scene: Scene,
	renderer: { setClearColor(color: ColorRepresentation, alpha?: number): void },
	apply: (palette: Palette3D) => void,
	projekt: (palette: Palette3D) => Palette3D = (palette) => palette
): () => void {
	const refresh = () => {
		const palette = projekt(readPalette(canvas.parentElement ?? document.documentElement));
		scene.background = new Color(palette.paper);
		renderer.setClearColor(palette.paper, 1);
		canvas.dataset.themePaper = palette.paper;
		apply(palette);
	};
	const stop = onThemeChange(refresh);
	try {
		refresh();
	} catch (error) {
		stop();
		throw error;
	}
	return stop;
}
