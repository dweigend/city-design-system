<script lang="ts">
	import { onMount, tick } from 'svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import Scale from '../ui/Scale.svelte';
	import { resolveTokens } from '../scene/themeBinding';
	import { resolve } from '$app/paths';
	import {
		flowSteps,
		flowToken,
		flows,
		focusModes,
		stromEbenen,
		type FlowId,
		type FocusModeId
	} from '../data/focus';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Steuergruppe from '../bibel/Steuergruppe.svelte';
	import EbenenLegende from './EbenenLegende.svelte';
	import ModusWahl from './ModusWahl.svelte';
	import ShareReadout from './ShareReadout.svelte';
	import StromWahl from './StromWahl.svelte';
	import { createFarbLabor, type FarbLabor } from '../scene/farblabor';
	import { baueQuartier } from '../logic/farbe/quartier';
	import {
		anteile,
		laborTokens,
		mitModus,
		startAnsicht,
		waehleStrom,
		type Modus,
		type Oberflaeche,
		type StufeWahl
	} from '../logic/farbe/farblabor';

	/**
	 * Color in context: a tower on existing stock. Controls outside the canvas (DS-63), on the right
	 * beside the image (DemoLayout): focus mode and color share, then own choice of flows
	 * (at most three), then level, surface, light. Below the image: what lies in which layer.
	 * The scene follows the page mode (theme/): tokens are resolved again as soon as data-theme on
	 * <html> or the system setting changes. No switch of its own.
	 */
	let { text }: { text: string } = $props();
	const modell = baueQuartier(7);
	const ALPHA = ['--alpha-solid', '--alpha-glass', '--alpha-hull'];

	let modus = $state<Modus>(startAnsicht.modus);
	let stroeme = $state<FlowId[]>([...startAnsicht.stroeme]);
	let stufe = $state<string>(String(startAnsicht.stufe));
	let oberflaeche = $state<string>(startAnsicht.oberflaeche);
	let licht = $state(135);

	const ansicht = $derived({
		modus,
		stroeme,
		stufe: (stufe === 'bedeutung' ? 'bedeutung' : Number(stufe)) as StufeWahl,
		oberflaeche: oberflaeche as Oberflaeche
	});

	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let labor = $state<FarbLabor>();
	let alpha = $state<Record<string, number>>({});
	let fehler = $state('');
	const ruhe =
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	const anteil = $derived(alpha['--alpha-solid'] ? anteile(modell, ansicht, alpha) : null);

	onMount(() => {
		try {
			labor = createFarbLabor(canvas, modell);
		} catch (cause) {
			console.error(cause);
			fehler = '3D view unavailable. The palette below shows the same colors.';
			return;
		}
		const current = labor;
		const resize = () => current.resize(canvas.clientWidth, canvas.clientHeight);
		const ro = new ResizeObserver(resize);
		ro.observe(canvas);
		resize();
		const io = new IntersectionObserver(([e]) => current.setAnimated(e.isIntersecting && !ruhe));
		io.observe(host);
		return () => {
			io.disconnect();
			ro.disconnect();
			current.dispose();
			labor = undefined;
		};
	});

	// Initial tokens and opacity for the share display; the scene keeps its colors up to date itself.
	let tokens = $state<Record<string, string>>({});
	$effect(() => {
		void tick().then(() => {
			tokens = resolveTokens(host, laborTokens());
			const css = getComputedStyle(host);
			alpha = Object.fromEntries(ALPHA.map((a) => [a, Number(css.getPropertyValue(a)) || 1]));
		});
	});
	$effect(() => {
		if (labor && tokens['--paper']) labor.update(ansicht, tokens, alpha);
	});
	$effect(() => {
		labor?.setLight((licht * Math.PI) / 180);
	});

	const stufeItems = [
		{ value: 'bedeutung', label: 'By role' },
		...flowSteps.map((s) => ({ value: String(s.step), label: s.name }))
	];
	const oberflaecheItems = [
		{ value: 'matt', label: 'Matte' },
		{ value: 'milchig', label: 'Milky' },
		{ value: 'glas', label: 'Glass' }
	];

	/** Choose a mode: flows follow the mode. An empty choice (own flows) changes nothing. */
	function setzeModus(v: string) {
		if (!v) return;
		const a = mitModus(ansicht, v as FocusModeId);
		modus = a.modus;
		stroeme = a.stroeme;
	}
	function setzeStrom(strom: FlowId) {
		stroeme = waehleStrom(stroeme, strom);
		modus = 'eigen';
	}

	const aktuell = $derived(focusModes.find((m) => m.id === modus));
	const namen = (ids: FlowId[]) => {
		const n = flows.filter((f) => ids.includes(f.id)).map((f) => f.name);
		return n.length > 1 ? `${n.slice(0, -1).join(', ')} and ${n.at(-1)}` : (n[0] ?? 'no flow');
	};
	const inhalt = $derived(aktuell?.ebenen ?? stromEbenen(namen(stroeme)));
	const toene = $derived(
		flows.filter((f) => stroeme.includes(f.id)).map((f) => flowToken[f.id] as string)
	);
	const titel = $derived(aktuell ? `${aktuell.name}. ${aktuell.question}` : 'Own choice.');

	function zuruecksetzen() {
		modus = startAnsicht.modus;
		stroeme = [...startAnsicht.stroeme];
		stufe = String(startAnsicht.stufe);
		oberflaeche = startAnsicht.oberflaeche;
		licht = 135;
		labor?.reset();
	}
