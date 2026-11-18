<script lang="ts">
	import { onMount } from 'svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import LoopSchritte from '../bibel/LoopSchritte.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import { studienLoop } from './studienLoop.svelte';
	import { bauweiseWahl, bauweisen, tragwerkStufen } from '../data/materialTraeger';
	import { familienTexte, type TraegerFamilieText } from '../data/traeger';
	import { materialModell, materialPlan, naehe } from '../logic/traeger/integration/material';
	import {
		createTraegerMaterialSzene,
		type TraegerMaterialSzene
	} from '../scene/traegerIntegrationMaterial';

	/**
	 * Explainer loop of detail levels on the structural system: the view starts at the node, where wood, metal, glass
	 * and membrane show their recipe, and pulls back until only the line remains. Finally
	 * the envelope becomes the ghost. Construction type selectable; the image is a pure function of time and choice.
	 */
	const stufen = tragwerkStufen.map((s) => s.id);
	const wahl = bauweisen.map((b) => ({
		value: b.id,
		label: familienTexte.find((f) => f.id === b.id)?.name ?? b.id
	}));

	let host: HTMLDivElement, canvas: HTMLCanvasElement;
	let bauweise = $state<string>(bauweisen[0].id);
	let szene = $state<TraegerMaterialSzene>();
	let fehler = $state('');
	const loop = studienLoop(() => host, tragwerkStufen.length, 4, 0.6, '0px');
	const stand = $derived(loop.stand);
	const phase = $derived(tragwerkStufen[stand.index]);
	const eintrag = $derived(bauweisen.find((b) => b.id === bauweise) ?? bauweisen[0]);
	const plan = $derived(materialPlan(bauweise as TraegerFamilieText));
	const modell = $derived(materialModell(plan, phase.id));
	// Hundredths are enough for the camera; this way the stage does not redraw while still.
	const nah = $derived(Math.round(naehe(stufen, stand.index, stand.anteil) * 100) / 100);

	onMount(() => {
		let aktuell: TraegerMaterialSzene | undefined;
		const ro = new ResizeObserver(() => aktuell?.resize(canvas.clientWidth, canvas.clientHeight));
		const nahe = new IntersectionObserver(
			([e]) => {
				if (!e.isIntersecting || aktuell) return;
				try {
					aktuell = createTraegerMaterialSzene(canvas, () => (fehler = '3D view unavailable.'));
					void aktuell.ready.catch(() => {});
					aktuell.resize(canvas.clientWidth, canvas.clientHeight);
					szene = aktuell;
					ro.observe(canvas);
				} catch (cause) {
					console.error(cause);
					fehler = '3D view unavailable.';
				}
			},
			{ rootMargin: '200px' }
		);
		nahe.observe(host);
		return () => {
			nahe.disconnect();
			ro.disconnect();
			aktuell?.dispose();
			szene = undefined;
		};
	});
	$effect(() => {
		szene?.zeige(modell);
	});
	$effect(() => {
		szene?.blick(nah);
	});
</script>

<DemoLayout label="Detail levels on the structural system">
	{#snippet bild()}
		<div class="buehne" bind:this={host}>
			<canvas
				bind:this={canvas}
				aria-label="Simplified diagram representation. {eintrag.satz} {phase.titel}: {phase.text}"
			></canvas>
			{#if fehler}<p class="fehler" role="status">{fehler}</p>{/if}
		</div>
	{/snippet}
	{#snippet steuerung()}
		<div class="steuerung">
			<ChoiceControl
				id="tragwerk-bauweise"
				label={bauweiseWahl.label}
				items={wahl}
				bind:value={bauweise}
			/>
			<LoopSchritte id="tragwerk-stufen" label="Level" phasen={tragwerkStufen} {...loop.schritte} />
		</div>
	{/snippet}
	{#snippet unterschrift()}
		<p>Simplified diagram representation. {eintrag.satz}</p>
	{/snippet}
</DemoLayout>

<style>
	.buehne {
		position: relative;
		background: var(--paper);
		border: var(--hair) solid var(--line);
	}
	canvas {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 10;
	}
	.steuerung {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-width: 0;
	}
	.fehler {
		position: absolute;
		inset: var(--space-4);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	@media (max-width: 720px) {
		canvas {
			aspect-ratio: 4 / 3;
		}
	}
</style>
