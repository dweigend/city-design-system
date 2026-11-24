<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { resolveParams } from '../../../lib/core/params';
	import { latticeVariants, type LatticeVariant } from '../../../lib/domain/city-volume';
	import { portalExample, runGravity } from '../../../lib/domain/structure';
	import { cityCameraBearingRad } from '../../../lib/scene/city-volume-projection';
	import { projectFocus } from '../../../lib/scene/stage';
	import { StageView } from '../../../lib/scene/stage-view';
	import {
		projectStructure,
		structureFocusPreset,
		structureProjectionDefaults
	} from '../../../lib/scene/structure-projection';
	import { Select } from '../../../lib/ui/select';
	import { Slider } from '../../../lib/ui/slider';
	import { structureLoadParams } from '../../../lib/world/city-structure';
	import { townStudy } from './study';

	const percent = new Intl.NumberFormat('en', { style: 'percent' });
	const overloadLabels = [
		'>100%',
		...structureProjectionDefaults.utilizationOverloadRatios.map(
			(ratio) => `${percent.format(ratio)}+`
		)
	];

	const scenes = [
		{ value: 'quarter', label: 'Town quarter' },
		{ value: 'portal', label: 'Three-bay portal' },
		{ value: 'town', label: 'Whole town' }
	];
	const displays = structureFocusPreset.choices.map((value) => ({
		value,
		label: structureFocusPreset.readFocusChoice(value).label
	}));
	const names: Record<LatticeVariant, string> = {
		box: 'Box',
		braced: 'Braced',
		centered: 'Body-centered',
		tetrahedral: 'Tetrahedral',
		antiprism: 'Antiprism',
		diagrid: 'Diagrid',
		tree: 'Tree'
	};
	const latticeModels = latticeVariants;
	const lattices = latticeModels.map((value) => ({ value, label: names[value] }));
	const loadField = structureLoadParams.intensity;
	const format = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
	const portal = portalExample();
	const town = townStudy();

	const location = $derived(page.shallow?.url ?? page.url);
	const scene = $derived(
		scenes.find(({ value }) => value === location.searchParams.get('scene'))?.value ?? 'quarter'
	);
	const mode = $derived(
		displays.find(({ value }) => value === location.searchParams.get('show'))?.value ??
			(scene === 'portal' ? 'utilization' : scene === 'town' ? 'primary' : 'all')
	);
	const showUtilization = $derived(
		structureFocusPreset.readFocusChoice(mode).analysis === 'utilization'
	);
	const lattice = $derived(
		latticeModels.find((value) => value === location.searchParams.get('lattice')) ?? 'braced'
	);
	const intensity = $derived.by(() => {
		const value = Number(location.searchParams.get('load') ?? loadField.default);
		return resolveParams(structureLoadParams, {
			intensity: Number.isFinite(value) ? value : loadField.default
		}).intensity;
	});
	let dragIntensity = $derived(intensity);

	function selectOption(field: string, value: string) {
		const params = new SvelteURLSearchParams(location.search);
		params.set(field, value);
		if (field === 'scene') params.delete('show');
		void goto(resolve(`/architecture/structure?${params}`), {
			state: page.state,
			shallow: true,
			replace: true,
			reset: false
		});
	}

	const structure = $derived(scene === 'portal' ? portal : town.build(lattice, scene === 'town'));
	const graph = $derived(structure.graph);
	const loads = $derived(
		structure.loads.map((load) => ({ ...load, forceKN: (load.forceKN * intensity) / 100 }))
	);
	const analysis = $derived(runGravity(graph, loads));
	const stock = $derived(scene === 'town' ? town.stock() : []);
	const drawables = $derived([
		...(scene === 'portal' ? [] : town.terrain.drawables),
		...stock,
		...projectStructure(graph, {
			view: mode,
			analysis,
			arrows: scene === 'portal' ? loads : undefined,
			supports: scene !== 'town' || mode !== 'primary',
			toLocal: scene === 'portal' ? undefined : town.toLocal
		})
	]);
	const fit = $derived(
		scene === 'portal'
			? { fill: structureProjectionDefaults.portalFrameFill }
			: {
					fill: structureProjectionDefaults.townFrameFill,
					bearing: cityCameraBearingRad,
					subject: projectFocus(
						'iso',
						{ bearing: cityCameraBearingRad },
						graph.joints.map(({ position }) => town.toLocal(position))
					)
				}
	);
</script>

<svelte:head>
	<title>Structural members · City Design System</title>
</svelte:head>

<header class="stack">
	<a class="small" href={resolve('/architecture')}>Architecture</a>
	<h1>Structural members</h1>
</header>

<section class="stack" aria-label="Structural member study">
	<div class="cluster">
		<Select
			label="Frame"
			items={scenes}
			bind:value={() => scene, (value: string) => selectOption('scene', value)}
		/>
		{#if scene !== 'portal'}
			<Select
				label="Lattice model"
				items={lattices}
				bind:value={() => lattice, (value: string) => selectOption('lattice', value)}
			/>
		{/if}
		<Select
			label="Display"
			items={displays}
			bind:value={() => mode, (value: string) => selectOption('show', value)}
		/>
		<Slider
			label={loadField.label}
			min={loadField.min}
			max={loadField.max}
			step={loadField.step}
			bind:value={dragIntensity}
			onCommit={(value: number) => selectOption('load', String(value))}
		/>
	</div>
	<div class="city-stage">
		<StageView
			{drawables}
			view="iso"
			display="normal"
			{fit}
			interactive
			landscape
			label={`${scenes.find(({ value }) => value === scene)?.label}. ${displays.find(({ value }) => value === mode)?.label}.`}
		/>
		{#if showUtilization}
			<figure class="scale-legend structure-legend">
				<figcaption class="small">Nominal axial utilization</figcaption>
				<div class="structure-scale small">
					<div><span class="scale-ramp" aria-hidden="true"></span><span>0–100%</span></div>
					{#each overloadLabels as label (label)}
						<div><span class="scale-ramp" aria-hidden="true"></span><span>{label}</span></div>
					{/each}
				</div>
			</figure>
		{/if}
	</div>
	<dl class="city-measurements cluster data" aria-live="polite">
		<div>
			<dt>Applied</dt>
			<dd>{format.format(analysis.appliedKN)}&nbsp;kN</dd>
		</div>
		<div>
			<dt>Reaction</dt>
			<dd>{format.format(analysis.reactedKN)}&nbsp;kN</dd>
		</div>
		{#if analysis.status === 'unrouted'}
			<div>
				<dt>Unrouted</dt>
				<dd>
					{format.format(analysis.unreactedKN)}&nbsp;kN at {analysis.unsupported.length} joints without
					a gravity route
				</dd>
			</div>
		{/if}
		{#if !analysis.balanced}
			<div>
				<dt>Balance error</dt>
				<dd>{format.format(analysis.balanceErrorKN)}&nbsp;kN</dd>
			</div>
		{/if}
	</dl>
	<p class="small">
		{#if scene === 'portal'}Down arrows show applied loads. Up arrows show support reactions.
		{/if}
		In utilization view, gray members carry no axial estimate. The study traces vertical load paths and
		omits stiffness, buckling and bending.
	</p>
</section>
