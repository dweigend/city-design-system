<script lang="ts">
	import { layers, type LayerId } from '../data/focus';

	/**
	 * Legend below the color lab: three layers, each with a swatch as in the scene and what
	 * currently lies in it. Focus shows the colors of the flows in focus (without a flow: strong edge),
	 * context paper with a pencil edge, background the envelope. Swatches always carry an outline (AM11).
	 */
	let {
		inhalt,
		toene
	}: {
		/** What is currently visible per layer. */
		inhalt: Record<LayerId, string>;
		/** Color tokens of the flows in focus. */
		toene: string[];
	} = $props();

	const fokusFarbe = $derived.by(() => {
		if (!toene.length) return undefined;
		const n = toene.length;
		return `linear-gradient(90deg, ${toene
			.map((t, i) => `var(${t}) ${(i / n) * 100}% ${((i + 1) / n) * 100}%`)
			.join(', ')})`;
	});
</script>

<dl class="legende">
	{#each layers as l (l.id)}
		<div class="zeile">
			<dt>
				<span
					class="feld"
					data-ebene={l.id}
					style:background={l.id === 'focus' ? fokusFarbe : undefined}
					aria-hidden="true"
				></span>{l.name}
			</dt>
			<dd>{inhalt[l.id]}</dd>
		</div>
	{/each}
</dl>

<style>
	.legende {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0;
	}
	.zeile {
		display: grid;
		grid-template-columns: 9rem minmax(0, 1fr);
		gap: var(--space-3);
		align-items: baseline;
	}
	dt {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--ink);
		font-weight: 600;
	}
	dd {
		margin: 0;
	}
	/* Context: opaque paper; background: outline only, the surface lets you see through. */
	.feld {
		flex: none;
		width: 14px;
		height: 10px;
		background: var(--paper-3);
		border: var(--hair) solid var(--ink-3);
	}
	.feld[data-ebene='focus'] {
		border: var(--stroke) solid var(--ink);
	}
	.feld[data-ebene='background'] {
		background: transparent;
	}
	@media (max-width: 600px) {
		.zeile {
			grid-template-columns: 1fr;
			gap: 0;
		}
	}
</style>
