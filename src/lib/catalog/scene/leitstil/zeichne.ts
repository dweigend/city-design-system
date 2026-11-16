import {
	Scene,
	Group,
	WebGLRenderer,
	Mesh,
	MeshBasicMaterial,
	BoxGeometry,
	SphereGeometry,
	CapsuleGeometry,
	BufferGeometry,
	Float32BufferAttribute,
	DoubleSide,
	Vector2,
	Color,
	SRGBColorSpace,
	NoToneMapping,
	ShapeUtils
} from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { bindSceneTheme } from '../themeBinding';
import {
	bestandSegmente,
	figurSegmente,
	inselGeometrie,
	raumStufe,
	bodenStufe,
	type LeitstilSzene,
	type Stil,
	type Vec3,
	type Segment,
	type Koerper
} from '../../logic/leitstil';
import { TOENE, WEG_STROM } from '../../data/leitstil';
import { grammatik, neutral } from './grammatik';
import { kameraFuer, welt } from './kamera';
import { schattenPolygon } from './schatten';
import { stabStriche } from './tragwerk';

/** Owns renderer, observer, theme binding and every geometry/material. No animation loop. */
export function zeichneSzene(daten: LeitstilSzene, stil: Stil, host: HTMLElement) {
	const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
	renderer.outputColorSpace = SRGBColorSpace;
	renderer.toneMapping = NoToneMapping;
	renderer.domElement.setAttribute(
		'aria-label',
		'Existing stock, white house, structural system, and paths'
	);
	renderer.domElement.setAttribute('role', 'img');
	host.append(renderer.domElement);
	const scene = new Scene(),
		gruppe = new Group();
	scene.add(gruppe);
	let kamera = kameraFuer(stil, 1000, 600),
		disposed = false;
	const geometrien: BufferGeometry[] = [],
		materialien: (MeshBasicMaterial | LineMaterial)[] = [];
	const clear = () => {
		gruppe.clear();
		geometrien.splice(0).forEach((g) => g.dispose());
		materialien.splice(0).forEach((m) => m.dispose());
	};
	const zeichnen = () => {
		if (disposed) return;
		clear();
		const w = Math.max(1, host.clientWidth),
			h = Math.max(1, host.clientHeight),
			skala = w / 1000;
		renderer.setSize(w, h);
		kamera = kameraFuer(stil, w, h, daten.blickziel);
		const g = grammatik(host, stil);
		scene.background = g.paper;
		const linien = (
			seg: readonly { a: Vec3; b: Vec3 }[],
			farbe: Color,
			px: number,
			dash = false,
			opacity = 1
		) => {
			if (!seg.length) return;
			const geo = new LineSegmentsGeometry();
			geo.setPositions(seg.flatMap((s) => [...welt(s.a).toArray(), ...welt(s.b).toArray()]));
			const mat = new LineMaterial({
				color: farbe,
				linewidth: px * skala,
				resolution: new Vector2(w, h),
				dashed: dash,
				dashSize: 0.3,
				gapSize: 0.18,
				transparent: opacity < 1,
				opacity,
				depthTest: true,
				// Overlaid stroke layers test against surfaces but write no identical depth.
				depthWrite: false
			});
			const l = new LineSegments2(geo, mat);
			l.computeLineDistances();
			gruppe.add(l);
			geometrien.push(geo);
			materialien.push(mat);
		};
		const polygon = (punkte: Vec3[], farbe: Color) => {
			const geo = new BufferGeometry();
			geo.setAttribute(
				'position',
				new Float32BufferAttribute(
					[0, 1, 2, 0, 2, 3].flatMap((i) => welt(punkte[i]).toArray()),
					3
				)
			);
			const mat = new MeshBasicMaterial({
				color: farbe,
				side: DoubleSide,
				polygonOffset: true,
				polygonOffsetFactor: -1,
				polygonOffsetUnits: -1
			});
			gruppe.add(new Mesh(geo, mat));
			geometrien.push(geo);
			materialien.push(mat);
		};
		const box = (min: Vec3, max: Vec3, farbe: Color, kante?: Color, px = 1.2, modell = false) => {
			const geo = new BoxGeometry(max[0] - min[0], max[2] - min[2], max[1] - min[1]);
			const farben: number[] = [];
			const normal = geo.getAttribute('normal');
			for (let i = 0; i < normal.count; i++) {
				const n = normal.getY(i),
					x = normal.getX(i);
				const offset = n > 0.5 ? 0 : n < -0.5 ? TOENE.unten : x > 0.5 ? TOENE.rechts : TOENE.vorn;
				const c = modell ? neutral(g.modellL + offset) : farbe;
				farben.push(c.r, c.g, c.b);
			}
			geo.setAttribute('color', new Float32BufferAttribute(farben, 3));
			const mat = new MeshBasicMaterial({ vertexColors: true });
			const m = new Mesh(geo, mat);
			m.position.copy(welt([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]));
			gruppe.add(m);
			geometrien.push(geo);
			materialien.push(mat);
			if (kante) {
				const [x, y, z] = min,
					[X, Y, Z] = max;
				const s: Segment[] = [];
				for (const h of [z, Z])
					s.push(
						{ a: [x, y, h], b: [X, y, h] },
						{ a: [X, y, h], b: [X, Y, h] },
						{ a: [X, Y, h], b: [x, Y, h] },
						{ a: [x, Y, h], b: [x, y, h] }
					);
				for (const a of [x, X]) for (const b of [y, Y]) s.push({ a: [a, b, z], b: [a, b, Z] });
				linien(s, kante, px);
			}
		};
		box(daten.insel.min, daten.insel.max, g.paper, g.raster, 0.5);
		const insel = inselGeometrie(daten.insel, stil.kamera.pxProM <= 9.2 ? 4 : 2);
		linien(insel.schraffur, g.raster, 0.5);
		linien(
			insel.punkte.map(([x, y, z]) => ({ a: [x - 0.025, y, z], b: [x + 0.025, y, z] })),
			g.raster,
			0.7,
			false,
			0.6
		);
		for (const k of daten.koerper.filter((k) => k.rolle === 'huelle'))
			polygon(schattenPolygon(k), g.schatten);
		for (const b of daten.bestand) {
			box(b.min, b.max, g.paper);
			linien(
				bestandSegmente(b).filter(
					(s) => s.art === 'kante' || s.art === 'gesims' || stil.rollen.bestand.level === 'detail'
				),
				g.blei,
				stil.rollen.bestand.strichPx
			);
		}
		const prisma = (k: Koerper, farbe: Color) => {
			const ring = k.polygon;
			if (!ring) return;
			const geo = new BufferGeometry(),
				position: number[] = [],
				farben: number[] = [];
			const dreieck = (p: Vec3[], c: Color) => {
				for (const v of p) {
					position.push(...welt(v).toArray());
					farben.push(c.r, c.g, c.b);
				}
			};
			const modell = k.rolle === 'huelle';
			for (const [z, offset] of [
				[k.min[2], TOENE.unten],
				[k.max[2], 0]
			]) {
				for (const t of ShapeUtils.triangulateShape(
					ring.map((p) => new Vector2(...p)),
					[]
				))
					dreieck(
						t.map((i) => [...ring[i], z] as Vec3),
						modell ? neutral(g.modellL + offset) : farbe
					);
			}
			const kanten: Segment[] = [];
			for (let i = 0; i < ring.length; i++) {
				const p = ring[i],
					q = ring[(i + 1) % ring.length];
				const a: Vec3 = [...p, k.min[2]],
					b: Vec3 = [...q, k.min[2]],
					c: Vec3 = [...q, k.max[2]],
					d: Vec3 = [...p, k.max[2]];
				const ton = modell
					? neutral(g.modellL + (q[1] - p[1] > 0 ? TOENE.rechts : TOENE.vorn))
					: farbe;
				dreieck([a, b, c], ton);
				dreieck([a, c, d], ton);
				kanten.push({ a, b }, { a: d, b: c });
			}
			geo.setAttribute('position', new Float32BufferAttribute(position, 3));
			geo.setAttribute('color', new Float32BufferAttribute(farben, 3));
			const mat = new MeshBasicMaterial({
				vertexColors: true,
				side: DoubleSide,
				polygonOffset: true,
				polygonOffsetFactor: 1,
				polygonOffsetUnits: 1
			});
			gruppe.add(new Mesh(geo, mat));
			geometrien.push(geo);
			materialien.push(mat);
			if (modell) linien(kanten, g.kontur, 1.2);
		};

		const koerper = (k: Koerper) => {
			if (!stil.rollen[k.rolle].sichtbar) return;
			if (k.rolle === 'raum' && !k.strom) return;
			const hintergrund =
				k.rolle === 'raum' && stil.fokus.length > 0 && k.strom && !stil.fokus.includes(k.strom);
			if (stil.rollen[k.rolle].level === 'hull' && (k.rolle !== 'raum' || hintergrund)) {
				linien(
					bestandSegmente(k).filter((s) => s.art === 'kante'),
					g.kontur,
					0.6
				);
				return;
			}
			const c =
				k.rolle === 'raum' && k.strom
					? g.strom(
							k.strom,
							k.teil === 'boden'
								? bodenStufe(stil, k.strom)
								: raumStufe(stil, k.strom, k.teil === 'kern' || k.teil === 'tuer')
						)
					: g.weiss;
			if (k.polygon) prisma(k, c);
			else
				box(
					k.min,
					k.max,
					c,
					k.rolle === 'huelle' ? g.kontur : undefined,
					1.2,
					k.rolle === 'huelle'
				);
		};
		daten.koerper.forEach(koerper);
		if (stil.rollen.weg.sichtbar)
			for (const weg of daten.wege)
				for (let i = 1; i < weg.punkte.length; i++) {
					const a = weg.punkte[i - 1],
						b = weg.punkte[i],
						dx = b[0] - a[0],
						dy = b[1] - a[1],
						len = Math.hypot(dx, dy),
						ox = ((-dy / len) * weg.breite) / 2,
						oy = ((dx / len) * weg.breite) / 2;
					polygon(
						[
							[a[0] + ox, a[1] + oy, a[2]],
							[b[0] + ox, b[1] + oy, b[2]],
							[b[0] - ox, b[1] - oy, b[2]],
							[a[0] - ox, a[1] - oy, a[2]]
						],
						stil.traegerRolle === 'analyse'
							? g.weiss
							: g.strom(stil.rollen.weg.strom ?? WEG_STROM, stil.rollen.weg.stufe)
					);
					const deck: Vec3[] = [
						[a[0] + ox, a[1] + oy, a[2]],
						[b[0] + ox, b[1] + oy, b[2]],
						[b[0] - ox, b[1] - oy, b[2]],
						[a[0] - ox, a[1] - oy, a[2]]
					];
					for (let j = 0; j < 4; j++) {
						const p = deck[j],
							q = deck[(j + 1) % 4];
						const u: Vec3 = [p[0], p[1], p[2] - 0.18],
							v: Vec3 = [q[0], q[1], q[2] - 0.18];
						polygon([p, q, v, u], g.weiss);
						linien(
							[
								{ a: p, b: q },
								{ a: u, b: v },
								{ a: p, b: u }
							],
							g.kontur,
							0.8
						);
					}
					for (const sign of [-1, 1]) {
						const p: Vec3 = [a[0] + ox * sign, a[1] + oy * sign, a[2] + 0.8],
							q: Vec3 = [b[0] + ox * sign, b[1] + oy * sign, b[2] + 0.8];
						linien([{ a: p, b: q }], g.detail, 0.6);
						for (let t = 0; t <= 1; t += 0.2) {
							const base: Vec3 = [
								a[0] + dx * t + ox * sign,
								a[1] + dy * t + oy * sign,
								a[2] + (b[2] - a[2]) * t
							];
							linien([{ a: base, b: [base[0], base[1], base[2] + 0.8] }], g.detail, 0.6);
						}
					}
					if (a[2] !== b[2])
						for (let t = 0; t < 1; t += 0.055) {
							const p: Vec3 = [
								a[0] + dx * t + ox,
								a[1] + dy * t + oy,
								a[2] + (b[2] - a[2]) * t + 0.01
							];
							linien([{ a: p, b: [p[0] - ox * 2, p[1] - oy * 2, p[2]] }], g.detail, 0.5);
						}
				}
		for (const lager of daten.lager ?? [])
			box(lager.min, lager.max, g.ink, stil.thema === 'dunkel' ? g.paper : undefined, 0.6);
		for (const stab of daten.staebe) {
			for (const lage of stabStriche(stab, stil, skala))
				linien(
					[stab],
					lage.ton === 'analyse' ? g.analyse(stab.art) : g[lage.ton],
					lage.breite,
					false,
					lage.veraltet ? g.trace : 1
				);
		}
		if (stil.kamera.pxProM * 1.8 >= 12)
			daten.figuren.slice(0, stil.dichte.figurenMax).forEach((p) => {
				linien(figurSegmente(p).slice(0, 5), g.ink, 2.2);
				const geo = new SphereGeometry(0.15, 12, 8),
					mat = new MeshBasicMaterial({ color: g.ink });
				const torsoGeo = new CapsuleGeometry(0.115, 0.55, 4, 8);
				const torso = new Mesh(torsoGeo, mat);
				torso.position.copy(welt([p[0], p[1], p[2] + 1.06]));
				gruppe.add(torso);
				geometrien.push(torsoGeo);
				const kopf = new Mesh(geo, mat);
				kopf.position.copy(welt([p[0], p[1], p[2] + 1.65]));
				gruppe.add(kopf);
				geometrien.push(geo);
				materialien.push(mat);
			});
		if (stil.rollen.geplant.sichtbar)
			for (const k of daten.geplant ?? [])
				linien(
					bestandSegmente(k).filter((s) => s.art === 'kante'),
					g.token('--blueprint'),
					0.8,
					true
				);
		if (stil.signalZiele.includes('baustelle'))
			for (const p of daten.baustelle ?? [])
				linien(
					p.slice(1).map((b, i) => ({ a: p[i], b })),
					g.token('--signal'),
					1.3
				);
		if (stil.rollen.auswahl.sichtbar) {
			linien(daten.auswahl ?? [], g.token('--signal'), 1.4);
			if (daten.anker) {
				const [x, y, z] = daten.anker;
				const ring = Array.from({ length: 24 }, (_, i) => {
					const a = (i * Math.PI) / 12,
						b = ((i + 1) * Math.PI) / 12;
					return {
						a: [x + 0.13 * Math.cos(a), y, z + 0.13 * Math.sin(a)] as Vec3,
						b: [x + 0.13 * Math.cos(b), y, z + 0.13 * Math.sin(b)] as Vec3
					};
				});
				linien(ring, g.token('--signal'), 1.4);
			}
		}
		if (stil.rollen.gefahr.sichtbar) linien(daten.gefahr ?? [], g.token('--cat-hazard'), 1.2, true);

		renderer.render(scene, kamera);
		renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
	};
	const canvas = renderer.domElement;
	const observer = new ResizeObserver(zeichnen);
	observer.observe(host);
	const stopTheme = bindSceneTheme(canvas, scene, renderer, () => zeichnen());
	zeichnen();
	return {
		gruppe,
		get kamera() {
			return kamera;
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			observer.disconnect();
			stopTheme();
			clear();
			renderer.dispose();
			renderer.forceContextLoss();
			renderer.domElement.remove();
		}
	};
}
