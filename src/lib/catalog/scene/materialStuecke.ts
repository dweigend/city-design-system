import * as THREE from 'three/webgpu';
import { float, uniform, uv } from 'three/tsl';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { Palette3D } from '../data/city3d';
import type { Stueck } from '../logic/material/formen';
import type { Rezept } from '../logic/material/rezept';
import { kantenfarbe, rezeptMaterial } from './materialRezept';
import { createMaterialOberflaechen } from './materialOberflaeche';
import { studienGeometrie } from './materialStudienGeometrie';
import { stueckGeometrie, stueckOrt, stueckRadius } from './materialStueckGeometrie';

import { kanalOberflaeche } from './materialWasser';

type Eintrag = {
	wasser?: ReturnType<typeof kanalOberflaeche>;
	key: string;
	gruppe: THREE.Group;
	mesh: THREE.Mesh;
	kanteKey?: string;
	kante?: LineSegments2;
};

function schattenfleck(palette: Palette3D) {
	const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
	material.color = new THREE.Color(0x000000);
	const dunkel = new THREE.Color(palette.paper).getHSL({ h: 0, s: 0, l: 0 }).l < 0.5;
	const d = uv().sub(0.5).length().mul(2);
	material.opacityNode = float(1)
		.sub(d.smoothstep(0.35, 1))
		.mul(dunkel ? 0.4 : 0.09);
	return material;
}

function kantenlinie(e: Eintrag, s: Stueck, palette: Palette3D, studio: boolean) {
	const stil = studio
		? { winkel: 38, papier: 0.59, breite: 0.72 }
		: { winkel: 25, papier: 0, breite: 1.15 };
	const kanten = new THREE.EdgesGeometry(e.mesh.geometry, stil.winkel);
	const positionen = Array.from(kanten.getAttribute('position').array as Float32Array);
	kanten.dispose();
	const color = kantenfarbe(s.rezept, palette);
	color.lerp(new THREE.Color(palette.paper), stil.papier);
	const material = new THREE.Line2NodeMaterial({
		color,
		linewidth: stil.breite * (s.rezept.kante?.breite ?? 1)
	});
	const linie = new LineSegments2(new LineSegmentsGeometry().setPositions(positionen), material);
	linie.renderOrder = 4;
	linie.frustumCulled = false;
	return linie;
}

function entferneKante(e: Eintrag) {
	if (!e.kante) return;
	e.kante.geometry.dispose();
	e.kante.material.dispose();
	e.kante.removeFromParent();
	e.kante = undefined;
}

function umrissKante(s: Stueck): Rezept['kante'] {
	// The pile already has a physical outline. Inking its tufts exposes the relief triangles.
	if (s.teil.art === 'kugel' || s.teil.profil?.art === 'flor') return null;
	return s.rezept.kante;
}

function aktualisiereKante(e: Eintrag, s: Stueck, palette: Palette3D, studio: boolean) {
	const kante = umrissKante(s);
	const key = JSON.stringify(kante);
	if (key === e.kanteKey) return;
	entferneKante(e);
	e.kanteKey = key;
	if (!kante) return;
	e.kante = kantenlinie(e, s, palette, studio);
	e.gruppe.add(e.kante);
}

function setzeKontakt(gruppe: THREE.Group, s: Stueck, fleck?: THREE.Material) {
	if (s.teil.lage[2] !== 0 || !fleck) return;
	const r = stueckRadius(s.teil) * 1.7;
	const kontakt = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), fleck);
	kontakt.rotation.x = -Math.PI / 2;
	kontakt.position.y = 0.002;
	gruppe.add(kontakt);
}

function baue(s: Stueck, key: string, material: THREE.Material, fleck?: THREE.Material): Eintrag {
	const gruppe = new THREE.Group();
	gruppe.position.copy(stueckOrt(s.teil));
	const wasser = kanalOberflaeche(s);
	const geo = wasser?.geometry ?? studienGeometrie(s.teil) ?? stueckGeometrie(s.teil);
	const mesh = new THREE.Mesh(geo, material);
	gruppe.add(mesh);
	setzeKontakt(gruppe, s, fleck);
	return { key, gruppe, mesh, wasser };
}

function entsorge(e: Eintrag | undefined) {
	if (!e) return;
	entferneKante(e);
	e.gruppe.traverse((obj) => {
		if (obj instanceof THREE.Mesh) obj.geometry.dispose();
	});
	e.gruppe.removeFromParent();
}

function optischDurchlaessig(m: THREE.Material): boolean {
	return m instanceof THREE.MeshPhysicalNodeMaterial && m.transmission > 0;
}

