import { studioGround } from './studio-ground';
import { studioPipeline } from './studio-pipeline';
import * as THREE from 'three/webgpu';
import { createMaterialKamera } from './materialKamera';
import { bindSceneTheme } from './themeBinding';
import { studioPalette, studioFarbwechsel } from './materialStudio';
import { createMaterialStuecke } from './materialStuecke';
import { stueckHuelle } from './materialStueckGeometrie';
import type { Palette3D } from '../data/city3d';
import type { Stueck } from '../logic/material/formen';

/**
 * Stage of the material page: shows pieces (part + recipe) with three.js, WebGPU with a
 * WebGL 2 fallback. The orthographic studio shows lit physical surfaces. The diagram stage
 * shows the legacy recipe with directional tones and schematic edges.
 * Draws only on change, with a short water animation when the scene enters view.
 * Reduced motion renders the still surface.
 * Axes: model x → three x, model y → three −z, model z → three y.
 */
export type MaterialBuehne = {
	ready: Promise<void>;
	zeige(stuecke: Stueck[]): void;
	resize(widthPx: number, heightPx: number): void;
	/** Visible in the viewport: only then do animated materials run. */
	setAktiv(aktiv: boolean): void;
	/** Set the diagram clock in seconds, including its paused still frame. */
	setzeDiagrammZeit(zeitS: number): void;
	/** Replay the bounded water study from its seeded initial state. */
	wasserStart(): void;
	zuruecksetzen(): void;
	dispose(): void;
};

export type BuehnenOptionen = {
	/** Use the fixed studio lighting and physical finish projection. */
	studio?: boolean;
	drehen?: boolean;
	/** View: elevation above the horizon and direction in degrees. */
	hoeheDeg?: number;
	azimutDeg?: number;
	/** Margin around the scene as a share of its size. */
	rand?: number;
	/** Let animated materials run (otherwise time stops at the first frame). */
	bewegung?: boolean;
	onError?: () => void;
};

/** Mounts the material stage on a canvas. Its caller owns measurement, visibility and disposal. */
export function createMaterialBuehne(
	canvas: HTMLCanvasElement,
	optionen: BuehnenOptionen = {}
): MaterialBuehne {
	const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: false });

	const scene = new THREE.Scene();
	const welt = new THREE.Group();
	scene.add(welt);
	const bewegung =
		optionen.bewegung !== false && !matchMedia('(prefers-reduced-motion: reduce)').matches;

	let alive = true;
	let initialized = false;
	let aktiv = true;
	let pending = 0;
	let animiertBis = 0;
	let letzteZeit: number | undefined;
	let mitWasser = false;
	let rahmenKey = '';
	let palette: Palette3D | undefined;
	let letzte: Stueck[] = [];
	const blick = createMaterialKamera(canvas, optionen, render);

	const pipeline = studioPipeline(renderer, scene, blick.kamera);
	const studio = optionen.studio ? studioGround(pipeline.light) : undefined;
	if (studio) scene.add(studio.floor);
	const projektion = createMaterialStuecke(welt, !!studio, () => scene.environment);

	const bewegt = () => bewegung && aktiv && performance.now() < animiertBis && mitWasser;

	function bewegungsImpuls() {
		letzteZeit = undefined;
		animiertBis = performance.now() + 4200;
	}

	function wasserSchritt(zeit: number) {
		const deltaS = (zeit - (letzteZeit ?? zeit)) / 1000;
		letzteZeit = zeit;
		projektion.advance(deltaS);
	}

	function render() {
		if (!alive || !initialized || pending) return;
		pending = requestAnimationFrame((zeit) => {
			pending = 0;
			const laeuft = bewegt();
			if (laeuft) wasserSchritt(zeit);
			pipeline.render();
			canvas.dataset.frame = String(Number(canvas.dataset.frame ?? 0) + 1);
			if (laeuft) render();
		});
	}

	function rahme() {
		const key = letzte.map((s) => JSON.stringify(s.teil)).join();
		if (key === rahmenKey) return;
		rahmenKey = key;
		bewegungsImpuls();
		const box = new THREE.Box3();
		for (const s of letzte) stueckHuelle(s.teil, box);
		if (box.isEmpty()) return;
		studio?.frame(box);
		pipeline.light.frame(box);
		blick.frame(box);
	}

	function zeichne() {
		if (!palette) return;
		projektion.zeige(letzte, palette, bewegung);
		pipeline.light.refresh();
		rahme();
		render();
	}

	const ready = renderer
		.init()
		.then(() => {
			if (!alive) {
				renderer.dispose();
				return;
			}
			initialized = true;
			canvas.dataset.backend =
				'isWebGPUBackend' in renderer.backend && renderer.backend.isWebGPUBackend
					? 'webgpu'
					: 'webgl2';
			render();
		})
		.catch((cause) => {
			if (alive) optionen.onError?.();
			throw cause;
		});

	function applyPalette(farben: Palette3D) {
		const neuZeichnen = !studio || studioFarbwechsel(palette, farben);
		palette = farben;
		if (!neuZeichnen) return;
		projektion.leeren();
		zeichne();
	}
	const projekt = studio ? studioPalette : undefined;
	const stopTheme = bindSceneTheme(canvas, scene, renderer, applyPalette, projekt);

	return {
		ready,
		zeige(stuecke) {
			const bewegtesMaterial = stuecke.some((s) => s.rezept.haut.bewegt);
			if (bewegtesMaterial && !mitWasser) bewegungsImpuls();
			mitWasser = bewegtesMaterial;
			letzte = stuecke;
			zeichne();
		},
		resize(w, h) {
			const width = Math.max(1, w);
			const height = Math.max(1, h);
			renderer.setSize(width, height, false);
			blick.resize(width / height);
			render();
		},
		setzeDiagrammZeit(zeitS) {
			projektion.setzeDiagrammZeit(zeitS);
			render();
		},
		setAktiv(a) {
			if (a && !aktiv) bewegungsImpuls();
			aktiv = a;
			render();
		},
		wasserStart() {
			if (!bewegung || !mitWasser) return;
			projektion.wasserStart();
			bewegungsImpuls();
			render();
		},
		zuruecksetzen: blick.reset,
		dispose() {
			alive = false;
			if (pending) cancelAnimationFrame(pending);
			stopTheme();
			blick.dispose();
			projektion.dispose();
			studio?.dispose();
			pipeline.dispose();
			if (initialized) renderer.dispose();
		}
	};
}
