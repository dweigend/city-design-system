<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { Label } from 'bits-ui';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Scale from '../ui/Scale.svelte';
	import Button from '../ui/Button.svelte';
	import Vertiefung from '../ui/Vertiefung.svelte';
	import RasterLeiste from './RasterLeiste.svelte';
	import SchichtWahl from './SchichtWahl.svelte';
	import { createRasterBuehne, type RasterBuehne } from '../scene/rasterBuehne';
	import { rasterReihe, rasterSchichten } from '../logic/bibel/raster';
	import { rasterarten, welt, weltDefaults, type RasterId } from '../logic/parametrik/welt';
	import { nextSeed } from '../logic/parametrik/random';
	import { schichten, startSchichten, type SchichtId } from '../data/raster';
	import { netzBild } from './bilder';

	/**
	 * Main simulation of the chapter: nine grids on the same seed, five layers from the blocks
	 * to the city. Grid choice directly above the image, layers and mesh beside it on the right.
	 * Mesh in top view; as soon as the city is added, the view tilts into the oblique.
	 */
	const START = {
		raster: 'sechseck' as RasterId,
		seed: 45,
		groesse: 4,
		mass: 1,
		verzug: 0,
		relax: 2
	};

	let raster = $state<string>(START.raster),
		seed = $state(START.seed),
		groesse = $state(START.groesse),
		mass = $state(START.mass),
		verzug = $state(START.verzug),
		relax = $state(START.relax),
		aktiv = $state<SchichtId[]>([...startSchichten]),
		zuletzt = $state<SchichtId>('vierecke');

	const lageParams = $derived({
		raster: raster as RasterId,
		seed,
		groesse,
		mass,
		verzug,
		relax
	});
	const reihe = $derived(rasterReihe(seed));
	const lage = $derived(rasterSchichten(lageParams));
	const stadtAn = $derived(aktiv.includes('stadt'));
	const stadt = $derived(stadtAn ? welt({ ...weltDefaults, ...lageParams }).primitives : null);
	const art = $derived(rasterarten.find((r) => r.id === raster) ?? rasterarten[0]);
	const erklaert = $derived(schichten.find((s) => s.id === zuletzt) ?? schichten[0]);

	// The most recently enabled layer explains itself below the image.
	let vorher: SchichtId[] = [...startSchichten];
	$effect(() => {
		const neu = aktiv.find((s) => !vorher.includes(s));
		if (neu) zuletzt = neu;
		else if (!aktiv.includes(zuletzt) && aktiv.length) zuletzt = aktiv[aktiv.length - 1];
		vorher = [...aktiv];
	});

	let canvas: HTMLCanvasElement;
	let host: HTMLDivElement;
	let buehne = $state<RasterBuehne>();
	let fehler = $state('');

	onMount(() => {
		let aktuell: RasterBuehne | undefined;
		const io = new IntersectionObserver(
			([e]) => {
				if (!e.isIntersecting || aktuell) return;
				try {
					aktuell = createRasterBuehne(
						canvas,
						{
							extent: lage.extent * (stadtAn ? 0.74 : 0.86),
							hoeheDeg: stadtAn ? 36 : 90,
							azimutDeg: 28
						},
						{ drehen: true, onError: () => (fehler = '3D view unavailable.') }
					);
					void aktuell.ready.catch(() => {});
					buehne = aktuell;
					ro.observe(canvas);
				} catch (cause) {
					console.error(cause);
					fehler = '3D view unavailable.';
				}
			},
			{ rootMargin: '200px' }
		);
		const ro = new ResizeObserver(() => aktuell?.resize(canvas.clientWidth, canvas.clientHeight));
		io.observe(host);
		return () => {
			io.disconnect();
			ro.disconnect();
			aktuell?.dispose();
			buehne = undefined;
		};
	});

	$effect(() => {
		buehne?.zeige({ ...netzBild(lage, aktiv), stadt });
	});
	$effect(() => {
		buehne?.setBlick(
			{ extent: lage.extent * (stadtAn ? 0.74 : 0.86), hoeheDeg: stadtAn ? 36 : 90, azimutDeg: 28 },
			true
		);
	});

	function zuruecksetzen() {
		raster = START.raster;
		seed = START.seed;
		groesse = START.groesse;
		mass = START.mass;
		verzug = START.verzug;
		relax = START.relax;
		aktiv = [...startSchichten];
		zuletzt = 'vierecke';
		buehne?.zuruecksetzen();
	}

	const prozent = (v: number) => `${Math.round(v * 100)} %`;
