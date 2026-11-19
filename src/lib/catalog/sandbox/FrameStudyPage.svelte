<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createFrameStudy, frameSurvey } from '../logic/sandbox';
	import { bayAxes } from '../logic/megastructure';
	import { createSandboxStage, type SandboxStage } from '../scene/sandbox/stage';
	import Button from '../ui/Button.svelte';

	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let study = $state.raw<ReturnType<typeof createFrameStudy>>();
	let stage = $state.raw<SandboxStage>();
	let tick = $state(0);
	let reserved = $state(false);
	let error = $state('');
	const world = $derived(study?.at(tick, reserved));
	const plan = $derived(world?.state.frameTimeline?.results[0]);
	const built = $derived(
		[...(world?.state.frameBays?.values() ?? [])].filter((bay) => bay.built).length
	);

	function move(date: number, entry: boolean) {
		tick = date;
		reserved = entry;
		const url = new URL(location.href);
		url.searchParams.set('tick', String(date));
		if (entry) url.searchParams.set('entry', 'open');
		else url.searchParams.delete('entry');
		replaceState(resolve(`/sandbox/tragwerk?${url.searchParams}`), {});
	}

	function phaseLabel(seam: string | null) {
		if (!seam) return 'Wait';
		return seam === study?.entrance ? 'Frame entrance frontage' : 'Frame adjoining frontage';
	}

	onMount(() => {
		const replay = createFrameStudy();
		const query = new URLSearchParams(location.search);
		const date = Number(query.get('tick'));
		tick = Number.isInteger(date) ? Math.max(0, Math.min(replay.lastTick, date)) : 0;
		reserved = query.get('entry') === 'open';
		study = replay;
		const start = replay.at(0, false);
		const parcel = start.grid.cellsById.get(replay.parcel);
		if (!parcel) throw new Error('Missing frame study parcel.');
		const [x, y, z] = parcel.center;
		const current = createSandboxStage(canvas, () => (error = '3D view unavailable.'), {
			frame: [
				[x - 16, y - 13, z],
				[x + 16, y + 13, z + 6]
			],
			earliestFullYear: start.state.year
		});
		stage = current;
		void current.ready.catch(() => {});
		const resize = () => current.resize(host.clientWidth, host.clientHeight);
		const observer = new ResizeObserver(resize);
		observer.observe(host);
		resize();
		return () => {
			observer.disconnect();
			current.dispose();
		};
	});

	$effect(() => {
		if (!world || !stage) return;
		stage.show(world, 'all');
		const next = plan?.phases.find((phase) => phase.tick > tick && phase.seam);
		const bay = next?.seam && frameSurvey(world).bays.get(next.seam);
		stage.setCursor(bay ? [bayAxes(bay).axes[2]] : []);
	});
</script>

<svelte:head><title>Frame timeline · Sandbox</title></svelte:head>

<main>
	<header>
		<a href={resolve('/sandbox')}>Sandbox</a>
		<h1>Frame timeline</h1>
		<span>Seed 7 · House {study?.parcel ?? '11/5'}</span>
	</header>
	<div class="view" bind:this={host}>
		<canvas bind:this={canvas} aria-label="Neighbourhood frame at tick {tick}"></canvas>
		{#if error}<p role="alert">{error}</p>{/if}
	</div>
	<footer>
		<section aria-live="polite" aria-label="Frame decision">
			<strong>Tick {tick} · {built} built bays</strong>
			<p>
				{reserved && tick >= 2
					? 'Keep the entrance open from tick 3.'
					: 'Frame the painted frontage.'}
			</p>
			{#if plan}
				<p>Now · {phaseLabel(plan.phases[0].seam)}</p>
				<p>
					Forecast · {plan.phases
						.slice(1)
						.map((p) => `Tick ${p.tick}: ${phaseLabel(p.seam)}`)
						.join(' · ')}
				</p>
			{/if}
		</section>
		<nav aria-label="Frame timeline controls">
			<Button
				variant="secondary"
				label="Previous tick"
				disabled={!study || tick === 0}
				onclick={() => move(tick - 1, reserved)}
			/>
			<Button
				variant="secondary"
				label={tick === 1 ? 'Continue original plan' : 'Next tick'}
				disabled={!study || tick >= study.lastTick}
				onclick={() => move(tick + 1, tick === 1 ? false : reserved)}
			/>
			{#if tick === 1}
				<Button label="Reserve entrance from tick 3" onclick={() => move(2, true)} />
			{/if}
		</nav>
	</footer>
</main>

<style>
	main {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) min(9rem, 35dvh);
		height: 100dvh;
	}
	header,
	footer,
	nav {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
	}
	header,
	footer {
		padding: var(--space-2) var(--space-4);
		background: var(--paper);
	}
	header {
		border-bottom: var(--hair) solid var(--line);
	}
	footer {
		overflow: auto;
		justify-content: space-between;
		border-top: var(--hair) solid var(--line);
	}
	h1 {
		margin: 0;
		font-size: var(--text-l);
	}
	a,
	header span,
	p {
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	p {
		margin: 0;
	}
	section {
		min-height: 5.5em;
	}
	.view {
		position: relative;
	}
	.view p {
		position: absolute;
		inset: 50% 0 auto;
		text-align: center;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
