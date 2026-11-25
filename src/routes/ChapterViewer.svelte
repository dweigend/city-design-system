<script module lang="ts">
	import type { ComponentProps } from 'svelte';
	import { StageView } from '../lib/scene/stage-view';

	type StageProps = ComponentProps<typeof StageView>;
	type AspectFrame = Readonly<{
		stage: Pick<StageProps, 'drawables' | 'view' | 'fit' | 'label'>;
		args: Readonly<Record<string, number>>;
		metric: Readonly<{ label: string; value: number; unit?: string }>;
	}>;

	export type ChapterAspect = Readonly<{
		title: string;
		summary: string;
		load: () => Promise<{ run: (phase: 'start' | 'comparison') => AspectFrame }>;
		source: () => Promise<{ default: string }>;
	}>;
</script>

<script lang="ts">
	import { onDestroy, onMount, type Snippet } from 'svelte';
	import { Button } from '../lib/ui/button';
	import { IconButton } from '../lib/ui/icon-button';

	let {
		stage,
		controls,
		aspects,
		resetKey,
		onAspectStop
	}: {
		stage: StageProps;
		controls?: Snippet;
		aspects?: readonly ChapterAspect[];
		resetKey?: string;
		onAspectStop?: () => void;
	} = $props();
	let viewer: HTMLDivElement;
	let trigger = $state<HTMLElement | null>(null);
	let supported = $state(false);
	let fullscreen = $state(false);
	let active = $state.raw<ChapterAspect>();
	let demo = $state.raw<{ frame: AspectFrame; source: string }>();
	let failed = $state.raw<ChapterAspect>();
	let requestId = 0;
	let comparisonTimer: ReturnType<typeof setTimeout> | undefined;
	let lastResetKey: string | undefined;
	const comparisonDelayMs = 2500;
	const metricFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 3 });
	const shown = $derived(
		demo ? { ...stage, ...demo.frame.stage, presentation: undefined, frameWork: undefined } : stage
	);

	function cancelAspect() {
		requestId++;
		clearTimeout(comparisonTimer);
		comparisonTimer = undefined;
	}

	onDestroy(cancelAspect);

	$effect(() => {
		const current = resetKey;
		if (lastResetKey !== undefined && current !== lastResetKey && (active || demo || failed)) {
			cancelAspect();
			active = undefined;
			demo = undefined;
			failed = undefined;
		}
		lastResetKey = current;
	});

	function stopAspect() {
		cancelAspect();
		active = undefined;
		demo = undefined;
		onAspectStop?.();
		if (fullscreen) trigger?.focus({ preventScroll: true });
	}

	function failAspect(aspect: ChapterAspect) {
		stopAspect();
		failed = aspect;
	}

	async function toggleAspect(aspect: ChapterAspect) {
		if (active === aspect) {
			stopAspect();
			return;
		}

		cancelAspect();
		const request = requestId;
		active = aspect;
		demo = undefined;
		failed = undefined;
		try {
			const [{ run }, { default: source }] = await Promise.all([aspect.load(), aspect.source()]);
			if (request !== requestId) return;
			demo = { frame: run('start'), source };
			comparisonTimer = setTimeout(() => {
				comparisonTimer = undefined;
				try {
					demo = { frame: run('comparison'), source };
				} catch {
					failAspect(aspect);
				}
			}, comparisonDelayMs);
		} catch {
			if (request === requestId) failAspect(aspect);
		}
	}

	onMount(() => {
		supported = document.fullscreenEnabled && typeof viewer.requestFullscreen === 'function';
	});

	function syncFullscreen() {
		const isFullscreen = document.fullscreenElement === viewer;
		if (fullscreen && !isFullscreen) {
			fullscreen = false;
			if (active || demo) stopAspect();
			trigger?.focus({ preventScroll: true });
			return;
		}
		fullscreen = isFullscreen;
	}

	async function toggleFullscreen() {
		try {
			if (document.fullscreenElement === viewer) await document.exitFullscreen();
			else await viewer.requestFullscreen();
		} catch {
			// The browser can deny the request. Keep the ordinary viewer usable.
		}
	}

	function exitOnEscape(event: KeyboardEvent) {
		// Browsers may handle Escape before it reaches the document.
		if (event.key !== 'Escape' || event.defaultPrevented || document.fullscreenElement !== viewer)
			return;
		event.preventDefault();
		void toggleFullscreen();
	}
</script>

<svelte:document onfullscreenchange={syncFullscreen} onkeydown={exitOnEscape} />

<div class="chapter-viewer" bind:this={viewer}>
	<StageView {...shown} />
	{#if controls || supported}
		<div class="chapter-viewer-hud">
			{#if !active}
				{@render controls?.()}
			{:else}
				<span class="small chapter-viewer-subject">{active.title}</span>
				{#if fullscreen}
					<Button label="Stop" ariaLabel={`Stop ${active.title}`} onclick={stopAspect} />
				{/if}
			{/if}
			{#if supported}
				<IconButton
					bind:ref={trigger}
					icon={fullscreen ? 'minimize' : 'maximize'}
					label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
					onclick={toggleFullscreen}
				/>
			{/if}
		</div>
	{/if}
</div>

{#if aspects?.length}
	<ul class="chapter-aspects" aria-label="Single-aspect demos">
		{#each aspects as aspect (aspect.title)}
			<li class="chapter-aspect">
				<div class="chapter-aspect-row">
					<div>
						<h2>{aspect.title}</h2>
						<p class="small">{aspect.summary}</p>
					</div>
					{#if !fullscreen || active !== aspect}
						<Button
							label={active === aspect ? 'Stop' : 'Play'}
							ariaLabel={`${active === aspect ? 'Stop' : 'Play'} ${aspect.title}`}
							onclick={() => void toggleAspect(aspect)}
						/>
					{/if}
				</div>
				{#if failed === aspect}
					<p class="small" role="status">Could not load this demo. Select Play to try again.</p>
				{:else if active === aspect && !demo}
					<p class="small" role="status">Loading demo…</p>
				{/if}
			</li>
		{/each}
	</ul>
	{#if demo && active}
		<div class="chapter-aspect-details">
			<dl class="chapter-aspect-values data" aria-live="polite">
				{#each Object.entries(demo.frame.args) as [name, value] (name)}
					<div>
						<dt translate="no">{name}</dt>
						<dd>{value}</dd>
					</div>
				{/each}
				<div class="chapter-aspect-metric">
					<dt>{demo.frame.metric.label}</dt>
					<dd>
						{metricFormat.format(demo.frame.metric.value)}{#if demo.frame.metric.unit}&nbsp;{demo
								.frame.metric.unit}{/if}
					</dd>
				</div>
			</dl>
			{#key active.title}
				<details class="chapter-aspect-disclosure">
					<summary class="label">Source · {active.title}</summary>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex (Make the scrolling source reachable by keyboard.) -->
					<pre
						class="chapter-aspect-source"
						role="region"
						aria-label={`${active.title} source`}
						tabindex="0"
						translate="no"><code>{demo.source}</code></pre>
				</details>
			{/key}
		</div>
	{/if}
{/if}
