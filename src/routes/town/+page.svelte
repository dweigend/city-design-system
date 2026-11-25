<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { valleyParams } from '../../lib/domain/valley';
	import {
		cityCameraBearingRad,
		cityElevation,
		cityFrameFillFlat
	} from '../../lib/scene/city-volume-projection';
	import { projectFocus, type View } from '../../lib/scene/stage';
	import type { Drawable } from '../../lib/scene/surface';
	import { StageView } from '../../lib/scene/stage-view';
	import { Switch } from '../../lib/ui/switch';
	import { Select } from '../../lib/ui/select';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import { createTownReview, townFocus, townFrames, type TownFrame } from './town';
	import { readQuery } from '../architecture/query';
	import { houseUses } from '../house-uses';

	type Review = ReturnType<typeof createTownReview>;
	type DetailPass = ReturnType<Review['createDetailPass']>;

	const relief = valleyParams.relief.default;
	const format = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
	const views = [
		{ value: 'iso', label: '3D' },
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
	let settled = $state.raw<ReturnType<DetailPass['advance']>>();
	let painted = $state(false);
	let unavailable = $state(false);
	let failure = $state('');
	const status = $derived(
		failure ||
			(!review
				? 'Building the whole town…'
				: painted || unavailable
					? ''
					: 'Adding house detail and gardens…')
	);

	const location = $derived(page.shallow?.url ?? page.url);
	const query = (key: string) => location.searchParams.get(key);
	const focus = $derived(townFocus.choices.find((value) => value === query('focus')) ?? 'town');
	const frame = $derived(townFrames.find((value) => value === query('frame')) ?? 'whole');
	const view = $derived<View>(query('view') === 'plan' ? 'plan' : 'iso');
	const transparent = $derived(query('display') === 'transparency');
	const seed = $derived(readQuery(location.searchParams).setup.seed);
	const selection = $derived({ review, focus, frame, view, transparent });
	let armed = $state.raw<{ selection: typeof selection; pass: DetailPass; run: () => boolean }>();
	const frameWork = $derived(armed?.selection === selection ? armed : undefined);
	const drawables = $derived((settled ?? review)?.draw(focus) ?? []);
	const fit = $derived(
		review && {
			...camera,
			fill: cityFrameFillFlat,
			elevationAtWidth: (width: number) => cityElevation(relief, width),
			subject: projectFocus(view, camera, review.subjects[frame])
		}
	);
	const figures = $derived((settled ?? review)?.figures);
	const measurements = $derived(
		figures
			? [
					{ label: 'Houses', value: String(figures.houses), unit: '' },
					{ label: 'Unbuildable parcels', value: String(figures.unbuildable), unit: '' },
					...(settled
						? [{ label: 'Cladding', value: format.format(figures.triangles), unit: 'triangles' }]
						: []),
					{ label: 'Walkways', value: format.format(figures.walkwaysKm), unit: 'km' },
					{ label: 'Rail', value: format.format(figures.railKm), unit: 'km' },
					{ label: 'Stations', value: String(figures.stations), unit: '' }
				]
			: []
	);

	$effect(() => {
		const requestedSeed = seed;
		review = undefined;
		settled = undefined;
		painted = false;
		unavailable = false;
		failure = '';
		// Let the heading and controls paint before laying out the town.
		const timer = setTimeout(() => {
			try {
				review = createTownReview(requestedSeed);
			} catch (error) {
				reportFailure(error);
			}
		});
		return () => clearTimeout(timer);
	});

	$effect(() => {
		const requested = selection;
		return () => {
			if (armed?.selection !== requested) return;
			armed.pass.cancel();
			armed = undefined;
		};
	});

	function reportFailure(error: unknown) {
		failure = error instanceof Error ? error.message : 'Could not build the town.';
	}

	function confirmRender(shown: readonly Drawable[]) {
		if (!review || shown !== drawables || failure) return;
		if (settled) {
			painted = true;
			armed = undefined;
			return;
		}
		const requested = selection;
		if (armed?.selection === requested) return;
		const pass = review.createDetailPass(() => performance.now());
		pass.confirmSilhouette();
		armed = {
			selection: requested,
			pass,
			run() {
				if (selection !== requested) {
					pass.cancel();
					return false;
				}
				try {
					settled = pass.advance();
					return !settled;
				} catch (error) {
					pass.cancel();
					reportFailure(error);
					return false;
				}
			}
		};
	}

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
		New storeys and elevated walkways rise above the retained street fronts. The house functions
		view reveals the uses stacked within each building.
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
		<Switch
			label="Transparency"
			bind:checked={
				() => transparent, (checked) => select('display', checked ? 'transparency' : 'normal')
			}
		/>
	</div>
	{#if focus === 'houses'}
		<ul class="cluster house-uses small" role="list" aria-label="House functions">
			{#each houseUses as { use, label, tone } (use)}
				<li><span data-tone={tone} aria-hidden="true"></span>{label}</li>
			{/each}
		</ul>
	{/if}
	{#if review && fit}
		<div class="city-stage">
			<StageView
				{drawables}
				{view}
				{fit}
				{frameWork}
				onRender={confirmRender}
				onUnavailable={() => (unavailable = true)}
				display={transparent ? 'transparency' : 'normal'}
				landscape
				interactive
				label="The whole default town with its houses, parks, paths, rail and structure"
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
	{/if}
	{#if status}
		<p class="small" role="status">{status}</p>
	{/if}
</section>
