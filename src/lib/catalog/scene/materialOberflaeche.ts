import { perforatedSheet } from './toy-surfaces';
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
	variation: MaterialVariation,
	explicitPigment: boolean
) {
	const v = variationFaehig(w.id) ? variation : variationVorgabe;
	const intensitaet = rauschStaerke[v.noise];
	const grund = color(base).rgb;
	const native = new THREE.Color(w.grundton);
	const pattern = oberflaechenMuster(
		w,
		explicitPigment ? color(native).rgb : grund,
		bewegt,
		musterRaum(v.seed)
	);
	// Preserve light/dark variation of authored inclusions while the selected pigment supplies the hue.
	const weights = vec3(0.2126, 0.7152, 0.0722);
	const level = Math.max(0.001, 0.2126 * native.r + 0.7152 * native.g + 0.0722 * native.b);
	const paint = explicitPigment
		? grund.mul(pattern.farbe.dot(weights).div(level).clamp(0.12, 3))
		: pattern.farbe;
	m.colorNode = intensitaet === 1 ? paint : mix(grund, paint, 0.74 + 0.26 * intensitaet);
	if (pattern.licht)
		m.emissiveNode = explicitPigment ? grund.mul(pattern.licht.dot(weights)) : pattern.licht;
	projectPhysicalChannels();

	function projectPhysicalChannels() {
		if (pattern.metallVersatz)
			m.metalnessNode = float(w.metall).add(pattern.metallVersatz).clamp(0, 1);
		m.roughnessNode = float(w.rauheit)
			.add((pattern.rauheitVersatz ?? pattern.hoehe.mul(0.025)).mul(intensitaet))
			.clamp(0.025, 1);
		if (pattern.relief > 0)
			m.normalNode = reliefNormal(pattern.hoehe, pattern.relief * intensitaet);
	}
}

/** Creates the physical surface nodes for one resolved recipe. */
export function physicalSurface(
	r: Rezept,
	palette: Palette3D,
	id: AusfuehrungId | undefined,
	doppelt: boolean,
	umgebung: THREE.Texture | null,
	variation: MaterialVariation
) {
	const w = oberflaechenWerte(r, id);
	const base = new THREE.Color(w.grundton);
	if (w.pigment === 1) base.copy(tokenColor(palette, r.farbe.token));
	else if (w.pigment > 0) base.lerp(tokenColor(palette, r.farbe.token), w.pigment);
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
	projiziereMuster(m, w, base, r.haut.bewegt, variation, r.farbe.anteil === 1);
	if (w.id === 'perforated-metal') m.maskNode = perforatedSheet();
	if (w.id === 'acryl-matt' || w.id === 'clear-acrylic') {
		m.ior = 1.49;
		m.thickness = 0.32;
		m.attenuationColor.copy(base);
		m.attenuationDistance = 0.85;
	}
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
		m.attenuationColor = m.color.clone();
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
