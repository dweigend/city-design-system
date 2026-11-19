import { studioQuality, type StudioQuality } from './studio-quality';
import { Color, DoubleSide, type Material, type Node, type Texture } from 'three/webgpu';
import { attribute, color, float, normalWorld, vec3, vec4 } from 'three/tsl';
import type { Palette3D } from '../data/city3d';
import { printPatterns } from '../data/materialPrint';
import type { SurfaceRecipe } from '../logic/material/surface';
import { variationVorgabe } from '../logic/material/variation';
import { firedSlip } from './fired-slip';
import { architecturalPrint, type PrintInputs } from './architectural-print';
import { tokenColor } from './material';
import { metallUmgebung, type MetallLicht } from './materialMetallUmgebung';
import { physicalSurface } from './materialOberflaeche';
import { rezeptMaterial } from './materialRezept';
import { printedFinish } from './printed-finish';

const neutralPalette: Palette3D = {
	paper: '#ffffff',
	ink: '#000000',
	blueprint: '#000000',
	blueprintSoft: '#ffffff',
	categories: {}
};

type SurfaceOptions = {
	quality?: StudioQuality;
	double?: boolean;
	close?: boolean;
	environment?: Texture | null;
	time?: Node<'float'>;
	print?: PrintInputs;
	kiln?: Parameters<typeof firedSlip>;
	inlay?: Parameters<typeof printedFinish>[4];
};

/** Compiles a surface independently of its consumer. Instance buffers can supply interpolated print inputs. */
export function compileSurface(
	s: SurfaceRecipe,
	palette: Palette3D = neutralPalette,
	options: SurfaceOptions = {}
) {
	const double = options.double ?? true;
	switch (s.kind) {
		case 'physical':
			return physicalSurface(
				s.recipe,
				palette,
				s.id,
				double,
				options.environment ?? null,
				s.variation ?? variationVorgabe,
				options.quality ?? studioQuality()
			);
		case 'diagram':
			return rezeptMaterial(s.recipe, palette, double, options.time, s.pattern);
		case 'kiln': {
			const paper = color(new Color(palette.paper));
			const ink = color(new Color(palette.ink));
			const q = attribute('finishChart', 'vec4');
			const inputs: Parameters<typeof firedSlip> = options.kiln ?? [
				paper,
				ink,
				float(0),
				ink,
				float(0),
				color(tokenColor(palette, s.token)).rgb,
				vec4(q.w.sub(0.45), q.y, q.z, 1)
			];
			return firedSlip(...inputs);
		}
		case 'print':
			return printedFinish(s.id, s.token, palette, options.close ?? true, options.inlay);
		case 'pattern': {
			const p = attribute('finishChart', 'vec4');
			const inputs = options.print ?? {
				vN: normalWorld,
				vUV: vec4(p.x.add(p.z.mul(0.39)), p.y.add(p.z.mul(0.81)), 1, 1),
				vBogen: vec3(p.x, p.y, normalWorld.y.abs()),
				vFarbe: vec4(color(tokenColor(palette, s.token)), 1),
				vMuster: vec4(printPatterns[s.id], 1, 0, 1),
				vRuhe: p.xyz,
				tinte: color(new Color(palette.ink)),
				papier: color(new Color(palette.paper)),
				kanten: () => float(0)
			};
			const m = architecturalPrint(inputs, s.translucent);
			if (double) m.side = DoubleSide;
			return m;
		}
	}
}

/** Stage-owned cache. Identical recipes share a material until the palette, detail or resources change. */
export function createMaterialLibrary(
	initial: Palette3D = neutralPalette,
	environment: () => Texture | null = () => null,
	time?: Node<'float'>,
	quality = studioQuality()
) {
	let palette = initial;
	let close = true;
	const cache = new Map<string, Material>();
	const reflections = new Map<MetallLicht, Texture>();
	function reflection(s: SurfaceRecipe) {
		if (s.kind !== 'physical' || (s.id !== 'metall-messing' && s.id !== 'metall-kupfer'))
			return environment();
		let texture = reflections.get(s.id);
		if (!texture) {
			texture = metallUmgebung(s.id);
			reflections.set(s.id, texture);
		}
		return texture;
	}
	function dispose() {
		for (const m of cache.values()) m.dispose();
		for (const t of reflections.values()) t.dispose();
		reflections.clear();
	}
	return {
		material(s: SurfaceRecipe, double = true) {
			const key = JSON.stringify([s, double]);
			const found = cache.get(key);
			if (found) return found;
			const face = compileSurface(s, palette, {
				double,
				close,
				environment: reflection(s),
				time,
				quality
			});
			face.name = s.kind === 'diagram' ? (s.id ?? s.recipe.familie) : s.id;
			const release = () => {
				face.removeEventListener('dispose', release);
				cache.delete(key);
			};
			face.addEventListener('dispose', release);
			cache.set(key, face);
			return face;
		},
		retain(active: ReadonlySet<Material>) {
			for (const m of cache.values()) if (!active.has(m)) m.dispose();
		},
		setPalette(next: Palette3D) {
			if (palette !== next) {
				dispose();
				palette = next;
			}
		},
		setDetail(next: boolean) {
			if (close === next) return false;
			close = next;
			dispose();
			return true;
		},
		dispose
	};
}
