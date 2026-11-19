<script lang="ts">
	import { observeSceneVisibility } from './scene-visibility.svelte';
	import { RadioGroup } from 'bits-ui';
	import { readPalette } from '../scene/themeBinding';
	import { theme } from '../theme';
	import { createParametrikScene, type View } from './parametrik';
	import { defaultStyle } from '../logic/parametrik/style';
	import type { Primitive } from '../logic/parametrik/types';

	type Item = { id: string; name: string; primitives: Primitive[] };
	/**
	 * Grid of small vignettes: one WebGL scene renders every form in turn
	 * with the same camera (view) and stores each as an image. Selection via Bits RadioGroup.
	 */
	let {
		groups,
		view,
		label,
		value = $bindable(''),
		kompakt = false
	}: {
		groups: { id: string; name: string; items: Item[] }[];
		view: View;
		label: string;
		value?: string;
		/** Sidebar of a demo: no group heading, three columns, names in the body typeface. */
		kompakt?: boolean;
	} = $props();
	const W = 240,
		H = 200;
	let host: HTMLDivElement;
	let mounted = $state(false);
	let images = $state<Record<string, string>>({});
	let cached = '';
	observeSceneVisibility(
		() => host,
		'100px',
		(visible) => (mounted = visible)
	);
	$effect(() => {
		if (!mounted) return;
		void theme.mode;
		const items = groups.flatMap((g) => g.items);
		const key = JSON.stringify({ items, view, theme: theme.mode });
		if (key === cached) return;
		const canvas = document.createElement('canvas');
		let scene: ReturnType<typeof createParametrikScene>;
		try {
			scene = createParametrikScene(canvas, readPalette(host), () => {}, false);
		} catch (cause) {
			console.error(cause);
			return;
		}
		scene.resize(W, H);
		let cancelled = false,
			i = 0;
		// A few vignettes per frame keep the page responsive.
		const step = () => {
			if (cancelled) return;
			const next: Record<string, string> = {};
			for (const end = Math.min(items.length, i + 4); i < end; i++) {
				scene.update(items[i].primitives, defaultStyle, view);
				next[items[i].id] = scene.snapshot();
			}
			images = { ...images, ...next };
			if (i < items.length) requestAnimationFrame(step);
			else {
				cached = key;
				scene.dispose();
			}
		};
		void scene.ready
			.then(() => {
				if (!cancelled) requestAnimationFrame(step);
			})
			.catch(() => {});
		return () => {
			if (!cancelled && i < items.length) scene.dispose();
			cancelled = true;
		};
	});
</script>

<div class="vignettes" class:kompakt bind:this={host}>
	<RadioGroup.Root bind:value aria-label={label} class="groups">
		{#each groups as group (group.id)}
			<div class="group" role="presentation">
				{#if !kompakt}<h3>{group.name} <span>{group.items.length}</span></h3>{/if}
				<div class="row">
					{#each group.items as item (item.id)}
						<RadioGroup.Item value={item.id} class="cell" aria-label={item.name}>
							{#if images[item.id]}<img
									src={images[item.id]}
									alt=""
									width={W}
									height={H}
								/>{:else}<span class="blank"></span>{/if}
							<span class="name">{item.name}</span>
						</RadioGroup.Item>
					{/each}
				</div>
			</div>
		{/each}
	</RadioGroup.Root>
</div>

<style>
	.vignettes :global(.groups) {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}
	h3 {
		margin: 0 0 var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	h3 span {
		color: var(--ink-3);
	}
	.row {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--space-2);
	}
	.vignettes :global(.cell) {
		display: flex;
		flex-direction: column;
		padding: 0;
		border: var(--hair) solid var(--line);
		background: var(--paper);
		color: var(--ink);
		cursor: pointer;
		text-align: left;
		font: inherit;
		touch-action: manipulation;
	}
	.vignettes :global(.cell:hover) {
		border-color: var(--ink-3);
	}
	.vignettes :global(.cell[data-state='checked']) {
		border-color: var(--ink);
		outline: var(--hair) solid var(--ink);
	}
	img,
	.blank {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 6 / 5;
	}
	.name {
		padding: var(--space-1) var(--space-2) var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		border-top: var(--hair) solid var(--line);
	}
	.kompakt .row {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.kompakt .name {
		font-family: var(--font-sans);
		font-size: var(--text-s);
		line-height: 1.3;
	}
</style>
