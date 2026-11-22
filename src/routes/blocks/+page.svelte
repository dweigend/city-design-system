<script module lang="ts">
	export const lead =
		'Objects describe their parts by role and measure them in meters, and every engine building block has a working example.';
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { size } from '../../lib/core/geometry';
	import { stageExample, type View } from '../../lib/scene/stage';
	import { StageView } from '../../lib/scene/stage-view';
	import { Switch } from '../../lib/ui/switch';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';

	const chapter = chapterAt('/blocks');
	const { drawables, newDrawables, footprint, bounds } = stageExample();
	const views = [
		{ value: 'iso', label: 'Iso' },
		{ value: 'plan', label: 'Plan' }
	];
	const surfaces = [
		{ value: 'existing', label: 'Existing' },
		{ value: 'new', label: 'New' }
	];
	const location = $derived(page.shallow?.url ?? page.url);
	let view = $derived<View>(location.searchParams.get('view') === 'plan' ? 'plan' : 'iso');
	const surface = $derived(location.searchParams.get('surface') === 'new' ? 'new' : 'existing');
	let transparent = $derived(location.searchParams.get('display') === 'transparency');

	function selectOption(name: 'view' | 'display' | 'surface', value: string | undefined) {
		const params = new SvelteURLSearchParams(location.search);
		if (value) params.set(name, value);
		else params.delete(name);
		void goto(resolve(params.size ? `/blocks?${params}${location.hash}` : '/blocks'), {
			state: page.state,
			shallow: true,
			replace: true,
			reset: false
		});
	}
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />

<section class="grid grid-aside" aria-label="House example">
	<StageView
		drawables={surface === 'new' ? newDrawables : drawables}
		{view}
		display={transparent ? 'transparency' : 'normal'}
		label="House with a gable roof, central door and two upright windows"
	/>
	<div class="stack">
		<p>
			Every object has parts with named slots, a footprint and anchors. A shared surface assignment
			gives each slot its color and finish. New buildings carry a flow color on the walls.
		</p>
		<div class="cluster">
			<ToggleGroup
				label="View"
				items={views}
				bind:value={
					() => view, (next: string) => selectOption('view', next === 'plan' ? next : undefined)
				}
			/>
			<ToggleGroup
				label="Surface"
				items={surfaces}
				bind:value={
					() => surface,
					(next: string) => selectOption('surface', next === 'new' ? next : undefined)
				}
			/>
			<Switch
				label="Transparency"
				bind:checked={
					() => transparent,
					(next: boolean) => selectOption('display', next ? 'transparency' : undefined)
				}
			/>
		</div>
		<p class="data">
			Footprint {footprint.width} × {footprint.depth}&nbsp;m<br />Bounds {size(bounds).join(
				' × '
			)}&nbsp;m
		</p>
	</div>
</section>
