<script lang="ts">
	import { onMount } from 'svelte';
	import { createRasterBuehne } from '../scene/rasterBuehne';
	import type { CourtStudy } from './court-study.server';

	let {
		study,
		later = false,
		showCaption = true
	}: { study: CourtStudy; later?: boolean; showCaption?: boolean } = $props();
	let canvas: HTMLCanvasElement;
	let failed = $state(false);
	let cut = $state({ left: 0, right: 0, y: 0 });
	let plaza = $state({ x: 0, y: 0 });

	onMount(() => {
		const stage = createRasterBuehne(
			canvas,
			{ extent: 16, hoeheDeg: 90 },
			{ onError: () => (failed = true) }
		);
		const square = study.plaza.flatMap((p, i) => [
			...p,
			...study.plaza[(i + 1) % study.plaza.length]
		]);
		const visible = study.lots.filter((lot) => (later ? !lot.removed : !lot.added));
		const seams = visible.flatMap(({ polygon }) =>
			polygon.flatMap((p, i) => [...p, ...polygon[(i + 1) % polygon.length]])
		);
		stage.zeige({
			linien: [
				{ key: 'blocks', strecken: study.blocks, token: '--ink-3', papier: 0.54, px: 1, z: 0.01 },
				{
					key: 'contours',
					strecken: study.contours,
					token: '--ink-2',
					papier: 0.3,
					px: 1,
					z: 0.02
				},
				{ key: 'lot-seams', strecken: seams, token: '--paper', px: 1, z: 0.06 },
				{ key: 'square', strecken: square, token: '--ink-2', px: 1.25, z: 0.05 }
			],
			flaechen: visible.map((l) => ({
				polygon: l.polygon,
				token: l.added ? '--signal' : '--ink-2',
				papier: l.added ? 0 : 0.24,
				z: 0.04
			}))
		});
		const resize = () => {
			stage.resize(canvas.clientWidth, canvas.clientHeight);
			const left = stage.projiziere(study.cut.left);
			cut = { left: left.x, right: stage.projiziere(study.cut.right).x, y: left.y };
			const [a, , c] = study.plaza;
			plaza = stage.projiziere([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]);
		};
		const observer = new ResizeObserver(resize);
		resize();
		observer.observe(canvas);
		void stage.ready.catch(() => (failed = true));
		return () => {
			observer.disconnect();
			stage.dispose();
		};
	});
</script>

<figure>
	{#if showCaption}
		<figcaption>
			<strong>{later ? study.afterYear : study.beforeYear}</strong><span>Game</span>
		</figcaption>
	{/if}
	<div class="map">
		<canvas
			bind:this={canvas}
			aria-label={later
				? 'One new house lot beside the existing court group'
				: 'Existing house lots east of the open square'}
		></canvas>
		<span class="place" style:left={plaza.x + 'px'} style:top={plaza.y + 'px'}>Square</span>
		<div
			class="cut"
			style:top={cut.y + 'px'}
			style:left={cut.left + 'px'}
			style:width={cut.right - cut.left + 'px'}
			aria-hidden="true"
		>
			<b>A</b><i></i><b>A′</b>
		</div>
		{#if failed}<p>Plan view unavailable.</p>{/if}
	</div>
</figure>

<style>
	figure {
		margin: 0;
		min-width: 0;
	}
	figcaption {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: var(--space-2);
	}
	strong {
		font: 600 var(--text-l)/1 var(--font-sans);
	}
	span,
	b {
		font: var(--text-xs)/1 var(--font-mono);
	}
	span {
		color: var(--ink-2);
	}
	.map {
		position: relative;
		border-block: var(--hair) solid var(--line);
	}
	canvas {
		display: block;
		width: 100%;
		aspect-ratio: 2.4;
	}
	.place {
		position: absolute;
		transform: translate(-50%, 50%);
		background: var(--paper);
		padding: 2px;
		color: var(--ink);
	}
	.cut {
		position: absolute;

		transform: translateY(-50%);
		display: flex;
		align-items: center;
		gap: var(--space-1);
		pointer-events: none;
	}
	b {
		background: var(--paper);
		padding: 2px;
	}
	i {
		flex: 1;
		height: 1px;
		background: repeating-linear-gradient(to right, var(--ink-2) 0 4px, transparent 4px 10px);
		opacity: 0.7;
	}
	p {
		position: absolute;
		inset: 0;
		background: var(--paper);
	}
</style>
