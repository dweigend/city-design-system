<script lang="ts">
	import { Checkbox, Label } from 'bits-ui';
	import type { Schicht, SchichtId } from '../data/raster';

	/**
	 * Layers of the simulation as a sequence: each arises from the previous one, hence numbered.
	 * Each row is switch and legend at once: the symbol shows how the layer appears in the image.
	 */
	let { schichten, aktiv = $bindable([]) }: { schichten: readonly Schicht[]; aktiv?: SchichtId[] } =
		$props();

	const an = (id: SchichtId) => aktiv.includes(id);
	function setze(id: SchichtId, wert: boolean) {
		aktiv = wert
			? schichten.map((s) => s.id).filter((s) => s === id || aktiv.includes(s))
			: aktiv.filter((s) => s !== id);
	}
</script>

<fieldset class="schichten">
	<legend>Layers</legend>
	<ol>
		{#each schichten as s, i (s.id)}
			<li>
				<Checkbox.Root
					id="schicht-{s.id}"
					checked={an(s.id)}
					onCheckedChange={(v) => setze(s.id, v === true)}
					class="box"
				>
					{#snippet children({ checked })}{#if checked}<span class="haken"></span>{/if}{/snippet}
				</Checkbox.Root>
				<Label.Root for="schicht-{s.id}" class="zeile">
					<span class="nr">{i + 1}</span>
					<span class="name">{s.name}</span>
					<svg class="zeichen" data-schicht={s.id} viewBox="0 0 28 12" aria-hidden="true">
						{#if s.id === 'bloecke'}<path d="M1 11 L1 1 L27 1" />
						{:else if s.id === 'zellen'}<path d="M1 6 H27 M10 1 V11 M19 1 V11" />
						{:else if s.id === 'vierecke'}<path d="M1 6 H27 M5 1 V11 M14 1 V11 M23 1 V11" />
						{:else if s.id === 'ecken'}<circle cx="6" cy="6" r="2.5" /><circle
								cx="20"
								cy="6"
								r="2.5"
								class="frei"
							/>
						{:else}<rect x="4" y="3" width="8" height="8" /><rect
								x="15"
								y="1"
								width="9"
								height="10"
								class="neu"
							/>{/if}
					</svg>
				</Label.Root>
			</li>
		{/each}
	</ol>
</fieldset>

<style>
	.schichten {
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	legend {
		padding: 0 0 var(--space-2);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: var(--hair) solid var(--line);
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		border-bottom: var(--hair) solid var(--line);
	}
	li :global(.box) {
		flex: none;
		width: var(--space-4);
		height: var(--space-4);
		padding: 0;
		display: grid;
		place-items: center;
		border: var(--hair) solid var(--ink);
		background: var(--paper);
		cursor: pointer;
	}
	li :global(.box:focus-visible) {
		outline: var(--stroke) solid var(--ink);
		outline-offset: 2px;
	}
	.haken {
		width: var(--space-2);
		height: var(--space-2);
		background: var(--ink);
	}
	li :global(.zeile) {
		flex: 1;
		display: grid;
		grid-template-columns: var(--space-4) 1fr auto;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--ctl-s, 2.25rem);
		padding: var(--space-1) 0;
		font-size: var(--text-s);
		color: var(--ink);
		cursor: pointer;
	}
	.nr {
		color: var(--ink-2);
		font-variant-numeric: tabular-nums;
	}
	.zeichen {
		width: 28px;
		height: 12px;
		overflow: visible;
		fill: none;
		stroke-linecap: round;
	}
	.zeichen[data-schicht='bloecke'] path {
		stroke: var(--ink);
		stroke-width: 2;
	}
	.zeichen[data-schicht='zellen'] path {
		stroke: var(--ink-3);
		stroke-width: 1;
	}
	.zeichen[data-schicht='vierecke'] path {
		stroke: var(--blueprint);
		stroke-width: 1;
	}
	.zeichen[data-schicht='ecken'] circle {
		fill: var(--signal);
	}
	.zeichen[data-schicht='ecken'] .frei {
		fill: var(--ink-3);
	}
	.zeichen[data-schicht='stadt'] rect {
		fill: var(--paper-3, var(--paper-2));
		stroke: var(--ink-3);
		stroke-width: 1;
	}
	.zeichen[data-schicht='stadt'] .neu {
		fill: color-mix(in oklch, var(--cat-living) 50%, var(--paper));
		stroke: var(--ink);
	}
</style>
