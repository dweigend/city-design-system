<script lang="ts">
	import Icon from '../ui/Icon.svelte';
	import { flowSteps, flowToken, type FlowId } from '../data/focus';
	import { formIcons, stromIcons } from '../data/icons';
	import type { Akzent, Farbreihe } from '../data/color';

	/**
	 * The palette as one matrix: rows are meanings (gray and five flows),
	 * columns are roles (steps 1–5, same names for all). Values and tokens stand in the
	 * design rules at the end of the page.
	 */
	let {
		reihen,
		akzente,
		enden,
		akzenteText
	}: {
		reihen: Farbreihe[];
		akzente: Akzent[];
		enden: { hintergrund: string; schrift: string };
		akzenteText: string;
	} = $props();
	const icon = (r: Farbreihe) => (r.id === 'grau' ? formIcons.bestand : stromIcons[r.id]);
	const ton = (r: Farbreihe) => (r.id === 'grau' ? undefined : flowToken[r.id as FlowId]);
</script>

<div class="matrix">
	<div class="zeile kopf" aria-hidden="true">
		<div class="buehne">
			<div class="achse">
				<span>Background</span>
				<span
					class="verlauf"
					style:background="linear-gradient(90deg, var({enden.hintergrund}), var({enden.schrift}))"
				></span>
				<span>Ink</span>
			</div>
			<ol class="band">
				{#each flowSteps as s (s.step)}<li class="stufe">{s.name}</li>{/each}
			</ol>
		</div>
	</div>

	<ul class="reihen" aria-label="Color ramps, five steps each from surroundings to core">
		{#each reihen as r (r.id)}
			<li class="zeile">
				<div class="name" class:grau={r.id === 'grau'}>
					<Icon icon={icon(r)} size={20} ton={ton(r)} />
					<span><b>{r.name}</b><span class="beispiel">{r.beispiel}</span></span>
				</div>
				<ol class="band buehne">
					{#each r.tokens as t, i (t)}
						<li aria-label={flowSteps[i].name}>
							<span class="chip" class:grundton={i === 3} style:background="var({t})"></span>
						</li>
					{/each}
				</ol>
			</li>
		{/each}
	</ul>

	<div class="zeile">
		<div class="buehne fuss">
			<p>
				{akzenteText}
				{#each akzente as a (a.id)}<span class="akzent"
						><span class="punkt" style:background="var({a.token})"></span><b>{a.name}</b>
						{a.text}.</span
					>{/each}
			</p>
		</div>
	</div>
</div>

<style>
	.matrix {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	/* Page grid: steps on the left (2fr ≈ 8 of 12), name directly at the end of the band (1fr). */
	.zeile {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		gap: var(--space-8);
		align-items: start;
	}
	.buehne {
		grid-column: 1;
		grid-row: 1;
	}
	.name {
		grid-column: 2;
		grid-row: 1;
	}
	.reihen {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.achse {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-bottom: var(--space-3);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	.verlauf {
		flex: 1;
		height: var(--stroke);
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	/* One band without joints: the steps read as a gradient, not as tiles. */
	.band {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
	}
	.stufe {
		font-size: var(--text-s);
		padding-bottom: var(--space-1);
	}
	.band li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.chip {
		display: block;
		height: var(--space-10);
	}
	.chip.grundton {
		box-shadow: inset 0 calc(-1 * var(--stroke)) 0 var(--ink);
	}
	.name.grau + .band .chip {
		box-shadow: inset 0 0 0 var(--hair) var(--line);
	}
	.name.grau + .band .chip.grundton {
		box-shadow:
			inset 0 0 0 var(--hair) var(--line),
			inset 0 calc(-1 * var(--stroke)) 0 var(--ink);
	}
	.name {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--space-10);
	}
	.name.grau {
		color: var(--ink-3);
	}
	.name > span {
		display: flex;
		flex-direction: column;
		color: var(--ink);
	}
	b {
		font-weight: 600;
	}
	.beispiel {
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	.fuss {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-4);
	}
	.fuss > p {
		max-width: 68ch;
		line-height: 1.5;
	}
	/* Legend in two rows: swatch directly at the name. */
	.akzent {
		display: block;
	}
	.punkt {
		display: inline-block;
		width: var(--space-3);
		height: var(--space-3);
		margin-right: var(--space-2);
		vertical-align: -1px;
	}
	@media (max-width: 960px) {
		.zeile {
			grid-template-columns: 1fr;
			gap: var(--space-2);
		}
		.buehne {
			grid-row: auto;
		}
		.name {
			grid-column: 1;
			grid-row: auto;
			min-height: 0;
			align-items: center;
		}
		.name > span {
			flex-direction: row;
			flex-wrap: wrap;
			align-items: baseline;
			gap: 0 var(--space-2);
		}
	}
</style>
