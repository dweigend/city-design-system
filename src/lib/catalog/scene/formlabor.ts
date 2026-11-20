import { studioGround } from './studio-ground';
import { studioPipeline } from './studio-pipeline';
import {
	createDrawingRenderer,
	createPaperScene,
	initializeDrawingRenderer,
	resizeDrawingRenderer
} from './drawing-renderer';
import { compileSurface } from './material-library';
import { bindSceneTheme } from './themeBinding';
/**
 * Form lab scene (L14): one primal form, six draw calls per tower, everything else in the shader.
 *
 * - Primal form: a cube mesh that the vertex shader pulls per instance into a box, cylinder, cone,
 *   dome, sphere or capsule (eight dimensions, logic/parametrik/formlabor/urform.ts).
 * - Position layer: rounding, profile, twist and bend of the whole tower are uniforms. Pure deformation,
 *   construction phase and explosion upload nothing.
 * - Type morph: the plan only rewrites instance rows. Geometry is built once.
 * - Drawing: tone steps instead of light, edges from the distance to the face seam, outline as an
 *   inverted hull. TSL, runs on WebGPU and WebGL2.
 */
import * as THREE from 'three/webgpu';
import {
	Fn,
	abs,
	attribute,
	cameraProjectionMatrix,
	clamp,
	cos,
	cross,
	dot,
	float,
	length,
	max,
	min,
	mix,
	modelViewMatrix,
	normalGeometry,
	normalize,
	positionGeometry,
	screenDPR,
	screenSize,
	select,
	sign,
	sin,
	smoothstep,
	step,
	tan,
	uniform,
	userData,
	varyingProperty,
	vec2,
	vec3,
	vec4
} from 'three/tsl';
import type { Node } from 'three/webgpu';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Palette3D } from '../data/city3d';
import { sceneSwatch } from './scene-palette';
import type { ColorToken } from '../logic/parametrik/types';
import { flowToken } from '../data/focus';
import {
	FELD,
	SCHRITT,
	bruecken,
	leere,
	turm,
	turmpuffer,
	verformen,
	type Angeschlossen,
	type Genom,
	type Palette,
	type Puffer,
	type Stand,
	type Turmpuffer
} from '../logic/parametrik/formlabor';

type V = Node<'vec3'>;
type F = Node<'float'>;

/** Cube mesh in unit coordinates: |s| ≤ 0.5 is the flat zone, beyond it the arc zone. */
function urnetz(flach: number, bogen: number): THREE.BufferGeometry {
	const werte = meshStations(flach, bogen);
	const n = werte.length,
		ort: number[] = [],
		normale: number[] = [],
		index: number[] = [];
	for (let achse = 0; achse < 3; achse++) for (const seite of [1, -1]) zeichneSeite(achse, seite);

	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(ort, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(normale, 3));
	g.setIndex(index);
	return g;

	function zeichneSeite(achse: number, seite: number) {
		const first = seite > 0 ? 1 : 2;
		const u = (achse + first) % 3,
			v = (achse + 3 - first) % 3,
			start = ort.length / 3;
		addVertices(achse, seite, u, v);
		for (let j = 0; j < n - 1; j++)
			for (let i = 0; i < n - 1; i++) {
				const a = start + j * n + i;
				index.push(a, a + 1, a + n + 1, a, a + n + 1, a + n);
			}
	}

	function addVertices(achse: number, seite: number, u: number, v: number) {
		for (let j = 0; j < n; j++)
			for (let i = 0; i < n; i++) {
				const p = [0, 0, 0];
				p[achse] = seite;
				p[u] = werte[i];
				p[v] = werte[j];
				ort.push(p[0], p[1], p[2]);
				const m = [0, 0, 0];
				m[achse] = seite;
				normale.push(m[0], m[1], m[2]);
			}
	}
}

function meshStations(flach: number, bogen: number) {
	const werte: number[] = [];
	for (let i = 0; i < bogen; i++) werte.push(-1 + (0.5 * i) / bogen);
	for (let i = 0; i <= flach; i++) werte.push(-0.5 + i / flach);
	for (let i = 1; i <= bogen; i++) werte.push(0.5 + (0.5 * i) / bogen);
	return werte;
}

const srgb = (css: string): [number, number, number] => {
	const c = new THREE.Color(css).convertLinearToSRGB();
	return [c.r, c.g, c.b];
};