</script>

<DemoLayout label="Grid and layers" onreset={zuruecksetzen}>
	{#snippet bild()}
		<div class="bild">
			<RasterLeiste items={reihe} bind:value={raster} />
			<div class="stage" bind:this={host}>
				<canvas
					bind:this={canvas}
					tabindex="0"
					aria-label="District on the {art.name} grid. Visible: {aktiv
						.map((s) => schichten.find((x) => x.id === s)?.name)
						.join(', ') || 'nothing'}. Drag to rotate, scroll wheel zooms."
				></canvas>
				{#if fehler}<p class="fehler" role="status">{fehler}</p>{/if}
			</div>
		</div>
	{/snippet}

	{#snippet steuerung()}
		<SchichtWahl {schichten} bind:aktiv />
		<Vertiefung label="Adjust the mesh">
			<div class="netz">
				<Scale
					label="District"
					bind:value={groesse}
					min={3}
					max={6}
					step={1}
					format={(v) => `${v} × ${v} blocks`}
				/>
				<Scale
					label="Block size"
					bind:value={mass}
					min={0.8}
					max={1.3}
					step={0.05}
					format={(v) => `${Math.round(v * 30)} m`}
				/>
				<Scale
					label="Distortion"
					bind:value={verzug}
					min={0}
					max={1}
					step={0.05}
					format={prozent}
				/>
				<Scale
					label="Smoothing"
					bind:value={relax}
					min={0}
					max={6}
					step={1}
					format={(v) => (v ? `${v} passes` : 'off')}
				/>
				<div class="saat">
					<Label.Root for="raster-saat">Seed</Label.Root>
					<div class="zeile">
						<input
							id="raster-saat"
							name="raster-saat"
							type="number"
							min="0"
							max="4294967295"
							step="1"
							autocomplete="off"
							value={seed}
							oninput={(e) => {
								const n = e.currentTarget.valueAsNumber;
								if (Number.isFinite(n)) seed = Math.max(0, Math.min(4294967295, Math.round(n)));
							}}
						/>
						<Button variant="secondary" label="Reroll" onclick={() => (seed = nextSeed(seed))} />
					</div>
				</div>
			</div>
		</Vertiefung>
	{/snippet}

	{#snippet unterschrift()}
		<p><b>{art.name}.</b> {art.regel}</p>
		<p>
			{erklaert.text}
			{#if erklaert.weiter}<a href={resolve(erklaert.weiter.pfad)}>{erklaert.weiter.text}</a>{/if}
		</p>
	{/snippet}
</DemoLayout>

<style>
	.bild {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		background: var(--paper);
	}
	.stage {
		position: relative;
		border: var(--hair) solid var(--line);
		background: var(--paper);
	}
	canvas {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 10;
		touch-action: none;
		cursor: grab;
	}
	canvas:active {
		cursor: grabbing;
	}
	canvas:focus-visible {
		outline: var(--stroke) solid var(--ink);
		outline-offset: -2px;
	}
	.fehler {
		position: absolute;
		inset: var(--space-4);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	.netz {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-3) 0 var(--space-2);
	}
	.saat {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	.zeile {
		display: flex;
		gap: var(--space-2);
	}
	input {
		flex: 1;
		min-width: 0;
		height: var(--ctl-m);
		padding: 0 var(--space-2);
		border: var(--hair) solid var(--line);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-variant-numeric: tabular-nums;
	}
	input:focus-visible {
		outline: var(--stroke) solid var(--ink);
		outline-offset: 1px;
	}
	p + p {
		margin-top: var(--space-2);
	}
	b {
		font-weight: 600;
		color: var(--ink);
	}
	a {
		color: var(--ink);
	}
</style>
