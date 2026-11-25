<script module lang="ts">
	export const lead =
		'Water, energy, food and materials circulate within each district through systems you can see in the city.';
</script>

<script lang="ts">
	import { Switch } from '../../lib/ui/switch';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import ChapterHeader from '../ChapterHeader.svelte';
	import ChapterViewer from '../ChapterViewer.svelte';
	import { chapterAt } from '../chapters';
	import { houseUses } from '../house-uses';
	import { spongePicture } from './sponge';
	import type { Condition, Measures } from './waterworks';

	const chapter = chapterAt('/supply');
	const conditions = [
		{ value: 'dry', label: 'Dry' },
		{ value: 'wet', label: 'Wet' }
	];
	const measureOptions = [
		{ value: 'baseline', label: 'Without sponge city' },
		{ value: 'sponge', label: 'With sponge city' }
	];
	const uses = houseUses.filter(({ use }) => use !== 'public' && use !== 'office');

	let condition = $state<Condition>('dry');
	let measures = $state<Measures>('baseline');
	let transparent = $state(false);
	const picture = $derived(spongePicture(condition, measures));
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} />

<section class="chapter-hero supply-hero" aria-label="Sponge city comparison">
	<ChapterViewer
		stage={{
			drawables: transparent ? picture.transparent : picture.drawables,
			view: picture.view,
			display: transparent ? 'transparency' : 'normal',
			fit: picture.fit,
			label:
				measures === 'sponge'
					? 'Two mixed-use houses with green roofs and a planted retention basin, each connected to water from the cistern and power from the cabinet'
					: 'Two mixed-use houses with bare roofs and a concrete swale, each connected to water from the cistern and power from the cabinet'
		}}
	>
		{#snippet controls()}
			<details class="supply-controls" open>
				<summary class="label">Comparison controls</summary>
				<div class="supply-options">
					<div class="control-choice">
						<ToggleGroup
							label="Condition"
							showLabel
							items={conditions}
							bind:value={() => condition, (value) => (condition = value === 'wet' ? 'wet' : 'dry')}
						/>
					</div>
					<div class="control-choice">
						<ToggleGroup
							label="Measures"
							showLabel
							items={measureOptions}
							bind:value={
								() => measures, (value) => (measures = value === 'sponge' ? 'sponge' : 'baseline')
							}
						/>
					</div>
					<Switch label="Transparency" bind:checked={transparent} />
				</div>
				<details class="supply-legend">
					<summary class="label">Legend</summary>
					<ul class="cluster house-uses small" role="list" aria-label="Utility and building colors">
						<li><span data-tone="water"></span> Water</li>
						<li><span data-tone="energy"></span> Power</li>
						{#if !transparent}
							{#each uses as { use, label, tone } (use)}
								<li><span data-tone={tone}></span> {label}</li>
							{/each}
						{/if}
					</ul>
				</details>
			</details>
			<p class="small data supply-status" role="status">Cistern · {picture.storage}</p>
		{/snippet}
	</ChapterViewer>
</section>

<div class="chapter-notes stack">
	<p class="lead">{lead}</p>
</div>
