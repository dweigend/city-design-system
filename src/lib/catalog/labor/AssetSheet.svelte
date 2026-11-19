<script lang="ts">
	import { assetRegistry, assetCategories, buildAsset } from '../logic/assets';
	import { materialSheet, type SheetRow } from '../logic/material/contact-sheet';
	import type { ColorToken } from '../logic/parametrik/types';
	import { flowToken } from '../data/focus';
	import ChoiceControl from './ChoiceControl.svelte';
	import { theme } from '../theme';
	let { group }: { group: string | null } = $props();
	const groups = [...assetCategories, 'materials'];
	const category = $derived(groups.includes(group ?? '') ? group : assetCategories[0]);
	const pigments = [
		{ value: '--paper', label: 'Paper' },
		{ value: '--ink', label: 'Ink' },
		{ value: '--body-living', label: 'Housing' },
		...Object.entries(flowToken).map(([label, value]) => ({ label, value }))
	];
	let pigment = $state<ColorToken>('--cat-health');
	let host: HTMLElement;
	let rendered = $state(false);
	let photos = $state<Record<string, string>>({});
	let error = $state('');
	const name = (id: string) => id.replaceAll('-', ' ');
	const rows = $derived<SheetRow[]>(
		category === 'materials'
			? materialSheet(pigment)
			: assetRegistry
					.filter((a) => a.category === category)
					.map((a) => ({
						id: a.id,
						label: name(a.id),
						dimensions: a.footprint.join(' × ') + ' m',
						samples: a.variants.map((v) => ({
							id: v,
							label: name(v),
							parts: () => buildAsset(a.id, v, 17)
						}))
					}))
	);
	$effect(() => {
		const selected = rows;
		void theme.mode;
		let cancelled = false;
		rendered = false;
		photos = {};
		error = '';
		async function draw() {
			const { createAssetPlate } = await import('../scene/sandbox/asset-plate');
			if (cancelled) return;
			const plate = await createAssetPlate(host);
			try {
				for (const a of selected)
					for (const sample of a.samples) {
						if (cancelled) return;
						photos[a.id + '/' + sample.id] = plate.photo(sample.parts());
						await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
					}
				if (!cancelled) rendered = true;
			} finally {
				plate.dispose();
			}
		}
		void draw().catch((cause) => {
			console.error(cause);
			if (!cancelled) error = 'The 3D renderer could not draw this sheet.';
		});
		return () => {
			cancelled = true;
		};
	});
</script>

<svelte:head><title>Asset catalogue · City Design System</title></svelte:head>
<main bind:this={host} data-render-done={rendered}>
	<header>
		<h1>Asset catalogue</h1>
		<nav aria-label="Asset categories">
			{#each groups as c (c)}<a
					href={'?group=' + c}
					aria-current={category === c ? 'page' : undefined}>{c}</a
				>{/each}
		</nav>
	</header>
	<h2>{category}</h2>
	{#if category === 'materials'}
		<ChoiceControl
			id="sheet-pigment"
			label="Pigment"
			items={pigments}
			bind:value={
				() => pigment,
				(value) => {
					const choice = pigments.find((p) => p.value === value);
					if (choice) pigment = choice.value as ColorToken;
				}
			}
		/>
	{/if}
	{#if error}<p role="alert">{error}</p>{/if}
	{#each rows as a (a.id)}
		<section aria-busy={!rendered && !error}>
			<div class="label">
				<h3>{a.label}</h3>
				{#if a.dimensions}<small>{a.dimensions}</small>{/if}
			</div>
			<div class="variants">
				{#each a.samples as sample (sample.id)}<figure>
						{#if photos[a.id + '/' + sample.id]}<img
								width="440"
								height="300"
								src={photos[a.id + '/' + sample.id]}
								alt={a.label + ' — ' + sample.label}
							/>{:else}<div class="pending"></div>{/if}
						<figcaption>{sample.label}</figcaption>
					</figure>{/each}
			</div>
		</section>
	{/each}
</main>

<style>
	main {
		max-width: 84rem;
		margin: auto;
		padding: clamp(1rem, 3vw, 3rem);
		color: var(--ink);
	}
	header,
	nav,
	.label {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		flex-wrap: wrap;
	}
	header {
		justify-content: space-between;
		border-bottom: 1px solid var(--line);
		padding-bottom: 1rem;
	}
	nav a {
		color: var(--ink-2);
		text-transform: capitalize;
		text-underline-offset: 0.3em;
	}
	nav a[aria-current] {
		color: var(--ink);
		font-weight: 650;
	}
	h1,
	h2,
	h3,
	figure {
		margin: 0;
	}
	h1,
	h3 {
		font: 600 1rem var(--font-sans);
	}
	h2 {
		margin: 1.5rem 0;
		font: 500 2.5rem var(--font-sans);
		text-transform: capitalize;
	}
	h3,
	figcaption {
		text-transform: capitalize;
	}
	section {
		display: grid;
		grid-template-columns: minmax(8rem, 1fr) 5fr;
		gap: 1rem;
		border-top: 1px solid var(--line);
		padding: 1rem 0;
	}
	.label {
		align-content: start;
		flex-direction: column;
		gap: 0.3rem;
	}
	small,
	figcaption {
		font: 400 0.82rem var(--font-mono);
		color: var(--ink-2);
	}
	.variants {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
		gap: 1rem;
	}
	img,
	.pending {
		width: 100%;
		aspect-ratio: 22/15;
		height: auto;
		display: block;
	}
	@media (max-width: 640px) {
		section {
			grid-template-columns: 1fr;
		}
		.label {
			flex-direction: row;
		}
		.variants {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
