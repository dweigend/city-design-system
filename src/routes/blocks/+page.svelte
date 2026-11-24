<script module lang="ts">
	export const lead = 'Placeable objects and the library modules that build them.';
</script>

<script lang="ts">
	import { resolve } from '$app/paths';
	import { createFocusResolver } from '../../lib/scene/focus';
	import { StageView } from '../../lib/scene/stage-view';
	import { Select } from '../../lib/ui/select';
	import { listAssets } from '../../lib/world/asset-registry';
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';
	import { buildBoard, presentBoard } from './board';
	import type { ModuleRow } from '../../../scripts/module-catalogue';

	let { data }: { data: { catalogue: ModuleRow[] } } = $props();
	const chapter = chapterAt('/blocks');
	const allAssets = listAssets();
	const allBoard = buildBoard(allAssets);
	const kindLabels: Record<string, string> = {
		house: 'Houses',
		access: 'Access',
		rail: 'Rail',
		surface: 'Surfaces',
		structure: 'Frames',
		lattice: 'Lattices'
	};
	const kinds = [
		{ value: 'all', label: 'All kinds' },
		...[...new Set(allAssets.map(({ kind }) => kind))].map((kind) => ({
			value: kind,
			label: kindLabels[kind] ?? kind
		}))
	];
	const assetLabels: Record<string, string> = {
		'house/court-neutral': 'Neutral',
		'house/court-memphis': 'Memphis',
		'house/court-archigram': 'Archigram',
		'house/court-organic': 'Organic',
		'structure/frame-bay': 'Frame bay',
		'rail/platform': 'Station platform'
	};
	const boardFocus = createFocusResolver(
		{
			full: { label: 'Full', subject: ['specimens'] },
			transparent: { label: 'Transparent', subject: ['specimens'] },
			pencil: { label: 'Pencil', subject: ['specimens'] }
		},
		{ specimens: { full: 'full', transparent: 'transparent', pencil: 'pencil' } }
	);
	let kind = $state('all');
	let display = $state('full');
	const assets = $derived(kind === 'all' ? allAssets : listAssets({ kind }));
	const board = $derived(assets.length === allAssets.length ? allBoard : buildBoard(assets));
	const focus = $derived(
		boardFocus.selectFocus(
			['specimens'],
			display === 'transparent' || display === 'pencil' ? display : 'full',
			'full'
		)
	);
	const presentation = $derived.by(() => {
		const styled = presentBoard(board, focus.readLevel('specimens'));
		return () => styled;
	});
	const labels = $derived(
		assets.map(({ id }) => assetLabels[id] ?? (id.split('/').at(-1) ?? id).replaceAll('-', ' '))
	);
	const fit = { fill: 0.87, bearing: 0.23, elevation: 0.58, offset: [0, -3] as const };
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />

<section class="stack blocks-assets" aria-labelledby="assets">
	<h2 id="assets">Assets</h2>
	<div class="cluster">
		<Select label="Asset kind" items={kinds} bind:value={kind} />
		<Select label="Display level" items={focus.items} bind:value={display} />
	</div>
	{#if assets.length}
		<StageView
			drawables={board.drawables}
			{presentation}
			{fit}
			view="iso"
			display="normal"
			label={`Placeable specimens on plinths: ${labels.join(', ')}`}
		/>
		<ul class="blocks-specimens" role="list" aria-label="Specimens">
			{#each assets as asset, index (asset.id)}
				<li>
					<strong>{labels[index]}</strong>
					<code>{asset.id}</code>
				</li>
			{/each}
		</ul>
	{:else}
		<p role="status">No assets match this kind.</p>
	{/if}
</section>

<section class="stack" aria-labelledby="catalogue">
	<h2 id="catalogue">Module catalogue</h2>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users can scroll the wide table.) -->
	<div class="blocks-table" role="region" aria-labelledby="catalogue" tabindex="0">
		<table aria-labelledby="catalogue">
			<thead>
				<tr>
					<th scope="col">Module</th>
					<th scope="col">Purpose</th>
					<th scope="col">Public exports</th>
					<th scope="col">Fixed example</th>
					<th scope="col">Config</th>
					<th scope="col">Principles</th>
				</tr>
			</thead>
			<tbody>
				{#each data.catalogue as row (row.module)}
					<tr>
						<th scope="row"><code>{row.module}</code></th>
						<td class="small">{row.purpose ?? 'Missing purpose'}</td>
						<td><code>{row.exports.join(', ')}</code></td>
						<td>
							{#if row.exampleCall}
								<code>{row.exampleCall}()</code>
							{:else if row.exampleDemo === '/interface'}
								<a class="small" href={resolve(row.exampleDemo)}>Interface</a>
							{:else}
								<span class="small">{row.example ? 'Missing caller' : 'Missing example'}</span>
							{/if}
						</td>
						<td><code>{row.config.join(', ') || '—'}</code></td>
						<td><code>{row.principles.join(', ') || '—'}</code></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
