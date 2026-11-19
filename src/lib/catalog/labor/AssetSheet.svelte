<script lang="ts">
	import { resolve } from '$app/paths';
	import { assetRegistry, assetCategories, buildObject } from '../logic/assets';
	import { materialSheet, type SheetRow } from '../logic/material/contact-sheet';
	import type { ColorToken } from '../logic/parametrik/types';
	import { flowToken } from '../data/focus';
	import AssetSheetRow from './AssetSheetRow.svelte';
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
	let photos = $state<Record<string, string | null>>({});
	let error = $state('');
	let drawing = Promise.resolve();
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
							parts: () => buildObject(a.id, v, 17).parts
						}))
					}))
	);
	$effect(() => {
		const selected = rows;
		void theme.mode;
		let cancelled = false;
		const urls: string[] = [];
		rendered = false;
		photos = {};
		error = '';
		async function draw() {
			const plate = await openPlate();
			if (!plate) return;
			try {
				publish(await drawSamples(plate));
			} finally {
				await plate.dispose();
			}
		}

		async function openPlate() {
			if (cancelled) return;
			const { createAssetPlate } = await import('../scene/sandbox/asset-plate');
			if (!cancelled) return createAssetPlate(host);
		}

		function publish(failures: number) {
			if (cancelled) return;
			if (failures) error = 'Some previews could not be drawn.';
			else rendered = true;
		}

		async function drawSamples(
			plate: Awaited<ReturnType<typeof import('../scene/sandbox/asset-plate').createAssetPlate>>
		) {
			let failures = 0;
			for (const a of selected)
				for (const sample of a.samples) {
					if (cancelled) return failures;
					const key = a.id + '/' + sample.id;
					failures += Number(!(await drawSample(key, () => plate.photo(sample.parts()))));
				}
			return failures;
		}

		async function drawSample(key: string, photo: () => Promise<Blob>) {
			try {
				const png = await photo();
				if (cancelled) return false;
				const url = URL.createObjectURL(png);
				urls.push(url);
				photos[key] = url;
				return true;
			} catch (cause) {
				if (cancelled) return false;
				console.error('Could not draw asset sample ' + key, cause);
				photos[key] = null;
				return false;
			}
		}

		drawing = drawing.then(draw).catch((cause) => {
			console.error(cause);
			if (!cancelled) error = 'The 3D renderer could not draw this sheet.';
		});
		return () => {
			cancelled = true;
			for (const url of urls) URL.revokeObjectURL(url);
		};
	});
</script>

<svelte:head><title>Asset catalogue · City Design System</title></svelte:head>
<main bind:this={host} data-render-done={rendered}>
	<header>
		<h1>Asset catalogue</h1>
		<nav aria-label="Asset categories">
			{#each groups as c (c)}<a
					href={resolve(`/labor/assets?group=${encodeURIComponent(c)}`)}
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
		<AssetSheetRow {a} {photos} busy={!rendered && !error} />
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
	nav {
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
	h2 {
		margin: 0;
	}
	h1 {
		font: 600 1rem var(--font-sans);
	}
	h2 {
		margin: 1.5rem 0;
		font: 500 2.5rem var(--font-sans);
		text-transform: capitalize;
	}
</style>
