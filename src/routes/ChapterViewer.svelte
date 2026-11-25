<script lang="ts">
	import { onMount, type ComponentProps, type Snippet } from 'svelte';
	import { StageView } from '../lib/scene/stage-view';
	import { IconButton } from '../lib/ui/icon-button';

	let { stage, controls }: { stage: ComponentProps<typeof StageView>; controls?: Snippet } =
		$props();
	let viewer: HTMLDivElement;
	let trigger = $state<HTMLElement | null>(null);
	let supported = $state(false);
	let fullscreen = $state(false);

	onMount(() => {
		supported = document.fullscreenEnabled && typeof viewer.requestFullscreen === 'function';
	});

	function syncFullscreen() {
		const active = document.fullscreenElement === viewer;
		if (fullscreen && !active) trigger?.focus({ preventScroll: true });
		fullscreen = active;
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
	<StageView {...stage} />
	{#if controls || supported}
		<div class="chapter-viewer-hud">
			{@render controls?.()}
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
