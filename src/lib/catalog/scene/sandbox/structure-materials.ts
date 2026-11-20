import type { StudioQuality } from '../studio-quality';
import { pencilStock } from '../pencil-stock';
import * as THREE from 'three/webgpu';
import {
	abs,
	attribute,
	float,
	mix,
	positionLocal,
	uniform,
	vec3,
	vec4,
	modelWorldMatrixInverse
} from 'three/tsl';
import { LICHT, MASSSTAB, STRICHE } from '../../data/leitstil';
import { strichbreite, type Stil } from '../../logic/leitstil';
import { resolveParams, type ParamOverrides } from '../../core/params';
import type { grammatik } from '../leitstil';
import { createMaterialLibrary } from '../material-library';
import { plateContours } from './plate-contours';
import { conduitInk } from './print-flow';
import type { Primitive } from '../../logic/parametrik/types';
import type { Rgb } from '../../logic/farbe/oklch';
import { overprintColor } from '../../logic/farbe/overprint';
import { faceHalftone, halftoneScreen } from '../printed-finish';
import { STRUCTURE_PARAMS, type MinimumInk } from './view-params';

export type StructureMaterials = ReturnType<typeof structureMaterials>;

/** Materials for the model, paper, silhouette and the two interpretations of structural lines. */
export function structureMaterials(
	quality?: StudioQuality,
	cityEdges = false,
	receiverOutput?: THREE.Node<'vec4'>
) {
	const contours = cityEdges ? undefined : plateContours();
	let envelopeShadows = true;
	let minContourPx = STRUCTURE_PARAMS.minContourPx.default;
	let palette: ReturnType<typeof grammatik> | undefined;
	const colors = new Map<string, THREE.Color>();
	const overprints = new Map<string, THREE.Color>();
	const paper = new THREE.Color();

	const seconds = uniform(0);
	const explicit = createMaterialLibrary(undefined, undefined, seconds, quality);
	const paperTone = uniform(new THREE.Color());
	const markTone = uniform(new THREE.Color());
	const BodyMaterial = cityEdges ? THREE.MeshStandardNodeMaterial : THREE.MeshBasicNodeMaterial;
	const materials = {
		conduit: conduitInk(seconds, markTone),
		sheet: new BodyMaterial({ side: THREE.DoubleSide }),
		solid: new BodyMaterial({
			polygonOffset: true,
			polygonOffsetFactor: 1,
			polygonOffsetUnits: 1
		}),
		stock: new THREE.MeshBasicNodeMaterial({
			polygonOffset: true,
			polygonOffsetFactor: 1,
			polygonOffsetUnits: 1
		}),
		stockDetail: new THREE.Line2NodeMaterial(),
		stockSheet: new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide }),
		pencil: new THREE.Line2NodeMaterial({ transparent: cityEdges, opacity: cityEdges ? 0.56 : 1 }),
		detail: new THREE.Line2NodeMaterial(),
		rail: new THREE.Line2NodeMaterial(),
		carrierInk: new THREE.Line2NodeMaterial(),
		portalInk: new THREE.Line2NodeMaterial(),
		braceInk: new THREE.Line2NodeMaterial(),
		pod: new BodyMaterial(),
		ghost: new THREE.MeshBasicNodeMaterial({
			transparent: true,
			opacity: 0.16,
			depthWrite: false,
			side: THREE.DoubleSide
		}),
		signal: new BodyMaterial({ side: THREE.DoubleSide, vertexColors: true }),
		primary: new THREE.Line2NodeMaterial(),
		stockPrimary: new THREE.Line2NodeMaterial(),
		secondary: new THREE.Line2NodeMaterial(),
		rib: new THREE.Line2NodeMaterial(),
		planned: new THREE.Line2NodeMaterial({ dashed: true, dashSize: 0.6, gapSize: 0.4 }),
		bearing: new THREE.MeshBasicNodeMaterial(),
		perimeter: new THREE.Line2NodeMaterial(),
		glass: new THREE.MeshBasicNodeMaterial({
			transparent: true,
			depthWrite: false,
			side: THREE.DoubleSide
		})
	};
	const bodyColor = attribute<'vec3'>('color', 'vec3');
	const printInk = uniform(new THREE.Color());
	const screen = faceHalftone(halftoneScreen(true).pitch);
	const canScreen = attribute('printScreen', 'float');
	const paperFace = bodyColor.sub(paperTone.rgb).length().lessThan(0.001);
	materials.solid.colorNode = mix(
		bodyColor,
		printInk,
		screen.mul(canScreen).mul(float(paperFace.not()))
	);
	if (cityEdges) materials.solid.colorNode = bodyColor;
	const seam = attribute('printSeam', 'float');
	const upper = seam.greaterThanEqual(0);
	const seamMask = abs(seam).lessThanEqual(seam.fwidth().mul(0.375));
	materials.pod.colorNode = mix(
		mix(
			upper.select(paperTone.rgb, bodyColor),
			printInk,
			screen.mul(canScreen).mul(float(upper.or(paperFace).not()))
		),
		printInk,
		float(seamMask)
	);
	if (cityEdges) materials.pod.colorNode = bodyColor;
	const planLength = Math.hypot(LICHT[0], LICHT[1]);
	const shift = attribute('printOffset', 'float');
	const downLight = vec3(LICHT[0] / planLength, 0, -LICHT[1] / planLength).mul(shift);
	const localShift = modelWorldMatrixInverse.mul(vec4(downLight, 0)).xyz;
	for (const material of [materials.solid, materials.sheet, materials.pod])
		material.castShadowPositionNode = cityEdges ? positionLocal : positionLocal.add(localShift);
	const graphite = uniform(new THREE.Color());
	materials.stock.colorNode = pencilStock(paperTone.rgb, graphite.rgb);
	materials.sheet.colorNode = materials.solid.colorNode;
	materials.stockSheet.colorNode = materials.stock.colorNode;
	materials.stock.outputNode = materials.stockSheet.outputNode = receiverOutput ?? null;

	function applyTones(g: ReturnType<typeof grammatik>) {
		palette = g;
		colors.clear();
		overprints.clear();
		paper.copy(g.paper);
		contours?.setTones(g);
		graphite.value.copy(g.blei);
		paperTone.value.copy(g.paper);

		markTone.value.copy(g.token('--cat-business-2'));
		materials.stock.color.copy(paper);
		materials.stockSheet.color.copy(paper);
		materials.glass.color.copy(g.weiss);
		materials.ghost.color.copy(g.blei);
		materials.pencil.color.copy(g.paper).lerp(g.ink, 0.48);
		materials.stockDetail.color.copy(g.blei);
		materials.detail.color.copy(g.detail);
		materials.rail.color.copy(g.detail);
		materials.perimeter.color.copy(g.kontur);
		materials.bearing.color.copy(g.ink);
		printInk.value.copy(g.token('--ink'));
		for (const line of [materials.carrierInk, materials.portalInk, materials.braceInk])
			line.color.copy(g.ink);
	}

	function setParams(overrides?: ParamOverrides<typeof STRUCTURE_PARAMS>) {
		const profile = resolveParams(STRUCTURE_PARAMS, undefined, overrides);
		materials.glass.opacity = profile.glassOpacity;
		minContourPx = profile.minContourPx;
	}
	setParams();

	function applyStructuralStyle(style: Stil, minimum: MinimumInk, scale: number) {
		const { traeger } = style.rollen;
		const ink = palette?.[traeger.token === '--ink' ? 'ink' : 'blei'];
		const far = scale < MASSSTAB.quartier;
		materials.bearing.visible = !far;
		materials.carrierInk.linewidth = far ? STRICHE.bestand : 0.18 * scale;
		materials.portalInk.linewidth = far ? STRICHE.bestand : 0.12 * scale;
		materials.braceInk.linewidth = STRICHE.bestand;
		materials.braceInk.visible = !far;
		styleCarrierStrokes(scale, minimum, far, ink);
		styleStock(style);
	}

	function styleCarrierStrokes(
		scale: number,
		minimum: MinimumInk,
		far: boolean,
		ink: NonNullable<typeof palette>['ink'] | undefined
	) {
		for (const [diameter, material] of [
			[0.18, materials.primary],
			[0.14, materials.rib],
			[0.1, materials.secondary]
		] as const) {
			const px = diameter * scale;
			// At town scale carriers recede to a hairline, so the colour bodies carry the image.
			material.linewidth = far
				? STRICHE.detail * 0.7
				: diameter === 0.18 || minimum === 'all'
					? strichbreite(diameter, scale)
					: px;
			const color = material.linewidth >= STRICHE.minimumTraeger ? ink : palette?.detail;
			if (color) material.color.copy(color);
		}
	}

	function styleStock(style: Stil) {
		materials.planned.linewidth = style.rollen.geplant.strichPx;

		materials.stockPrimary.linewidth = STRICHE.bestand;
		if (palette) {
			materials.planned.color.copy(palette.blei);
			materials.stockPrimary.color.copy(palette.blei);
		}
	}
	function colorOf(token: string) {
		const cached = colors.get(token);
		if (cached) return cached;
		const color = palette?.token(token) ?? paper;
		colors.set(token, color);
		return color;
	}

	/** Resolves a flat print patch against the same palette as its source pigments. */
	function printColor(part: Primitive) {
		const base = colorOf(part.token);
		if (!part.overprint || !palette) return base;
		const key = part.token + '/' + part.overprint;
		const cached = overprints.get(key);
		if (cached) return cached;
		const rgb = ({ r, g, b }: THREE.Color): Rgb => [r, g, b];
		const pigment = overprintColor(
			{ token: part.token, rgb: rgb(base) },
			{ token: part.overprint, rgb: rgb(colorOf(part.overprint)) },
			rgb(paper)
		);
		if (!pigment) return base;
		const color = new THREE.Color(...pigment);
		overprints.set(key, color);
		return color;
	}

	function ageColor(color: THREE.Color, part: Primitive) {
		return !cityEdges && part.ageTint ? color.clone().lerp(paper, part.ageTint) : color;
	}

	return {
		explicit,
		contours,
		materials,
		envelopeShadows: () => envelopeShadows,
		minContourPx: () => minContourPx,
		surfaceColor: (part: Primitive) => ageColor(printColor(part), part),
		/** Applies the primitive's ink share to a flow color without changing the cached token. */
		accentColor(this: void, part: Primitive) {
			const color = colorOf(part.token);
			const shaded = palette && part.shade ? color.clone().lerp(palette.ink, part.shade) : color;
			return ageColor(shaded, part);
		},
		seconds,
		setParams,
		/** The stage supplies the validated style and a new palette when the theme changes. */
		setStyle(
			style: Stil,
			minimum: MinimumInk,
			scale: number,
			tones?: ReturnType<typeof grammatik>
		) {
			if (tones) applyTones(tones);
			const { bestand, huelle, kontext } = style.rollen;
			contours?.setWidth(bestand.strichPx, huelle.strichPx, scale);
			materials.pencil.linewidth = bestand.strichPx;
			materials.stockDetail.linewidth = bestand.strichPx;
			materials.stockDetail.visible = style.kamera.pxProM >= MASSSTAB.haus;
			materials.perimeter.linewidth = huelle.strichPx;
			materials.detail.linewidth = kontext.strichPx;
			materials.rail.linewidth = kontext.strichPx;
			materials.rail.visible = style.kamera.pxProM > MASSSTAB.quartier;
			envelopeShadows = cityEdges || huelle.schatten;
			applyStructuralStyle(style, minimum, scale);
			const close = style.rollen.weg.level !== 'block';
			const detailChanged = explicit.setDetail(close);
			return detailChanged || Boolean(tones);
		},
		/** Releases shared materials. Mesh geometry belongs to the structure layer. */
		dispose() {
			explicit.dispose();
			contours?.dispose();
			for (const material of Object.values(materials)) material.dispose();
		}
	};
}
