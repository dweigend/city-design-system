import * as THREE from 'three/webgpu';
import {
	color,
	faceDirection,
	float,
	mix,
	normalView,
	positionLocal,
	positionView,
	positionWorld,
	vec3
} from 'three/tsl';
import type { Palette3D } from '../data/city3d';
import type { AusfuehrungId } from '../data/materialAusfuehrung';
import { oberflaechenWerte, type OberflaechenWerte } from '../logic/material/ausfuehrung';
import type { Rezept } from '../logic/material/rezept';
import {
	musterVersatzM,
	rauschStaerke,
	variationFaehig,
	variationVorgabe,
	type MaterialVariation
} from '../logic/material/variation';
import type { MusterRaum } from './materialMuster';
import { tokenColor } from './material';
import { metallUmgebung, type MetallLicht } from './materialMetallUmgebung';
import { oberflaechenMuster } from './materialOberflaecheMuster';

// Surface-gradient bump for analytic height. UV offsets do not resample local-position nodes.
function reliefNormal(hoehe: THREE.Node<'float'>, tiefeM: number) {
	const dx = positionView.dFdx();
	const dy = positionView.dFdy();
	const rechts = dy.cross(normalView);
	const oben = normalView.cross(dx);
	const det = dx.dot(rechts).mul(faceDirection);
	const gradient = rechts.mul(hoehe.dFdx()).add(oben.mul(hoehe.dFdy())).mul(det.sign().mul(tiefeM));
	return normalView.mul(det.abs().max(1e-10)).sub(gradient).normalize();
}

function musterRaum(seed: number): MusterRaum {
	if (seed === 0) return { lokal: positionLocal, welt: positionWorld };
	const versatz = vec3(...musterVersatzM(seed));
	return { lokal: positionLocal.add(versatz), welt: positionWorld.add(versatz) };
}

function projiziereMuster(
	m: THREE.MeshPhysicalNodeMaterial,
	w: OberflaechenWerte,
	base: THREE.Color,
	bewegt: boolean,
	variation: MaterialVariation
) {
	const v = variationFaehig(w.id) ? variation : variationVorgabe;
	const intensitaet = rauschStaerke[v.noise];
	const grund = color(base).rgb;
	const pattern = oberflaechenMuster(w, grund, bewegt, musterRaum(v.seed));
	m.colorNode =
		intensitaet === 1 ? pattern.farbe : mix(grund, pattern.farbe, 0.74 + 0.26 * intensitaet);
	if (pattern.licht) m.emissiveNode = pattern.licht;
	if (pattern.metallVersatz)
		m.metalnessNode = float(w.metall).add(pattern.metallVersatz).clamp(0, 1);
	m.roughnessNode = float(w.rauheit)
		.add((pattern.rauheitVersatz ?? pattern.hoehe.mul(0.025)).mul(intensitaet))
		.clamp(0.025, 1);
	if (pattern.relief > 0) m.normalNode = reliefNormal(pattern.hoehe, pattern.relief * intensitaet);
}

function baueMaterial(
	r: Rezept,
	palette: Palette3D,
	id: AusfuehrungId | undefined,
	doppelt: boolean,
	umgebung: THREE.Texture | null,
	variation: MaterialVariation
) {
	const w = oberflaechenWerte(r, id);
	const base = new THREE.Color(w.grundton);
	if (w.pigment > 0) base.lerp(tokenColor(palette, r.farbe.token), w.pigment);
	const m = new THREE.MeshPhysicalNodeMaterial({
		color: base,
		roughness: w.rauheit,
		metalness: w.metall,
		transmission: w.transmission,
		thickness: 0.12,
		ior: r.familie === 'wasser' ? 1.333 : 1.46,
		transparent: w.deckkraft < 1,
		opacity: w.deckkraft,
		depthWrite: w.deckkraft === 1,
		side: doppelt ? THREE.DoubleSide : THREE.FrontSide
	});
	projiziereMuster(m, w, base, r.haut.bewegt, variation);
	physischeDetails(m, w);
	spiegelung(m, w.id, umgebung);
	m.name = w.id;
	return m;
}

const reflexionVon: Partial<Record<AusfuehrungId, number>> = {
	'metall-messing': 0.82,
	'metall-kupfer': 0.64,
	'membran-goldfolie': 0.68
};

function spiegelung(
	m: THREE.MeshPhysicalNodeMaterial,
	id: AusfuehrungId,
	umgebung: THREE.Texture | null
) {
	const intensitaet = reflexionVon[id];
	if (!umgebung || intensitaet === undefined) return;
	m.envMap = umgebung;
	m.envMapIntensity = intensitaet;
}