</script>

<DemoLayout label="Color lab" onreset={zuruecksetzen} offen="modus">
	{#snippet bild()}
		<div class="stage" bind:this={host}>
			<canvas
				bind:this={canvas}
				tabindex="0"
				aria-label="Tower of modules on four colorless old buildings. Drag to rotate, scroll wheel zooms."
			></canvas>
			{#if fehler}<p class="fehler" role="status">{fehler}</p>{/if}
		</div>
	{/snippet}

	{#snippet steuerung()}
		<Steuergruppe wert="modus" titel="Focus mode and color share">
			<div class="haupt">
				<ModusWahl
					id="labor-modus"
					bind:value={() => (modus === 'eigen' ? '' : modus), setzeModus}
				/>
				{#if anteil}<ShareReadout {anteil} {stroeme} />{/if}
			</div>
		</Steuergruppe>
		<Steuergruppe wert="stroeme" titel="Choose flows yourself">
			<StromWahl value={stroeme} onwaehle={setzeStrom} />
		</Steuergruppe>
		<Steuergruppe wert="darstellung" titel="Level, surface, light">
			<ChoiceControl id="labor-stufe" label="Level" items={stufeItems} bind:value={stufe} />
			<div class="oberflaeche">
				<ChoiceControl
					id="labor-oberflaeche"
					label="Surface"
					items={oberflaecheItems}
					bind:value={oberflaeche}
				/>
				<p>
					Depth comes from the <a href={resolve('/material')}>material</a>, never from a second
					color.
				</p>
			</div>
			<Scale label="Light" bind:value={licht} min={0} max={360} step={15} format={(v) => `${v}°`} />
		</Steuergruppe>
	{/snippet}

	{#snippet unterschrift()}
		<div class="unterschrift">
			<p class="titel" aria-live="polite">{titel}</p>
			<EbenenLegende {inhalt} {toene} />
			<p>{text}</p>
		</div>
	{/snippet}
</DemoLayout>

<style>
	.stage {
		position: relative;
		background: var(--paper);
		color: var(--ink);
		border: var(--hair) solid var(--line);
	}
	canvas {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 3;
		touch-action: none;
	}
	.fehler {
		position: absolute;
		inset: var(--space-4);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	.haupt {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.oberflaeche {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.oberflaeche p {
		font-size: var(--text-s);
		line-height: 1.5;
		color: var(--ink-2);
	}
	.oberflaeche a {
		color: var(--ink);
	}
	.unterschrift {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.titel {
		color: var(--ink);
		font-weight: 600;
	}
</style>
