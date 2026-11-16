<script lang="ts">
	import { Tabs } from 'bits-ui';
	import {
		Building2,
		Check,
		ChevronLeft,
		ChevronRight,
		Ellipsis,
		Info,
		Layers,
		Menu,
		Moon,
		MousePointer2,
		Plus,
		RotateCcw,
		Route,
		SlidersHorizontal,
		Sun,
		Trees,
		X
	} from 'lucide-svelte';
	import IconGrid from '../bibel/IconGrid.svelte';
	import IconKonstruktion from '../bibel/IconKonstruktion.svelte';
	import DataTable from '../bibel/DataTable.svelte';
	import Vertiefung from '../ui/Vertiefung.svelte';
	import * as R from '../data/icon-regeln';
	import * as I from '../data/icons';
	import { formgruppen } from '../data/formen';
	import { flows, flowToken } from '../data/focus';
	import { iconFamilien, type IconFamilieId } from '../data/interface';

	/**
	 * One icon system, one list: families as tabs (Construction, Forms, Flows, Zones,
	 * Context, Controls). One sentence per family, then the drawings in their sizes.
	 * Rules with values are one click deeper in the construction.
	 */
	let familie = $state<IconFamilieId>('konstruktion');

	const lucide: Record<R.UiIconName, typeof Check> = {
		'chevron-left': ChevronLeft,
		'chevron-right': ChevronRight,
		plus: Plus,
		x: X,
		check: Check,
		info: Info,
		ellipsis: Ellipsis,
		'mouse-pointer-2': MousePointer2,
		'building-2': Building2,
		route: Route,
		trees: Trees,
		layers: Layers,
		menu: Menu,
		'sliders-horizontal': SlidersHorizontal,
		'rotate-ccw': RotateCcw,
		sun: Sun,
		moon: Moon
	};

	const beispiele = [I.formIcons.klotz, I.zonenIcons.sockel, I.stromIcons.water];
	const konstruktion = R.iconDarstellungen.map((d, i) => ({
		...d,
		icon: beispiele[i],
		ton: d.id === 'zeichen' ? flowToken.water : undefined
	}));
	const regeln = R.iconRegeln.map((r) => ({ ...r, formel: r.formel ?? '' }));
	const formen = formgruppen.map((g) => ({
		id: g.id,
		icon: I.formIcons[g.id],
		name: g.name,
		text: g.formen
	}));
	const zelle = flows.map((f) => ({
		id: f.id,
		icon: I.formIcons.kapsel,
		name: f.name,
		ton: flowToken[f.id]
	}));
	const stroeme = flows.map((f) => ({
		id: f.id,
		icon: I.stromIcons[f.id],
		name: f.name,
		ton: flowToken[f.id]
	}));
	const zonen = I.bauzonen.map((z) => ({ id: z.id, name: z.name, icon: I.zonenIcons[z.id] }));
	const kontext = I.kontextregeln.map((k) => ({
		id: k.id,
		name: k.name,
		icon: I.regelIcons[k.id]
	}));
	const ui = R.uiIcons.map((u) => ({ id: u.name, icon: lucide[u.name], name: u.rolle }));

	const text = $derived(iconFamilien.find((f) => f.id === familie)?.text ?? '');
</script>

<Tabs.Root bind:value={familie} class="cg-atlas">
	<Tabs.List class="cg-atlas-reiter" aria-label="Icon families">
		{#each iconFamilien as f (f.id)}
			<Tabs.Trigger value={f.id} class="cg-atlas-reiter-knopf">{f.name}</Tabs.Trigger>
		{/each}
	</Tabs.List>
	<p class="satz" aria-live="polite">{text}</p>

	<Tabs.Content value="konstruktion" class="cg-atlas-inhalt">
		<IconKonstruktion items={konstruktion} label="Construction on the grid" />
		<Vertiefung label="Rules of the icon language with values">
			<DataTable
				label="Rules of the icon language"
				columns={[
					{ key: 'begriff', label: 'Area' },
					{ key: 'text', label: 'Rule' },
					{ key: 'formel', label: 'Value' }
				]}
				rows={regeln}
			/>
		</Vertiefung>
	</Tabs.Content>
	<Tabs.Content value="formen" class="cg-atlas-inhalt">
		<IconGrid items={formen} label="Icons of the form groups" />
		<IconGrid items={zelle} label="Room cell per flow" sizes={[48, 24]} />
	</Tabs.Content>
	<Tabs.Content value="stroeme" class="cg-atlas-inhalt">
		<IconGrid items={stroeme} label="Icons of the flows" sizes={[48, 24, 16]} vergleich />
	</Tabs.Content>
	<Tabs.Content value="zonen" class="cg-atlas-inhalt">
		<IconGrid items={zonen} label="Icons of the building zones" />
	</Tabs.Content>
	<Tabs.Content value="kontext" class="cg-atlas-inhalt">
		<IconGrid items={kontext} label="Icons of the context rules" />
	</Tabs.Content>
	<Tabs.Content value="ui" class="cg-atlas-inhalt">
		<IconGrid items={ui} label="Icons of the controls" sizes={[24, 20, 16]} />
	</Tabs.Content>
</Tabs.Root>

<style>
	:global(.cg-atlas) {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	:global(.cg-atlas-reiter) {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	:global(.cg-atlas-reiter-knopf) {
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 0;
		background: none;
		box-shadow: inset 0 0 0 var(--hair) var(--line);
		color: var(--ink-2);
		font: inherit;
		font-size: var(--text-s);
		cursor: pointer;
		touch-action: manipulation;
	}
	:global(.cg-atlas-reiter-knopf:hover) {
		color: var(--ink);
	}
	:global(.cg-atlas-reiter-knopf[data-state='active']) {
		color: var(--paper);
		background: var(--ink);
		box-shadow: none;
	}
	:global(.cg-atlas-reiter-knopf:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
	.satz {
		max-width: 68ch;
		font-size: var(--text-s);
		line-height: 1.5;
		color: var(--ink-2);
	}
	:global(.cg-atlas-inhalt[hidden]) {
		display: none;
	}
	:global(.cg-atlas-inhalt) {
		display: flex;
		flex-direction: column;
		gap: var(--space-8);
	}
	@media (max-width: 960px) {
		:global(.cg-atlas-reiter-knopf) {
			min-height: 44px;
		}
	}
</style>