const daempfungsDistanzM: Partial<Record<OberflaechenWerte['familie'], number>> = {
	wasser: 3,
	glas: 12
};

const klarlackVon: Partial<Record<AusfuehrungId, number>> = {
	'keramik-glasiert': 0.85,
	'kunststoff-formteil': 0.25,
	'keramik-schachbrett': 0.86,
	'glas-photovoltaik': 1,
	'kunststoff-marmoriert': 0.55
};

function physischeDetails(m: THREE.MeshPhysicalNodeMaterial, w: OberflaechenWerte) {
	if (w.id === 'metall-gebuerstet') {
		m.anisotropy = 0.72;
		m.anisotropyRotation = 0;
	}
	const klarlack = klarlackVon[w.id];
	if (klarlack !== undefined) {
		m.clearcoat = klarlack;
		m.clearcoatRoughness = Math.max(0.07, w.rauheit * 0.65);
	}
	if (w.id === 'kunststoff-guss') {
		m.clearcoat = 0.95;
		m.clearcoatRoughness = 0.075;
		m.clearcoatNormalNode = m.normalNode;
	}
	if (w.familie === 'membran') membranOptik(m, w);
	const distanzM = daempfungsDistanzM[w.familie];
	if (distanzM !== undefined) {
		m.attenuationColor = new THREE.Color(w.grundton);
		m.attenuationDistance = distanzM;
	}
}

function membranOptik(m: THREE.MeshPhysicalNodeMaterial, w: OberflaechenWerte) {
	if (w.id === 'membran-goldfolie') return;
	const flor = w.id === 'membran-flor';
	m.sheenRoughness = flor ? 0.86 : 0.7;
	m.sheen = flor ? 0.84 : 0.3;
	m.sheenColor = new THREE.Color(
		flor ? '#7dc9ea' : w.id === 'membran-beschichtet' ? '#5470d9' : '#e0c6ee'
	);
	if (w.id !== 'membran-opal') return;
	m.iridescence = 0.39;
	m.iridescenceIOR = 1.32;
	// Thin-film thickness is in nanometers (the optical model's native unit).
	m.iridescenceThicknessMinimum = 260;
	m.iridescenceThicknessMaximum = 410;
	m.clearcoat = 0.38;
	m.clearcoatRoughness = 0.28;
}

/**
 * Creates a stage-owned pool of physical TSL surfaces (WebGPU / WebGL2). `material` accepts
 * a detached legacy recipe, fixed studio palette, optional family finish, back-face flag and validated material variation.
 * Native finish is default; foreign finish falls back to native. Repeated calls reuse identity.
 * Spatial coordinates are metres; time is renderer-owned. No DOM, image assets or I/O.
 * `dispose` releases every retained material and can be called repeatedly; call it when
 * replacing the stage recipe set. Individually disposed materials leave the pool immediately.
 * Do not share pools across stages. The optional studio texture remains owned by the stage.
 */
export function createMaterialOberflaechen(umgebung: () => THREE.Texture | null = () => null): {
	material(
		r: Rezept,
		palette: Palette3D,
		id?: AusfuehrungId,
		doppelt?: boolean,
		variation?: MaterialVariation
	): THREE.Material;
	dispose(): void;
} {
	const materials = new Map<string, THREE.MeshPhysicalNodeMaterial>();
	const metallLicht = new Map<MetallLicht, THREE.DataTexture>();

	function spiegeltextur(r: Rezept, id: AusfuehrungId | undefined) {
		if (r.familie !== 'metall' || (id !== 'metall-messing' && id !== 'metall-kupfer'))
			return umgebung();
		const vorhanden = metallLicht.get(id);
		if (vorhanden) return vorhanden;
		const textur = metallUmgebung(id);
		metallLicht.set(id, textur);
		return textur;
	}
	return {
		material(r, palette, id, doppelt = false, variation = variationVorgabe) {
			const key = JSON.stringify([r, palette, id, doppelt, variation.noise, variation.seed]);
			const cached = materials.get(key);
			if (cached) return cached;
			const m = baueMaterial(r, palette, id, doppelt, spiegeltextur(r, id), variation);
			materials.set(key, m);
			m.addEventListener('dispose', () => materials.delete(key));
			return m;
		},
		dispose() {
			for (const m of materials.values()) m.dispose();
			materials.clear();
			for (const textur of metallLicht.values()) textur.dispose();
			metallLicht.clear();
		}
	};
}
