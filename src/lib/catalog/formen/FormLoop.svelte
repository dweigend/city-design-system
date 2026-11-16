<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import LoopSchritte from '../bibel/LoopSchritte.svelte';
	import { schrittBeginn, takt } from '../logic/formen';

	/**
	 * Explainer loop of the Forms page in the pattern of the grid loops: image on the left, on the right the
	 * numbered steps with sentence and progress, below them optional controls.
	 * The time t runs only while the loop is visible and playing; with reduced
	 * motion it stands paused on `standbild`. The image follows from t alone.
	 */
	type Schritt = { id: string; titel: string; text: string };
	let {
		id,
		label,
		schrittLabel,
		schritte,
		dauern,
		t = $bindable(0),
		spielt = $bindable(true),
		standbild = 0,
		onspringe,
		children,
		extra
	}: {
		id: string;
		/** Name of the demo for screen readers. */
		label: string;
		/** Heading of the step list. */
		schrittLabel: string;
		schritte: readonly Schritt[];
		/** Duration per step in seconds. */
		dauern: number[];
		t?: number;
		spielt?: boolean;
		/** Step that stays put with reduced motion. */
		standbild?: number;
		/** A step was chosen directly. */
		onspringe?: () => void;
		/** The image (stage). */
		children: Snippet;
		/** Controls below the steps. */
		extra?: Snippet;
	} = $props();

	/** Share of a step at which a still image is fully built. */
	const STILL = 0.9;
	let host: HTMLDivElement;
	let sichtbar = $state(false);
	const jetzt = $derived(takt(dauern, t));
	const gesamt = $derived(dauern.reduce((a, b) => a + b, 0));

	onMount(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			spielt = false;
			t = schrittBeginn(dauern, standbild) + dauern[standbild] * STILL;
		}
		const io = new IntersectionObserver(([e]) => (sichtbar = e.isIntersecting), {
			threshold: 0.2
		});
		io.observe(host);
		return () => io.disconnect();
	});

	$effect(() => {
		if (!spielt || !sichtbar) return;
		let vorher = performance.now(),
			frame = requestAnimationFrame(function weiter(now) {
				// Large gaps (tab in the background) do not count.
				t = (t + Math.min(0.1, (now - vorher) / 1000)) % gesamt;
				vorher = now;
				frame = requestAnimationFrame(weiter);
			});
		return () => cancelAnimationFrame(frame);
	});

	function waehle(i: number) {
		if (i < 0) return;
		t = schrittBeginn(dauern, i) + (spielt ? 0 : dauern[i] * STILL);
		onspringe?.();
	}
</script>

<DemoLayout {label}>
	{#snippet bild()}
		<div bind:this={host}>{@render children()}</div>
	{/snippet}
	{#snippet steuerung()}
		<LoopSchritte
			id="{id}-schritte"
			label={schrittLabel}
			phasen={schritte}
			index={jetzt.index}
			anteil={jetzt.u}
			laeuft={spielt}
			onwahl={waehle}
			onumschalten={() => (spielt = !spielt)}
		/>
		{@render extra?.()}
	{/snippet}
</DemoLayout>