function zeitRezept(r: Rezept, bewegung: boolean): Rezept {
	if (bewegung || !r.haut.bewegt) return r;
	return { ...r, haut: { ...r.haut, bewegt: false } };
}

function studioSchatten(mesh: THREE.Mesh, material: THREE.Material, familie: Rezept['familie']) {
	const transmission = optischDurchlaessig(material);
	mesh.castShadow = !material.transparent && (!transmission || familie === 'membran');
	mesh.receiveShadow = !transmission;
}

function diagrammReihenfolge(mesh: THREE.Mesh, material: THREE.Material) {
	mesh.renderOrder = material.transparent ? 3 : 1;
}

function limitiere<K, V>(map: Map<K, V>, aktuell: Set<K>, dispose: (value: V) => void) {
	for (const [key, value] of map) {
		if (aktuell.has(key)) continue;
		dispose(value);
		map.delete(key);
	}
}

/** Draw detached material pieces into the supplied group, retaining only in-use GPU resources. */
export function createMaterialStuecke(
	welt: THREE.Group,
	studio: boolean,
	umgebung?: () => THREE.Texture | null
) {
	const diagrammZeit = uniform(0);
	const eintraege = new Map<string, Eintrag>();
	const materialien = new Map<string, THREE.Material>();
	const oberflaechen = studio ? createMaterialOberflaechen(umgebung) : undefined;
	const projektion = studio ? studioSchatten : diagrammReihenfolge;
	let fleck: THREE.Material | undefined;

	function materialFuer(s: Stueck, key: string, palette: Palette3D, bewegung: boolean) {
		const alt = materialien.get(key);
		if (alt) return alt;
		const r = oberflaechen ? zeitRezept(s.rezept, bewegung) : s.rezept;
		const doppelt = s.teil.art === 'kuppel';
		const material = oberflaechen
			? oberflaechen.material(r, palette, s.ausfuehrung, doppelt, s.variation)
			: rezeptMaterial(r, palette, doppelt, diagrammZeit);
		materialien.set(key, material);
		return material;
	}

	const kontaktMaterial = studio ? () => undefined : schattenfleck;

	function eintragFuer(s: Stueck, material: THREE.Material, palette: Palette3D) {
		const geoKey = JSON.stringify(s.teil);
		const e = eintraege.get(s.id);
		if (e?.key === geoKey) return e;
		entsorge(e);
		fleck ??= kontaktMaterial(palette);
		const neu = baue(s, geoKey, material, fleck);
		eintraege.set(s.id, neu);
		welt.add(neu.gruppe);
		return neu;
	}

	function leeren() {
		limitiere(eintraege, new Set(), entsorge);
		limitiere(materialien, new Set(), (material) => material.dispose());
		fleck?.dispose();
		fleck = undefined;
	}

	return {
		/** Sample animated diagram nodes at the explainer's exact time in seconds. */
		setzeDiagrammZeit(zeitS: number) {
			diagrammZeit.value = zeitS;
		},
		/** Advance only the live canal surfaces by elapsed active seconds. */
		advance(deltaS: number) {
			diagrammZeit.value += deltaS;
			for (const e of eintraege.values()) e.wasser?.advance(deltaS);
		},
		/** Restore the initial water state in the active pieces. */
		wasserStart() {
			for (const e of eintraege.values()) e.wasser?.reset();
		},
		/** Update pieces and dispose the resources no longer referenced by them. */
		zeige(stuecke: readonly Stueck[], palette: Palette3D, bewegung: boolean) {
			const aktiv = new Set<string>();
			for (const s of stuecke) {
				const key = JSON.stringify([
					s.rezept,
					s.ausfuehrung,
					s.variation,
					s.teil.art === 'kuppel',
					bewegung
				]);
				const material = materialFuer(s, key, palette, bewegung);
				const e = eintragFuer(s, material, palette);
				e.mesh.material = material;
				projektion(e.mesh, material, s.rezept.familie);
				if (!e.wasser) aktualisiereKante(e, s, palette, studio);
				const k = s.skala ?? 1;
				e.gruppe.scale.setScalar(Math.max(0.0001, k * k * (3 - 2 * k)));
				e.gruppe.visible = k > 0;
				aktiv.add(key);
			}
			limitiere(eintraege, new Set(stuecke.map((s) => s.id)), entsorge);
			limitiere(materialien, aktiv, (material) => material.dispose());
		},
		/** Drop palette-dependent resources. The detached pieces are supplied again on redraw. */
		leeren,
		/** Release textures owned by this stage after its pieces have been removed. */
		dispose() {
			leeren();
			oberflaechen?.dispose();
		}
	};
}
