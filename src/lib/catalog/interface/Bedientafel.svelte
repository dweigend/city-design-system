<script lang="ts">
	import { ChevronLeft, ChevronRight, Info, Plus } from 'lucide-svelte';
	import Button from '../ui/Button.svelte';
	import Checkbox from '../ui/Checkbox.svelte';
	import Icon from '../ui/Icon.svelte';
	import Metric from '../ui/Metric.svelte';
	import Scale from '../ui/Scale.svelte';
	import Timeline from './Timeline.svelte';
	import Selection from '../ui/Selection.svelte';
	import Switch from '../ui/Switch.svelte';
	import Tabs from '../ui/Tabs.svelte';
	import Tag from '../ui/Tag.svelte';
	import Tile from '../ui/Tile.svelte';
	import TileGrid from '../ui/TileGrid.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	import { flows, flowToken, type FlowId } from '../data/focus';
	import { formIcons } from '../data/icons';
	import { bedienBeispiele as B, bedienelemente } from '../data/interface';

	/**
	 * Panel of UI controls: each element once, with its name and its task in the game.
	 * One grid (3 · 2 · 1 columns), wide elements across the whole row.
	 * Buildings are shown on the panel with the game's form icons, not with images of its own.
	 */
	const rolle = Object.fromEntries(bedienelemente.map((e) => [e.id, e]));
	const name = (id: FlowId) => flows.find((f) => f.id === id)?.name ?? id;
	const reiter = B.reiter.map((r, i) => ({ ...r, index: String(i + 1).padStart(2, '0') }));
	const zustaende = [
		{ label: 'Planned', color: 'var(--blueprint)', onColor: 'var(--on-accent)' },
		{ label: 'Selected', color: 'var(--signal)', onColor: 'var(--on-accent)' }
	];
</script>

{#snippet kopf(id: string)}
	<header>
		<h3>{rolle[id].name}</h3>
		<p>{rolle[id].rolle}</p>
	</header>
{/snippet}

<div class="tafel">
	<section class="zelle">
		{@render kopf('knopf')}
		<div class="reihe">
			<Button label="Build" shortcut="B" />
			<Button variant="secondary" label="Cancel" shortcut="Esc" />
			<Button variant="icon" label="Add"
				>{#snippet icon()}<Plus size={16} strokeWidth={1.5} />{/snippet}</Button
			>
		</div>
	</section>

	<section class="zelle">
		{@render kopf('schalter')}
		<div class="spalte">
			<Switch id="tafel-plan" label="Plan" checked />
			<Switch variant="labeled" id="tafel-hochwege" label="Show elevated walkways" />
		</div>
	</section>

	<section class="zelle">
		{@render kopf('haken')}
		<div class="spalte">
			{#each B.aufgaben as t (t.id)}<Checkbox
					id="tafel-{t.id}"
					label={t.label}
					checked={t.done}
				/>{/each}
		</div>
	</section>

	<section class="zelle">
		{@render kopf('regler')}
		<Scale {...B.regler} />
	</section>

	<section class="zelle">
		{@render kopf('reiter')}
		<Tabs items={reiter} label="Tabs of a building panel" />
	</section>

	<section class="zelle">
		{@render kopf('hinweis')}
		<div class="reihe">
			<Tooltip text="Back · ←">
				{#snippet trigger(props)}<Button {...props} variant="icon" label="Back"
						>{#snippet icon()}<ChevronLeft size={16} strokeWidth={1.5} />{/snippet}</Button
					>{/snippet}
			</Tooltip>
			<Tooltip text="Next · →">
				{#snippet trigger(props)}<Button {...props} variant="icon" label="Next"
						>{#snippet icon()}<ChevronRight size={16} strokeWidth={1.5} />{/snippet}</Button
					>{/snippet}
			</Tooltip>
			<Tooltip
				variant="callout"
				text={B.haus.name}
				index={B.haus.index}
				detail="{B.haus.bewohner} residents"
			>
				{#snippet trigger(props)}<Button {...props} variant="icon" label="Info on {B.haus.name}"
						>{#snippet icon()}<Info size={16} strokeWidth={1.5} />{/snippet}</Button
					>{/snippet}
			</Tooltip>
		</div>
	</section>

	<section class="zelle">
		{@render kopf('marke')}
		<div class="reihe">
			{#each B.marken as m (m.text)}<Tag text={m.text} meta={m.meta} />{/each}
			{#each ['water', 'food'] as const as s (s)}<Tag
					variant="category"
					text={name(s)}
					color="var({flowToken[s]})"
				/>{/each}
		</div>
	</section>

	<section class="zelle">
		{@render kopf('kennzahl')}
		<Metric {...B.kennzahl} />
	</section>

	<section class="zelle">
		{@render kopf('auswahl')}
		<div class="reihe">
			<Selection label={B.haus.index}><Icon icon={formIcons.klotz} size={48} /></Selection>
			{#each zustaende as z (z.label)}
				<Selection variant="mark" label={z.label} color={z.color} onColor={z.onColor}>
					<Icon icon={formIcons.klotz} size={48} />
				</Selection>
			{/each}
		</div>
	</section>

	<section class="zelle breit">
		{@render kopf('kacheln')}
		<TileGrid columns={11}>
			{#each B.kacheln as k, i (k.strom)}
				<Tile
					size={k.size}
					index={String(i + 1).padStart(2, '0')}
					category={name(k.strom)}
					value={k.value}
					text={k.text}
					color="var({flowToken[k.strom]})"
				/>
			{/each}
		</TileGrid>
	</section>

	<section class="zelle breit">
		{@render kopf('zeitleiste')}
		<Timeline mode="input" caption />
	</section>
</div>

<style>
	/* One grid for all elements: 3 · 2 · 1 columns (114 §3, card sets). */
	.tafel {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-10) var(--space-8);
	}
	.zelle {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-width: 0;
		padding-top: var(--space-3);
		border-top: var(--hair) solid var(--line);
	}
	.breit {
		grid-column: 1 / -1;
	}
	header {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	h3 {
		font-size: var(--text-s);
		font-weight: 600;
	}
	header p {
		font-size: var(--text-s);
		line-height: 1.45;
		color: var(--ink-2);
	}
	.reihe {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.spalte {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
	}
	@media (max-width: 1100px) {
		.tafel {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 600px) {
		.tafel {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-8);
		}
	}
</style>
