<script module lang="ts">
	export const lead =
		'Dots mark junctions, and the heavier line follows the shortest route. At ground level the path goes around the walled yard. Elevated walkways cut across it, saving distance at the cost of a climb.';
</script>

<script lang="ts">
	import { resolve } from '$app/paths';
	import type { View } from '../../lib/scene/stage';
	import { Select } from '../../lib/ui/select';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import ChapterHeader from '../ChapterHeader.svelte';
	import ChapterViewer from '../ChapterViewer.svelte';
	import { chapterAt } from '../chapters';
	import {
		createSchematic,
		readSchematicElements,
		readSchematicRoute,
		readSchematicSelection,
		routePairs,
		schematicFit,
		walkwayLevels
	} from './schematic';

	const chapter = chapterAt('/paths');
	const portalTo = '.paths-hero .chapter-viewer';
	const format = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
	const views = [
		{ value: 'iso', label: 'Iso' },
		{ value: 'plan', label: 'Plan' }
	];
	let walkway = $state<string>(walkwayLevels[0].value);
	let selectedPair = $state<string>(routePairs[0].value);
	let inspected = $state<string>('none');
	let view = $state<View>('iso');

	const level = $derived(walkwayLevels.find(({ value }) => value === walkway) ?? walkwayLevels[0]);
	const pair = $derived(routePairs.find(({ value }) => value === selectedPair) ?? routePairs[0]);
	const schematic = $derived(createSchematic(level.level));
	const elementItems = $derived(readSchematicElements(schematic));
	const selection = $derived(readSchematicSelection(schematic, inspected));
	$effect(() => {
		if (inspected !== 'none' && !selection) inspected = 'none';
	});
	const highlighted = $derived(readSchematicRoute(schematic, pair));
	const drawables = $derived([
		...schematic.drawables,
		...highlighted.drawables,
		...(selection ? [selection.drawable] : [])
	]);
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader title={chapter.title} />

<section class="chapter-hero paths-hero" aria-label="Walking network schematic">
	<ChapterViewer
		stage={{
			drawables,
			view,
			display: 'normal',
			fit: schematicFit,
			label:
				'Two river banks with a footbridge, a walled yard, an elevated transit line and the highlighted walking route'
		}}
	>
		{#snippet controls()}
			<Select label="Walkway level" items={walkwayLevels} {portalTo} bind:value={walkway} />
			<Select label="Route" items={routePairs} {portalTo} bind:value={selectedPair} />
			<Select
				label="Inspect"
				items={elementItems}
				{portalTo}
				bind:value={() => (selection ? inspected : 'none'), (value: string) => (inspected = value)}
			/>
			<div class="control-choice">
				<ToggleGroup
					label="View"
					showLabel
					items={views}
					bind:value={() => view, (value) => (view = value === 'plan' ? 'plan' : 'iso')}
				/>
			</div>
		{/snippet}
	</ChapterViewer>

	<dl
		class="paths-metrics chapter-aspect-values data"
		aria-label="Network and route metrics"
		aria-live="polite"
	>
		<div>
			<dt>Active nodes</dt>
			<dd>{schematic.network.nodes.length}</dd>
		</div>
		<div>
			<dt>Active edges</dt>
			<dd>{schematic.network.edges.length}</dd>
		</div>
		<div>
			<dt>Elevated edges</dt>
			<dd>{schematic.elevatedEdges}</dd>
		</div>
		<div class="chapter-aspect-metric">
			<dt>Route length</dt>
			<dd>{format.format(highlighted.route.lengthM)}&nbsp;m</dd>
		</div>
		<div>
			<dt>Total climb</dt>
			<dd>{format.format(highlighted.route.climbM)}&nbsp;m</dd>
		</div>
		<div>
			<dt>Level changes</dt>
			<dd>{highlighted.levelChanges}</dd>
		</div>
	</dl>
	{#if selection}
		<p class="small data paths-inspection" role="status">
			{#if selection.kind === 'node'}
				Node {selection.id} · {selection.levelLabel} · Edges: {selection.connections.join(', ')}
			{:else}
				Edge {selection.id} ({selection.edgeKind}) · {selection.from} ↔ {selection.to} · {format.format(
					selection.lengthM
				)}&nbsp;m
			{/if}
		</p>
	{/if}
</section>

<div class="chapter-notes stack">
	<p class="lead">{lead}</p>
	<p>
		<a href={resolve('/paths/valley')}>City and valley demo</a> shows how stations connect to the same
		walking network.
	</p>
</div>
