import * as THREE from 'three/webgpu';
import {
	Fn,
	abs,
	cameraViewMatrix,
	clamp,
	cos,
	dot,
	float,
	floor,
	fract,
	frontFacing,
	max,
	min,
	mix,
	normalize,
	select,
	sin,
	smoothstep,
	step,
	vec2,
	vec3,
	vec4
} from 'three/tsl';
import type { Node } from 'three/webgpu';
type F = Node<'float'>;
type V = Node<'vec3'>;

/** Surface samples may come from ordinary geometry or deformed instance varyings. */
export type PrintInputs = {
	vN: V;
	vUV: Node<'vec4'>;
	vBogen: V;
	vFarbe: Node<'vec4'>;
	vMuster: Node<'vec4'>;
	vRuhe: V;
	tinte: Node<'color'>;
	papier: Node<'color'>;
	kanten: (width: number) => F;
	rod?: boolean;
};

/** Builds the screen, seam and gloss nodes from metre coordinates and linear pigment. */
export function architecturalPrint(
	{ vN, vUV, vBogen, vFarbe, vMuster, vRuhe, tinte, papier, kanten, rod }: PrintInputs,
	translucent = false
) {
	const licht = vec3(1);
	/** Antialiased square wave 0/1 and thin line, both fading to their mean at small scale. */
	const welle = (v: F): F => {
		const w = v.fwidth().mul(1.5).min(0.5);
		return smoothstep(float(0.5).sub(w), float(0.5).add(w), abs(fract(v).sub(0.5)).mul(2));
	};
	const linie = (v: F, breit: number): F => {
		const w = v.fwidth().mul(1.5);
		return mix(
			float(1).sub(
				smoothstep(float(breit).sub(w), float(breit).add(w), abs(fract(v).sub(0.5)).mul(2))
			),
			float(breit),
			smoothstep(0.35, 0.9, w)
		);
	};
	/** Pattern coverage 0–1 for the pattern id (logic: MUSTER). */
	const musterung = (): F => {
		const id = vMuster.x,
			p = vUV.xy,
			h = vUV.zw,
			ist = (k: number): F => float(1).sub(step(0.5, abs(id.sub(k)))),
			seite = float(1).sub(vBogen.z),
			aa = p.fwidth().length().max(0.001),
			punkte = float(1).sub(
				smoothstep(float(0.25).sub(aa), float(0.25).add(aa), fract(p.div(0.9)).sub(0.5).length())
			),
			schach = smoothstep(
				aa.negate().mul(2),
				aa.mul(2),
				sin(p.x.mul(Math.PI / 1.1)).mul(sin(p.y.mul(Math.PI / 1.1)))
			),
			// Windows: as many whole bays as fit on the face.
			felder = max(vec2(1, 1), floor(h.mul(2).div(vec2(2.4, 2.9)).add(0.5))),
			fq = abs(fract(p.div(h.mul(2)).add(0.5).mul(felder)).sub(0.5)),
			fa = fq.fwidth().mul(1.2),
			fenster = float(1)
				.sub(smoothstep(float(0.24).sub(fa.x), float(0.24).add(fa.x), fq.x))
				.mul(float(1).sub(smoothstep(float(0.27).sub(fa.y), float(0.27).add(fa.y), fq.y)))
				.mul(seite),
			zelle = floor(p.div(0.42)),
			zufall = fract(sin(dot(zelle, vec2(12.9898, 78.233))).mul(43758.5453)),
			terrazzo = step(0.6, zufall).mul(
				float(1).sub(
					smoothstep(
						float(0.26).sub(aa),
						float(0.26).add(aa),
						fract(p.div(0.42))
							.sub(vec2(0.5, 0.5))
							.add(vec2(zufall.sub(0.8), fract(zufall.mul(7.3)).sub(0.5)).mul(0.3))
							.length()
					)
				)
			),
			rB = min(h.x, h.y).mul(0.52),
			bullauge = float(1)
				.sub(smoothstep(rB.sub(aa), rB.add(aa), p.length()))
				.mul(seite),
			torBreit = h.x.mul(0.42),
			torHoch = h.y.negate().add(min(h.y.mul(1.05), 2.2)),
			tor = max(
				float(1)
					.sub(smoothstep(torBreit.sub(aa), torBreit.add(aa), abs(p.x)))
					.mul(float(1).sub(step(torHoch, p.y))),
				float(1).sub(
					smoothstep(torBreit.sub(aa), torBreit.add(aa), p.sub(vec2(0, torHoch)).length())
				)
			).mul(seite),
			b = vBogen.xy.mul(4),
			dreieck = max(linie(b.x, 0.09), max(linie(b.y, 0.09), linie(b.x.add(b.y), 0.09)));
		return ist(1)
			.mul(welle(p.x.div(1.1)))
			.add(ist(2).mul(linie(p.y.div(1.2), 0.1)))
			.add(ist(3).mul(punkte))
			.add(ist(4).mul(max(linie(p.x.div(1.25), 0.07), linie(p.y.div(1.25), 0.07))))
			.add(ist(5).mul(schach))
			.add(ist(6).mul(welle(p.x.add(p.y).div(1.3))))
			.add(ist(7).mul(fenster))
			.add(ist(8).mul(dreieck))
			.add(ist(9).mul(terrazzo))
			.add(ist(10).mul(welle(p.y.div(1.1).add(abs(fract(p.x.div(1.5)).sub(0.5)).mul(1.4)))))
			.add(ist(11).mul(bullauge))
			.add(ist(12).mul(tor));
	};
	const ton = (n: V): F =>
		dot(n.mul(n), mix(vec3(0.89, 0.61, 0.72), vec3(0.89, 1, 0.72), step(0, n.y)));
	const HALB = new THREE.Vector3(-0.42, 0.62, 0.66).normalize();

	if (translucent) {
		const m = new THREE.MeshBasicNodeMaterial({
			transparent: true,
			depthWrite: false,
			side: THREE.DoubleSide
		});

		const farbe = Fn(() => {
			const n = normalize(vN),
				nv = cameraViewMatrix.mul(vec4(n, 0)).xyz,
				streif = float(1).sub(abs(nv.z).clamp(0, 1)),
				gitter = vMuster.z,
				g = vRuhe.mul((Math.PI * 2) / 5.2),
				gyroid = sin(g.x)
					.mul(cos(g.y))
					.add(sin(g.y).mul(cos(g.z)))
					.add(sin(g.z).mul(cos(g.x))),
				grenze = mix(float(1.7), float(-0.15), gitter),
				gw = gyroid.fwidth().mul(1.3).max(0.0001),
				loch = smoothstep(grenze.sub(gw), grenze.add(gw), gyroid),
				lochrand = float(1)
					.sub(smoothstep(gw, gw.mul(2.2), abs(gyroid.sub(grenze))))
					.mul(step(0.02, gitter)),
				grund = mix(vFarbe.xyz.mul(mix(float(1), ton(n), 0.6)), papier, streif.mul(0.4).add(0.3)),
				hinten = select(frontFacing, grund, mix(grund, papier, 0.4)),
				strich = max(
					kanten(0.9).mul(0.85),
					max(
						musterung().mul(vMuster.y).mul(0.7),
						max(lochrand.mul(0.9), smoothstep(0.8, 0.93, streif).mul(0.5))
					)
				),
				deck = mix(vFarbe.w, float(0.86), gitter.mul(0.9)).mul(select(frontFacing, 1, 0.55)),
				alpha = max(deck, strich).mul(float(1).sub(loch)).mul(step(0.01, vMuster.w));
			return vec4(mix(hinten, mix(tinte, papier, 0.2), strich), alpha);
		})();
		m.colorNode = farbe.xyz;
		m.opacityNode = farbe.w;
		return m;
	}

	const m = new THREE.MeshBasicNodeMaterial({
		polygonOffset: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1
	});

	m.colorNode = Fn(() => {
		const n = normalize(vN),
			glanz = vMuster.z,
			seide = min(glanz, 1),
			hart = clamp(glanz.sub(1), 0, 1),
			kontrast = mix(float(0.72), float(1), seide).add(hart.mul(0.15)),
			nv = cameraViewMatrix.mul(vec4(n, 0)).xyz,
			streif = float(1).sub(abs(nv.z).clamp(0, 1));
		let c: V = vFarbe.xyz.mul(mix(float(1), ton(n), kontrast));
		c = mix(c, tinte, musterung().mul(vMuster.y).mul(0.82));
		c = mix(c, licht, streif.mul(streif).mul(0.2).mul(seide));
		const punkt = smoothstep(0.972, 0.984, dot(nv, vec3(HALB.x, HALB.y, HALB.z))),
			rand = smoothstep(0.8, 0.87, streif);
		c = mix(c, licht, max(punkt.mul(0.75), rand.mul(0.3)).mul(hart));
		if (rod) c = mix(c, tinte, smoothstep(0.82, 0.95, streif).mul(0.7));
		return mix(c, tinte, kanten(rod ? 0.7 : 0.95));
	})();
	return m;
}
