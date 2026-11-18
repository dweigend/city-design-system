import * as THREE from 'three/webgpu';
import { abs, float, mix, normalWorld, uniform } from 'three/tsl';
import { MASSSTAB, STRICHE, TOENE } from '../../data/leitstil';
import { strichbreite, type Stil } from '../../logic/leitstil';
import { resolveParams, type ParamOverrides } from '../../logic/params';
import { neutral, type grammatik } from '../leitstil';
import { outlinePosition } from '../surfaces';
import { outlineExpansion, outlinePositionAtOffset } from './structure-outline';
import { STRUCTURE_PARAMS, type StructureVariant } from './view-params';

export type StructureMaterials = ReturnType<typeof structureMaterials>;

/** Materials for the model, paper, silhouette and the two interpretations of structural lines. */
export function structureMaterials() {
	const solidColor = uniform(neutral(TOENE.modellweiss));
	const flankColor = uniform(neutral(TOENE.modellweiss + TOENE.vorn));
	const sideColor = uniform(neutral(TOENE.modellweiss + TOENE.rechts));
	const bottomColor = uniform(neutral(TOENE.modellweiss + TOENE.unten));
	let envelopeShadows = true;
	let palette: ReturnType<typeof grammatik> | undefined;
	const colors = new Map<string, THREE.Color>();
	const paper = new THREE.Color();

	const materials = {
		sheet: new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide }),
		solid: new THREE.MeshBasicNodeMaterial({
			polygonOffset: true,
			polygonOffsetFactor: 1,
			polygonOffsetUnits: 1
		}),
		stock: new THREE.MeshBasicNodeMaterial({
			polygonOffset: true,
			polygonOffsetFactor: 1,
			polygonOffsetUnits: 1
		}),
		pencilHull: new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide }),
		pencil: new THREE.Line2NodeMaterial(),
		detail: new THREE.Line2NodeMaterial(),
		ghost: new THREE.MeshBasicNodeMaterial({
			transparent: true,
			opacity: 0.16,
			depthWrite: false,
			side: THREE.DoubleSide
		}),
		signal: new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, vertexColors: true }),
		primary: new THREE.Line2NodeMaterial(),
		secondary: new THREE.Line2NodeMaterial(),
		bearing: new THREE.MeshBasicNodeMaterial(),
		perimeter: new THREE.Line2NodeMaterial(),
		hull: new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide }),
		glass: new THREE.MeshBasicNodeMaterial({
			transparent: true,
			depthWrite: false,
			side: THREE.DoubleSide
		})
	};
	const outlinePx = uniform(STRICHE.kontur * outlineExpansion);
	const pencilPx = uniform(STRICHE.bestand / 2);
	materials.solid.colorNode = mix(
		mix(flankColor, sideColor, abs(normalWorld.x)),
		mix(bottomColor, solidColor, float(normalWorld.y.greaterThanEqual(0))),
		abs(normalWorld.y)
	);
	materials.sheet.colorNode = materials.solid.colorNode;
	materials.pencilHull.vertexNode = outlinePosition(pencilPx);
	materials.hull.vertexNode = outlinePositionAtOffset(outlinePx);

	function applyTones(g: ReturnType<typeof grammatik>) {
		palette = g;
		colors.clear();
		paper.copy(g.paper);

		solidColor.value.copy(g.weiss);
		flankColor.value.copy(neutral(g.modellL + TOENE.vorn));
		sideColor.value.copy(neutral(g.modellL + TOENE.rechts));
		bottomColor.value.copy(neutral(g.modellL + TOENE.unten));
		materials.stock.color.copy(paper);
		materials.glass.color.copy(g.weiss);
		materials.ghost.color.copy(g.blei);
		materials.pencil.color.copy(g.blei);
		materials.pencilHull.color.copy(g.blei);
		materials.detail.color.copy(g.detail);
		materials.hull.color.copy(g.kontur);
		materials.perimeter.color.copy(g.kontur);
		materials.bearing.color.copy(g.ink);
	}

	function setParams(overrides?: ParamOverrides<typeof STRUCTURE_PARAMS>) {
		materials.glass.opacity = resolveParams(STRUCTURE_PARAMS, undefined, overrides).glassOpacity;
	}
	setParams();

	function applyStructuralStyle(style: Stil, variant: StructureVariant, scale: number) {
		const { traeger, kontext } = style.rollen;
		const fine = style.kamera.pxProM <= MASSSTAB.quartier;
		const inInk = variant === 'leitstil';
		materials.primary.linewidth = inInk ? strichbreite(0.18, scale) : traeger.strichPx;
		const secondary = fine ? kontext.strichPx : strichbreite(0.1, scale);
		materials.secondary.linewidth = inInk ? secondary : traeger.strichPx;
		if (palette) {
			const ink = traeger.token === '--ink' ? palette.ink : palette.blei;
			materials.primary.color.copy(ink);
			materials.secondary.color.copy(inInk && fine ? palette.detail : ink);
		}
	}

	function colorOf(token: string) {
		const cached = colors.get(token);
		if (cached) return cached;
		const color = palette?.token(token) ?? paper;
		colors.set(token, color);
		return color;
	}

	return {
		materials,
		envelopeShadows: () => envelopeShadows,
		/** Palette lookup for detached colored parts. */
		colorOf,
		/** Applies the primitive's ink share to a flow color without changing the cached token. */
		accentColor(token: string, shade = 0) {
			const color = colorOf(token);
			return palette && shade ? color.clone().lerp(palette.ink, shade) : color;
		},
		setParams,
		/** The stage supplies the validated style and a new palette when the theme changes. */
		setStyle(
			style: Stil,
			variant: StructureVariant,
			scale: number,
			tones?: ReturnType<typeof grammatik>
		) {
			if (tones) applyTones(tones);
			const { bestand, huelle, kontext } = style.rollen;
			materials.pencil.linewidth = bestand.strichPx;
			pencilPx.value = bestand.strichPx / 2;
			outlinePx.value = huelle.strichPx * outlineExpansion;
			materials.perimeter.linewidth = huelle.strichPx;
			materials.detail.linewidth = kontext.strichPx;
			envelopeShadows = huelle.schatten;
			applyStructuralStyle(style, variant, scale);
			return Boolean(tones);
		},
		/** Releases shared materials. Mesh geometry belongs to the structure layer. */
		dispose() {
			for (const material of Object.values(materials)) material.dispose();
		}
	};
}