function paletteAus(p: Palette3D): Palette {
	const strom = (token: ColorToken) => srgb(sceneSwatch(p, token));
	return {
		papier: srgb(p.paper),
		tinte: srgb(p.ink),
		signal: strom('--signal'),
		strom: [
			strom(flowToken.people),
			strom(flowToken.water),
			strom(flowToken.energy),
			strom(flowToken.food),
			strom(flowToken.material)
		]
	};
}

const QUARTER = Math.PI / 4;

/** Material nodes. `art`: face, rod (no hull, with edge tone), outline or skin. */
function material(
	art: 'flaeche' | 'stab' | 'umriss' | 'haut',
	farben: { ink: THREE.Color; paper: THREE.Color },
	palette: Palette3D
) {
	const s = positionGeometry,
		N = normalGeometry,
		iOrt = attribute('iOrt', 'vec3'),
		iDreh = attribute('iDreh', 'vec4'),
		iHalb = attribute('iHalb', 'vec4'),
		iForm = attribute('iForm', 'vec4'),
		iFarbe = attribute('iFarbe', 'vec4'),
		iFlaeche = attribute('iFlaeche', 'vec4'),
		iBau = attribute('iBau', 'vec4'),
		// Per-tower values on the object (userData), one material for all towers.
		lage1 = userData('lage1', 'vec4') as unknown as Node<'vec4'>,
		lage2 = userData('lage2', 'vec4') as unknown as Node<'vec4'>,
		schau = userData('schau', 'vec4') as unknown as Node<'vec4'>;
	const vN = varyingProperty('vec3', 'vN'),
		vF = varyingProperty('vec3', 'vF'),
		vMass = varyingProperty('vec4', 'vMass'),
		vUV = varyingProperty('vec4', 'vUV'),
		vBogen = varyingProperty('vec3', 'vBogen'),
		vFarbe = varyingProperty('vec4', 'vFarbe'),
		vMuster = varyingProperty('vec4', 'vMuster'),
		vRuhe = varyingProperty('vec3', 'vRuhe');

	const sinc = (x: F): F => select(abs(x).lessThan(1e-4), float(1), sin(x).div(x));
	/** Carrier position layer: the same calculation as logic/parametrik/formlabor/lage.ts. */
	const verforme = (p: V, rund: F): V => {
		const H = lage1.x,
			w = p.z.div(H),
			m = max(abs(p.x), abs(p.y)),
			r = mix(float(1), m.div(max(length(p.xy), 1e-5)), rund),
			wc = clamp(w, 0, 1),
			prof = max(
				0.12,
				float(1)
					.sub(lage1.z.mul(wc))
					.mul(float(1).add(lage1.w.mul(sin(wc.mul(Math.PI)))))
			),
			xy = p.xy.mul(r.mul(prof)),
			a = lage2.x.mul(clamp(w, -0.2, 1.4)),
			x1 = xy.x.mul(cos(a)).sub(xy.y.mul(sin(a))),
			y1 = xy.x.mul(sin(a)).add(xy.y.mul(cos(a))),
			t = lage2.y.div(H).mul(p.z),
			cr = cos(lage2.z),
			sr = sin(lage2.z),
			u = x1.mul(cr).add(y1.mul(sr)),
			v = y1.mul(cr).sub(x1.mul(sr)),
			u2 = u.mul(cos(t)).add(p.z.mul(sinc(t.mul(0.5))).mul(sin(t.mul(0.5)))),
			z2 = p.z.mul(sinc(t)).sub(u.mul(sin(t)));
		return vec3(u2.mul(cr).sub(v.mul(sr)), u2.mul(sr).add(v.mul(cr)), z2);
	};

	/** Vertex stage: primal form → instance → construction phase and explosion → position layer. Returns three coordinates. */
	const ecke = () => {
		// Carrier 0: stays put. 1: follows the position layer. 2: follows it but rounds itself
		// (bodies on the axis would otherwise turn into a cloverleaf when the space is rounded).
		const selbst = step(1.5, iFarbe.w).toVar(),
			traeger = min(iFarbe.w, 1),
			rundRaum = lage1.y.mul(float(1).sub(selbst)).toVar(),
			halb = iHalb.xyz,
			rxy = mix(iHalb.w, min(iHalb.x, iHalb.y), lage1.y.mul(selbst)).toVar(),
			rt = iForm.x,
			rb = iForm.y,
			f = clamp(s.mul(2), -1, 1).toVar(),
			a = sign(s)
				.mul(max(abs(s).mul(2).sub(1), 0))
				.toVar(),
			t = tan(a.mul(QUARTER)).toVar(),
			rz = mix(rb, rt, step(0, s.z)).toVar(),
			innen = halb.xy.sub(rxy).toVar(),
			rho = max(abs(a.x), abs(a.y)).toVar(),
			hdir = t.xy.div(max(length(t.xy), 1e-5)),
			d = normalize(t).toVar(),
			plan = f.xy
				.mul(innen)
				.add(hdir.mul(rxy.sub(rz).mul(rho)))
				.add(d.xy.mul(rz))
				.toVar(),
			lang = halb.z.sub(rt.add(rb).mul(0.5)).toVar(),
			z = rb.sub(rt).mul(0.5).add(f.z.mul(lang)).add(d.z.mul(rz)).toVar(),
			// Taper toward the top, per axis (cone, pyramid, gable roof).
			hoch = clamp(z.div(halb.z).mul(0.5).add(0.5), 0, 1),
			lokal = vec3(plan.mul(mix(vec2(1, 1), iForm.zw, hoch)), z).toVar(),
			kappe = abs(N.z).toVar(),
			kappa = mix(float(1), min(rz.div(max(rxy, 1e-4)), 1), kappe),
			nxy = d.xy.mul(kappa).toVar(),
			schraeg = dot(nxy.mul(plan), vec2(1, 1).sub(iForm.zw))
				.div(halb.z.mul(2))
				.mul(float(1).sub(kappe)),
			n = normalize(vec3(nxy, d.z.add(schraeg))).toVar();
		const dreh = (v: V): V =>
			v.add(cross(iDreh.xyz, cross(iDreh.xyz, v).add(v.mul(iDreh.w))).mul(2));
		// Construction phase: each part grows from the center during its phase and sinks in from above.
		const phase = iBau.x,
			lauf = clamp(
				schau.x
					.sub(max(phase.sub(1), 0))
					.sub(iBau.y.mul(0.6))
					.div(0.4),
				0,
				1
			),
			q = select(phase.lessThan(0.5), float(1), lauf).toVar(),
			da = q
				.mul(q)
				.mul(float(3).sub(q.mul(2)))
				.toVar(),
			// Explosion: modules detach radially (explR > 0), skins move aside as a whole
			// (explR < 0, after the position layer), the crown lifts off (explZ).
			radial = normalize(iOrt.xy.add(vec2(1e-5, 0))),
			hinaus = max(iBau.z, 0)
				.mul(schau.y)
				.add(float(1).sub(da).mul(2.5).mul(step(0.001, iBau.z))),
			ruhe = vec3(iOrt.xy.add(radial.mul(hinaus)), iOrt.z)
				.add((dreh(lokal) as V).mul(da))
				.toVar(),
			nr = dreh(n).toVar();
		// Normal through the position layer: deform two tangents along with it (no hand-written Jacobian).
		const hilf = select(abs(nr.z).lessThan(0.9), vec3(0, 0, 1), vec3(1, 0, 0)),
			t1 = normalize(cross(nr, hilf)).toVar(),
			t2 = cross(nr, t1),
			eps = 0.06,
			lege = (p: V): V => mix(p, verforme(p, rundRaum), traeger),
			p0 = lege(ruhe).toVar(),
			p1 = lege(ruhe.add(t1.mul(eps))),
			p2 = lege(ruhe.add(t2.mul(eps))),
			nd = normalize(cross(p1.sub(p0), p2.sub(p0))).toVar(),
			auf = schau.y.mul(iBau.w).add(float(1).sub(da).mul(9));
		// For the edge line: position on the face (linear per zone) and the instance dimensions.
		// The distance to the seam is computed only in the fragment, otherwise interpolation swallows it.
		const an = abs(N),
			seite = float(1).sub(kappe);
		vF.assign(
			vec3(
				f.y.mul(an.x).add(f.x.mul(an.y)).add(f.x.mul(an.z)),
				f.z.mul(seite).add(f.y.mul(an.z)),
				rb
			)
		);
		vMass.assign(
			vec4(
				innen.y.mul(an.x).add(innen.x.mul(an.y)).add(innen.x.mul(an.z)),
				mix(lang, innen.y, kappe),
				rxy,
				mix(rt, rz, kappe)
			)
		);
		// Pattern coordinates on the face in meters, plus half the face size.
		vUV.assign(
			vec4(
				vec2(lokal.y, lokal.z)
					.mul(an.x)
					.add(vec2(lokal.x, lokal.z).mul(an.y))
					.add(lokal.xy.mul(an.z)),
				vec2(halb.y, halb.z).mul(an.x).add(vec2(halb.x, halb.z).mul(an.y)).add(halb.xy.mul(an.z))
			)
		);
		vBogen.assign(
			vec3(vec2(a.y, a.z).mul(an.x).add(vec2(a.x, a.z).mul(an.y)).add(a.xy.mul(an.z)), kappe)
		);
		// Instance color arrives as sRGB and is linearized here.
		const c = iFarbe.xyz,
			linear = mix(c.div(12.92), c.add(0.055).div(1.055).pow(2.4), step(0.04045, c));
		vFarbe.assign(vec4(linear, iFlaeche.w));
		vMuster.assign(vec4(iFlaeche.xyz, da));
		vRuhe.assign(ruhe);
		const normale = vec3(nd.x, nd.z, nd.y.negate()).toVar();
		vN.assign(normale);
		const seitlich = max(iBau.z.negate(), 0).mul(schau.y).mul(Math.SQRT1_2);
		return {
			ort: vec3(p0.x.add(seitlich), p0.z.add(auf), p0.y.sub(seitlich).negate()),
			normale,
			da
		};
	};

	const tinte = uniform(farben.ink),
		papier = uniform(farben.paper);

	if (art === 'umriss') {
		const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide });
		m.vertexNode = Fn(() => {
			const e = ecke(),
				view = modelViewMatrix.mul(vec4(e.ort, 1)),
				nv = modelViewMatrix.mul(vec4(e.normale, 0)).xyz,
				clip = cameraProjectionMatrix.mul(view),
				richtung = normalize(cameraProjectionMatrix.mul(vec4(nv, 0)).xy.add(1e-6));
			return vec4(
				clip.xy.add(
					richtung
						.mul(1.15)
						// Parts not yet built have no size and therefore no outline.
						.mul(step(0.002, e.da))
						.mul(screenDPR)
						.mul(2)
						.div(screenSize)
						.mul(clip.w)
				),
				clip.zw
			);
		})();
		m.colorNode = tinte;
		return m;
	}

	/** Edge line: constant width in pixels, only at sharp seams. */
	const kanten = (px: number): F => {
		const eine = (d: F): F =>
				float(1).sub(smoothstep(px - 0.55, px + 0.55, d.div(max(d.fwidth(), 1e-6)))),
			scharf = (r: F): F => float(1).sub(smoothstep(0.03, 0.24, r)),
			kappe = vBogen.z,
			fu = vF.x,
			fv = vF.y,
			au = abs(vBogen.x),
			av = vBogen.y,
			in1 = vMass.x,
			in2 = vMass.y,
			rxy = vMass.z,
			r2 = vMass.w,
			rb = vF.z,
			// Side face: seam left/right, top and bottom.
			dU = in1.mul(float(1).sub(abs(fu))).add(float(1).sub(au).mul(rxy).mul(QUARTER)),
			// Distance to the seam: flat zone, own arc and the opposite arc already traversed.
			auf = max(av, 0),
			ab = max(av.negate(), 0),
			dT = in2
				.mul(float(1).sub(fv))
				.add(float(1).sub(auf).mul(r2).mul(QUARTER))
				.add(ab.mul(rb).mul(QUARTER)),
			dB = in2
				.mul(float(1).add(fv))
				.add(float(1).sub(ab).mul(rb).mul(QUARTER))
				.add(auf.mul(r2).mul(QUARTER)),
			wand = max(
				eine(dU).mul(scharf(rxy)),
				max(eine(dT).mul(scharf(r2)), eine(dB).mul(scharf(rb)))
			),
			// Top and bottom: distance to the edge.
			dRand = min(in1.mul(float(1).sub(abs(fu))), in2.mul(float(1).sub(abs(fv)))).add(
				float(1)
					.sub(max(au, abs(av)))
					.mul(rxy.sub(r2).add(r2.mul(QUARTER)))
			),
			deckel = eine(dRand).mul(scharf(r2));
		// Narrow faces (rods, slab edges) stay seamless: color instead of ink (134).
		return mix(wand, deckel, kappe).mul(smoothstep(0.1, 0.3, min(vUV.z, vUV.w)));
	};
	const m = compileSurface(
		{ kind: 'pattern', id: 'print-plain', token: '--paper', translucent: art === 'haut' },
		palette,
		{
			print: { vN, vUV, vBogen, vFarbe, vMuster, vRuhe, tinte, papier, kanten, rod: art === 'stab' }
		}
	);
	m.positionNode = Fn(() => ecke().ort)();
	return m;
}

