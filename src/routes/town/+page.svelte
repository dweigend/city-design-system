<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { valleyParams } from '../../lib/domain/valley';
	import {
		cityCameraBearingRad,
		cityElevation,
		cityFrameFillFlat
	} from '../../lib/scene/city-volume-projection';
	import { projectFocus, type View } from '../../lib/scene/stage';
	import { StageView } from '../../lib/scene/stage-view';
	import { Select } from '../../lib/ui/select';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import { createTownReview, townFocus, townFrames, type TownFrame } from './town';

	type Review = ReturnType<typeof createTownReview>;

	const relief = valleyParams.relief.default;
	const format = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
	const views = [
		{ value: 'iso', label: 'Iso' },
		{ value: 'plan', label: 'Plan' }
	];
	const focusItems = townFocus.choices.map((value) => ({
		value,
		label: townFocus.readFocusChoice(value).label
	}));
	const frameLabels: Record<TownFrame, string> = {
		whole: 'Whole town',
		quarter: 'Quarter',
		street: 'Street'
	};
	const frameItems = townFrames.map((value) => ({ value, label: frameLabels[value] }));
	const camera = { bearing: cityCameraBearingRad, elevation: cityElevation(relief) };

	let review = $state.raw<Review>();
	let status = $state('Building the whole town…');

	const location = $derived(page.shallow?.url ?? page.url);
	const query = (key: string) => location.searchParams.get(key);
	const focus = $derived(townFocus.choices.find((value) => value === query('focus')) ?? 'town');
	const frame = $derived(townFrames.find((value) => value === query('frame')) ?? 'whole');
	const view = $derived<View>(query('view') === 'plan' ? 'plan' : 'iso');
	const drawables = $derived(review?.draw(focus) ?? []);
	const fit = $derived(
		review && {
			...camera,
			fill: cityFrameFillFlat,
			elevationAtWidth: (width: number) => cityElevation(relief, width),
			subject: projectFocus(view, camera, review.subjects[frame])
		}
	);
	const measurements = $derived(
		review
			? [
					{ label: 'Houses', value: String(review.figures.houses), unit: '' },
					{ label: 'Unbuildable parcels', value: String(review.figures.unbuildable), unit: '' },
					{ label: 'Cladding', value: format.format(review.figures.triangles), unit: 'triangles' },
					{ label: 'Walkways', value: format.format(review.figures.walkwaysKm), unit: 'km' },
					{ label: 'Rail', value: format.format(review.figures.railKm), unit: 'km' },
					{ label: 'Stations', value: String(review.figures.stations), unit: '' }
				]
			: []
	);

	onMount(() => {
		// Let the heading and controls paint before the town is built on the main thread.
		const timer = setTimeout(() => {
			try {
				review = createTownReview();
				status = '';
			} catch (error) {
				status = error instanceof Error ? error.message : 'Could not build the town.';
			}
		});
		return () => clearTimeout(timer);
	});

	function select(field: string, value: string) {
		const params = new SvelteURLSearchParams(location.search);
		params.set(field, value);
		void goto(resolve(`/town?${params}`), {
			state: page.state,
			shallow: true,
			replace: true,
			reset: false
		});
	}
</script>

<svelte:head>
	<title>Town review · City Design System</title>
</svelte:head>

<header class="stack">
	<h1>Town review</h1>
	<p class="small">
		The default town in one picture: terrain and water, lanes and parcels, every house as a plain
		volume with detail where the salience rule grants it, walkways, bridges, the elevated rail with
		its stations, and the primary structure.
	</p>
</header>

<section class="stack" aria-label="Whole-town review">
	<div class="cluster">
		<Select
			label="Focus"
			items={focusItems}
			bind:value={() => focus, (value: string) => select('focus', value)}
		/>
		<ToggleGroup
			label="Frame"
			items={frameItems}
			bind:value={() => frame, (value: string) => select('frame', value)}
		/>
		<ToggleGroup
			label="View"
			items={views}
			bind:value={() => view, (value: string) => select('view', value === 'plan' ? 'plan' : 'iso')}
		/>
	</div>
	{#if review && fit}
		<div class="city-stage">
			<StageView
				{drawables}
				{view}
				{fit}
				display="normal"
				landscape
				interactive
				label="The whole default town with its houses, paths, rail and structure"
			/>
		</div>
		<dl class="data cluster city-measurements" aria-live="polite">
			{#each measurements as { label, value, unit } (label)}
				<div>
					<dt>{label}</dt>
					<dd>
						{value}{#if unit}&nbsp;{unit}{/if}
					</dd>
				</div>
			{/each}
		</dl>
	{:else}
		<p class="small" role="status">{status}</p>
	{/if}
</section>
