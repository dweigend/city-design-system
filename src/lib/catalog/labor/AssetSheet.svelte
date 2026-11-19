<script lang="ts">
	import { assetRegistry, assetCategories, buildAsset, type AssetCategory } from '../logic/assets';
	import { theme } from '../theme';
	let { category }: { category: AssetCategory } = $props();
	let host: HTMLElement;
	let photos = $state<Record<string, string>>({});
	let error = $state('');
	const assets = $derived(assetRegistry.filter((a) => a.category === category));
	const name = (id: string) => id.replaceAll('-', ' ');
	$effect(() => {
		const selected = assets;
		void theme.mode;
		let cancelled = false;
		photos = {};
		error = '';
		async function draw() {
			const { createAssetPlate } = await import('../scene/sandbox/asset-plate');
			if (cancelled) return;
			const plate = await createAssetPlate(host);
			try {
				for (const a of selected)
					for (const v of a.variants) {
						if (cancelled) return;
						photos[a.id + '/' + v] = plate.photo(buildAsset(a.id, v, 17));
						await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
					}
			} finally {
				plate.dispose();
			}
		}
		void draw().catch(() => {
			if (!cancelled) error = 'The 3D renderer could not draw this sheet.';
		});
		return () => {
			cancelled = true;
		};
	});
</script>

<svelte:head><title>Asset catalogue · City Design System</title></svelte:head>
<main bind:this={host}>
	<header>
		<h1>Asset catalogue</h1>
		<nav aria-label="Asset categories">
			{#each assetCategories as c (c)}<a
					href={'?group=' + c}
					aria-current={category === c ? 'page' : undefined}>{c}</a
				>{/each}
		</nav>
	</header>
	<h2>{category}</h2>
	{#if error}<p role="alert">{error}</p>{/if}
	{#each assets as a (a.id)}
		<section>
			<div class="label">
				<h3>{name(a.id)}</h3>
				<small>{a.footprint.join(' × ')} m</small>
			</div>
			<div class="variants">
				{#each a.variants as v (v)}<figure>
						{#if photos[a.id + '/' + v]}<img
								width="440"
								height="300"
								src={photos[a.id + '/' + v]}
								alt={name(a.id) + ' — ' + name(v)}
							/>{:else}<div class="pending"></div>{/if}
						<figcaption>{name(v)}</figcaption>
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
