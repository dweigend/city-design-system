<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import type { LatticeVariant } from '../../../lib/domain/city-volume';
	import { Select } from '../../../lib/ui/select';
	import ChapterViewer from '../../ChapterViewer.svelte';
	import { buildStudy, fit, section } from './study';

	const lattices = [
		{ value: 'box', label: 'Prism' },
		{ value: 'antiprism', label: 'Antiprism' },
		{ value: 'diagrid', label: 'Diagrid' },
		{ value: 'tree', label: 'Tree' }
	] as const satisfies readonly { value: LatticeVariant; label: string }[];
	const modes = [
		{ value: 'assembled', label: 'Assembled' },
		{ value: 'section', label: 'Section' },
		{ value: 'transparency', label: 'Transparency' }
	] as const;

	const location = $derived(page.shallow?.url ?? page.url);
	const selected = $derived(
		lattices.find(({ value }) => value === location.searchParams.get('lattice')) ?? lattices[0]
	);
	const shown = $derived(
		modes.find(({ value }) => value === location.searchParams.get('view')) ?? modes[0]
	);
	const study = $derived(buildStudy(selected.value));
	const drawables = $derived(
		shown.value === 'section'
			? study.drawables.map((part) => ({ ...part, section }))
			: study.drawables
	);

	function selectOption(field: 'lattice' | 'view', value: string) {
		const params = new SvelteURLSearchParams(location.search);
		params.set(field, value);
		void goto(resolve(`/architecture/dock-study?${params}`), {
			state: page.state,
			shallow: true,
			replace: true,
			reset: false
		});
	}
</script>

<svelte:head>
	<title>Face docking · City Design System</title>
</svelte:head>

<header class="stack">
	<a class="small" href={resolve('/architecture')}>Architecture</a>
	<h1>Face docking</h1>
</header>

<section class="chapter-hero stack" aria-label="Face docking study">
	<ChapterViewer
		stage={{
			drawables,
			view: 'iso',
			display: shown.value === 'transparency' ? 'transparency' : 'normal',
			fit,
			interactive: true,
			label: `${selected.label} lattice with face-docked modules · ${shown.label}`
		}}
	>
		{#snippet controls()}
			<Select
				label="Lattice model"
				items={lattices}
				bind:value={() => selected.value, (value: string) => selectOption('lattice', value)}
				portalTo=".chapter-viewer"
			/>
			<Select
				label="Dissection"
				items={modes}
				bind:value={() => shown.value, (value: string) => selectOption('view', value)}
				portalTo=".chapter-viewer"
			/>
		{/snippet}
	</ChapterViewer>
	<dl class="city-measurements cluster data" aria-live="polite">
		<div>
			<dt>Docked</dt>
			<dd>{study.docked}</dd>
		</div>
		<div>
			<dt>Rejected collisions</dt>
			<dd>{study.rejected}</dd>
		</div>
		<div>
			<dt>FORM-5 joints</dt>
			<dd>{study.joints}</dd>
		</div>
	</dl>
</section>