type Klasse = keyof Turmpuffer;
type Einheit = {
	gruppe: THREE.Group;
	puffer: Turmpuffer;
	netze: Record<Klasse, THREE.InstancedBufferGeometry>;
	lager: Record<Klasse, THREE.InstancedInterleavedBuffer>;
	lage1: THREE.Vector4;
	lage2: THREE.Vector4;
	schluessel: string;
};

export type Bild = { staende: Stand[]; bau: number; explosion: number };

/** Genome fields that only change uniforms (no upload). */
const NUR_LAGE = new Set<keyof Genom>(['rund', 'verjuengung', 'bauch', 'drall', 'biegung']);

export function createFormlaborScene(
	canvas: HTMLCanvasElement,
	palette: Palette3D,
	onError: () => void
) {
	const renderer = createDrawingRenderer(canvas);
	const scene = createPaperScene(palette.paper);
	const camera = new THREE.OrthographicCamera(-30, 30, 30, -30, 0.1, 4000);
	const pipeline = studioPipeline(renderer, scene, camera);
	const ground = studioGround(pipeline.light);
	scene.add(ground.floor);
	let pal = paletteAus(palette);
	const farben = { ink: new THREE.Color(palette.ink), paper: new THREE.Color(palette.paper) };
	let letzterStand: Bild | undefined;
	const urformen = { gross: urnetz(6, 4), mittel: urnetz(1, 2), grob: urnetz(1, 1) };
	const stoffe = {
		flaeche: material('flaeche', farben, palette),
		stab: material('stab', farben, palette),
		umriss: material('umriss', farben, palette),
		haut: material('haut', farben, palette)
	};
	for (const face of [stoffe.flaeche, stoffe.stab]) {
		face.outputNode = pipeline.light.receiverOutput;
	}

	const schau = new THREE.Vector4(5, 0, 0, 0);
	let alive = true,
		initialized = false,
		width = 1,
		height = 1,
		moved = false,
		fitting = false,
		uploads = 0;
	const ready = initializeDrawingRenderer(
		renderer,
		canvas,
		() => alive,
		() => {
			initialized = true;
			render();
		},
		onError
	);
	let wartet = 0;
	const zeichne = () => {
		wartet = 0;
		if (!alive || !initialized) return;
		pipeline.render();
		canvas.dataset.frame = String(Number(canvas.dataset.frame ?? 0) + 1);
		canvas.dataset.uploads = String(uploads);
	};
	/** At most one render per animation frame. */
	const render = () => {
		if (!wartet) wartet = requestAnimationFrame(zeichne);
	};
	const controls = new OrbitControls(camera, canvas);
	controls.minZoom = 0.1;
	controls.maxZoom = 14;
	controls.listenToKeyEvents(canvas);
	controls.addEventListener('change', () => {
		if (!fitting) moved = true;
		render();
	});

	function netz(
		urform: THREE.BufferGeometry,
		p: Puffer
	): [THREE.InstancedBufferGeometry, THREE.InstancedInterleavedBuffer] {
		const g = new THREE.InstancedBufferGeometry();
		g.setIndex(urform.getIndex());
		g.setAttribute('position', urform.getAttribute('position'));
		g.setAttribute('normal', urform.getAttribute('normal'));
		const lager = new THREE.InstancedInterleavedBuffer(p.daten, SCHRITT, 1);
		lager.setUsage(THREE.DynamicDrawUsage);
		const feld = (name: string, groesse: number, ab: number) =>
			g.setAttribute(name, new THREE.InterleavedBufferAttribute(lager, groesse, ab));
		feld('iOrt', 3, FELD.ort);
		feld('iDreh', 4, FELD.drehung);
		feld('iHalb', 4, FELD.halb);
		feld('iForm', 4, FELD.rt);
		feld('iFarbe', 4, FELD.farbe);
		feld('iFlaeche', 4, FELD.muster);
		feld('iBau', 4, FELD.phase);
		g.instanceCount = 0;
		return [g, lager];
	}
	function einheit(mitHaut = true): Einheit {
		const p = turmpuffer(),
			gruppe = new THREE.Group(),
			lage1 = new THREE.Vector4(1, 0, 0, 0),
			lage2 = new THREE.Vector4(0, 0, 0, 0),
			daten = { lage1, lage2, schau },
			netze = {} as Einheit['netze'],
			lager = {} as Einheit['lager'];
		const haenge = (klasse: Klasse, stoff: THREE.Material, folge: number) => {
			const mesh = new THREE.Mesh(netze[klasse], stoff);
			mesh.castShadow = stoff === stoffe.flaeche || stoff === stoffe.stab;
			mesh.receiveShadow = mesh.castShadow;
			mesh.frustumCulled = false;
			mesh.renderOrder = folge;
			mesh.userData = daten;
			gruppe.add(mesh);
		};
		for (const klasse of ['gross', 'mittel', 'grob'] as const)
			[netze[klasse], lager[klasse]] = netz(urformen[klasse], p[klasse]);
		if (mitHaut) [netze.haut, lager.haut] = netz(urformen.gross, p.haut);
		haenge('gross', stoffe.flaeche, 0);
		haenge('gross', stoffe.umriss, 0);
		haenge('mittel', stoffe.flaeche, 0);
		haenge('mittel', stoffe.umriss, 0);
		haenge('grob', stoffe.stab, 0);
		if (mitHaut) haenge('haut', stoffe.haut, 2);
		scene.add(gruppe);
		return { gruppe, puffer: p, netze, lager, lage1, lage2, schluessel: '' };
	}
	function lade(e: Einheit, klassen: Klasse[], zaehlen = true) {
		for (const k of klassen) {
			const p = e.puffer[k];
			e.netze[k].instanceCount = p.anzahl;
			e.lager[k].clearUpdateRanges();
			e.lager[k].addUpdateRange(0, Math.max(1, p.anzahl) * SCHRITT);
			e.lager[k].needsUpdate = true;
			if (zaehlen) uploads++;
		}
	}
	const tuerme: Einheit[] = [];
	const punkt = new THREE.Vector3(),
		ECKEN = [
			[1, 1],
			[1, -1],
			[-1, 1],
			[-1, -1]
		];
	// Bridges: a separate unit without position layer (rows with traeger = 0), coarse parts only.
	const welt = einheit(false);
	const grenzen = new THREE.Box3();

	function fit(reset = false) {
		if (moved && !reset) {
			camera.left = (-camera.top * width) / height;
			camera.right = -camera.left;
			camera.updateProjectionMatrix();
			render();
			return;
		}
		if (grenzen.isEmpty()) return;
		const center = grenzen.getCenter(new THREE.Vector3()),
			eye = new THREE.Vector3(-Math.sqrt(3 / 8), 0.5, Math.sqrt(3 / 8));
		camera.position.copy(center).add(eye.multiplyScalar(900));
		camera.lookAt(center);
		controls.target.copy(center);
		fitting = true;
		controls.update();
		fitting = false;
		camera.updateMatrixWorld(true);
		const seiten = width / height;
		const span = cameraSpan(seiten) * 1.04;
		camera.left = -span * seiten;
		camera.right = span * seiten;
		camera.top = span;
		camera.bottom = -span;
		camera.zoom = 1;
		camera.updateProjectionMatrix();
		render();

		function cameraSpan(seiten: number) {
			let span = 1;
			const p = new THREE.Vector3();
			for (let i = 0; i < 8; i++) {
				p.set(...boxCorner(grenzen, i)).applyMatrix4(camera.matrixWorldInverse);
				span = Math.max(span, Math.abs(p.y), Math.abs(p.x) / seiten);
			}
			return span;
		}
	}

	/** New state. Writes only what changed: rows, uniforms or nothing. */
	function update(bild: Bild) {
		if (!alive) return;
		letzterStand = bild;
		schau.set(bild.bau, bild.explosion, 0, 0);
		while (tuerme.length < bild.staende.length) tuerme.push(einheit());
		const vorher = grenzen.clone();
		grenzen.makeEmpty();
		updateAssemblies(bild.staende);
		ground.frame(grenzen);
		if (!grenzen.isEmpty()) pipeline.light.frame(grenzen);
		pipeline.light.refresh();
		if (extentChanged(vorher)) fit();
		else render();
	}

	function extentChanged(vorher: THREE.Box3) {
		// Refit the camera only when the extent changes noticeably (no pumping while morphing).
		const a = vorher.getSize(new THREE.Vector3()),
			b = grenzen.getSize(new THREE.Vector3());
		return vorher.isEmpty() || Math.abs(a.x - b.x) > 14 || Math.abs(a.y - b.y) > 9;
	}

	function updateAssemblies(staende: Stand[]) {
		const angeschlossen = updateTowers(staende);
		leere(welt.puffer);
		if (angeschlossen.length > 1 && angeschlossen.length < 5)
			bruecken(angeschlossen, pal, welt.puffer.grob);
		lade(welt, ['grob'], false);
	}

	function updateTowers(staende: Stand[]) {
		const angeschlossen: Angeschlossen[] = [];
		tuerme.forEach((e, i) => {
			const stand = staende[i];
			const t = updateTower(e, stand);
			if (!t) return;
			angeschlossen.push({ stand, lage: t.lage, mikrokosmen: t.mikrokosmen });
			expandTowerBounds(stand, t);
		});
		return angeschlossen;
	}

	function updateTower(e: Einheit, stand: Stand | undefined) {
		e.gruppe.visible = !!stand;
		if (!stand) return;
		// World x/y/z → three x/z/−y.
		e.gruppe.position.set(stand.ort[0], stand.ort[2], -stand.ort[1]);
		const g = stand.genom,
			schluessel = JSON.stringify([
				stand.saat,
				(Object.keys(g) as (keyof Genom)[]).filter((k) => !NUR_LAGE.has(k)).map((k) => g[k])
			]);
		leere(e.puffer);
		const t = turm(g, stand.saat, pal, e.puffer, stand.richtung);
		if (schluessel !== e.schluessel) {
			e.schluessel = schluessel;
			lade(e, ['gross', 'mittel', 'grob', 'haut']);
		}
		e.lage1.set(t.lage.hoehe, t.lage.rund, t.lage.verjuengung, t.lage.bauch);
		e.lage2.set(t.lage.drall, t.lage.biegung, t.lage.richtung, 0);
		return t;
	}

	function expandTowerBounds(stand: Stand, t: ReturnType<typeof turm>) {
		// Camera framing: base plate on the ground, the deformed tower above it (sample points).
		const fasse = (x: number, y: number, z: number) =>
			grenzen.expandByPoint(punkt.set(stand.ort[0] + x, z, -(stand.ort[1] + y)));
		for (const [x, y] of ECKEN) {
			fasse(x * t.radius, y * t.radius, -0.5);
			for (let i = 1; i <= 4; i++) {
				const z = (t.hoehe * i) / 4,
					p = verformen([x * stand.genom.breite * 1.5, y * stand.genom.breite * 1.5, z], t.lage);
				fasse(p[0], p[1], p[2]);
			}
		}
	}

	const stopTheme = bindSceneTheme(canvas, scene, renderer, (next) => {
		pal = paletteAus(next);
		farben.ink.set(next.ink);
		farben.paper.set(next.paper);
		for (const e of tuerme) e.schluessel = '';
		if (letzterStand) update(letzterStand);
		else render();
	});
	function disposeGeometry() {
		for (const e of [...tuerme, welt]) Object.values(e.netze).forEach((g) => g.dispose());
		for (const u of Object.values(urformen)) u.dispose();
		for (const s of Object.values(stoffe)) s.dispose();
	}

	return {
		ready,
		update,
		/** Construction phase and explosion: uniforms only. */
		schau(bau: number, explosion: number) {
			schau.set(bau, explosion, 0, 0);
			pipeline.light.refresh();
			render();
		},
		reset() {
			moved = false;
			fit(true);
		},
		resize(w: number, h: number) {
			[width, height] = resizeDrawingRenderer(renderer, w, h);
			fit();
		},
		dispose() {
			if (!alive) return;
			alive = false;
			stopTheme();
			if (wartet) cancelAnimationFrame(wartet);
			controls.dispose();
			ground.dispose();
			pipeline.dispose();
			disposeGeometry();
			if (initialized) renderer.dispose();
		}
	};
}

function boxCorner(box: THREE.Box3, index: number): [number, number, number] {
	return [
		index & 1 ? box.max.x : box.min.x,
		index & 2 ? box.max.y : box.min.y,
		index & 4 ? box.max.z : box.min.z
	];
}
