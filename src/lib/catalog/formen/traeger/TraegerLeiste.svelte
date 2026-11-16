<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import { familienTexte, ensemble } from '../../data/traeger';
	import type { EnsembleFokus } from '../../logic/traeger/ensemble';
	// Miniatures of the five structural principles, no decorative UI icons.
	const zeichen: Record<string, string> = {
		alle: 'M6 27 12 12 18 27 24 12 30 27M36 27 42 17 48 27ZM54 27V15H66V27ZM12 42 18 32 24 42ZM36 42Q45 23 54 42',
		faltwerk:
			'M8 40 20 16 32 40 44 16 56 40 68 16M8 48 20 24 32 48 44 24 56 48 68 24M8 40V48M20 16V24M32 40V48M44 16V24M56 40V48M68 16V24',
		kuppel:
			'M8 48 12 32 24 19 38 14 52 19 64 32 68 48ZM8 48 26 35 12 32M24 19 26 35 38 14 50 35 52 19M26 35H50L64 32M26 35 38 48 50 35 68 48',
		wabe: 'M24 12H52L66 32 52 52H24L10 32ZM30 23H46L53 32 46 41H30L23 32Z',
		raumfachwerk:
			'M8 45 38 10 68 45ZM8 45 38 31 68 45M38 10V31L23 45M38 31 53 45M8 45 23 25 53 25 68 45M23 25 38 45 53 25',
		gitterschale:
			'M6 47Q20 9 38 24T70 40M6 39Q20 1 38 16T70 32M6 31Q20 -7 38 8T70 24M12 22 12 38M22 12 22 29M32 13 32 29M42 24 42 40M52 30 52 46M62 28 62 44'
	};
	const items = [{ id: 'alle', name: ensemble.alle }, ...familienTexte];
	let { value = $bindable('alle') }: { value?: EnsembleFokus } = $props();
</script>

<div class="leiste">
	<RadioGroup.Root
		bind:value
		aria-label="Structural system in focus"
		orientation="horizontal"
		class="traeger-reihe"
	>
		{#each items as f (f.id)}
			<RadioGroup.Item value={f.id} class="traeger-wahl" aria-label={f.name} title={f.name}>
				<svg viewBox="0 0 76 64" aria-hidden="true"><path d={zeichen[f.id]} /></svg>
				<span>{f.name}</span>
			</RadioGroup.Item>
		{/each}
	</RadioGroup.Root>
</div>

<style>
	.leiste {
		margin-bottom: var(--space-3);
	}
	.leiste :global(.traeger-reihe) {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: var(--space-2);
	}
	.leiste :global(.traeger-wahl) {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink-2);
		font: inherit;
		font-size: var(--text-s);
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
	}
	svg {
		display: block;
		width: 100%;
		height: 52px;
		border: var(--hair) solid var(--line);
		background: var(--paper);
	}
	path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
		stroke-linejoin: round;
	}
	span {
		max-width: 100%;
		overflow-wrap: anywhere;
	}
	.leiste :global(.traeger-wahl:hover),
	.leiste :global(.traeger-wahl[data-state='checked']) {
		color: var(--ink);
	}
	.leiste :global(.traeger-wahl[data-state='checked'] svg) {
		border-color: var(--ink);
		outline: var(--hair) solid var(--ink);
	}
	.leiste :global(.traeger-wahl[data-state='checked'] span) {
		font-weight: 600;
	}
	.leiste :global(.traeger-wahl:focus-visible) {
		outline: none;
	}
	.leiste :global(.traeger-wahl:focus-visible svg) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
	@media (max-width: 720px) {
		.leiste :global(.traeger-reihe) {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		svg {
			height: 44px;
		}
	}
</style>
