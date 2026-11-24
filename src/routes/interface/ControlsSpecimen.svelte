<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Accordion } from '../../lib/ui/accordion';
	import { Button } from '../../lib/ui/button';
	import { Icon } from '../../lib/ui/icon';
	import { IconButton } from '../../lib/ui/icon-button';
	import { Popover } from '../../lib/ui/popover';
	import { Select } from '../../lib/ui/select';
	import { Slider } from '../../lib/ui/slider';
	import { Switch } from '../../lib/ui/switch';
	import { Tabs } from '../../lib/ui/tabs';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import { SpecimenPicker } from '../../lib/ui/specimen-picker';
	import { ToolBar } from '../../lib/ui/tool-bar';

	const modes = [
		{ value: 'all', label: 'All items' },
		{ value: 'focus', label: 'Focus field' },
		{ value: 'section', label: 'Section', disabled: true }
	];
	const fields = [
		{ value: 'water', label: 'Water' },
		{ value: 'energy', label: 'Energy' },
		{ value: 'people', label: 'People' },
		{ value: 'food', label: 'Food' },
		{ value: 'material', label: 'Material', disabled: true }
	];
	const sections = [
		{ value: 'plan', label: 'Plan' },
		{ value: 'elevation', label: 'Elevation' },
		{ value: 'section', label: 'Section', disabled: true }
	];
	const notes = [
		{ value: 'survey', label: 'Survey notes' },
		{ value: 'datum', label: 'Height datum' },
		{ value: 'archive', label: 'Archive', disabled: true }
	];

	const drawTools = [
		{ value: 'draw', label: 'Draw', icon: 'paintbrush', shortcut: 'B' },
		{ value: 'erase', label: 'Erase', icon: 'eraser', shortcut: 'E' },
		{ value: 'pick', label: 'Pick', icon: 'pointer', shortcut: 'V' }
	] as const;
	// Two hand-drawn isometric blocks: a cube and a slab, in the specimen's own units.
	const block = (tone: `--${string}`, high: number) => ({
		viewBox: '-9 -9 18 18',
		faces: [
			{ points: `0,${-high} 7,${-high - 4} 0,${-high - 8} -7,${-high - 4}`, tone, shade: 'top' },
			{ points: `0,${-high} 7,${-high - 4} 7,-4 0,0`, tone, shade: 'lit' },
			{ points: `0,${-high} -7,${-high - 4} -7,-4 0,0`, tone, shade: 'shadow' }
		]
	}) as const;
	const blocks = [
		{ value: 'tower', label: 'Tower', sketch: block('--mat-masonry', 4) },
		{ value: 'slab', label: 'Slab', sketch: block('--cat-mobility', 0) }
	];
	let drawTool = $state('draw');
	let blockChoice = $state('tower');
	let mode = $state('all');
	let field = $state('water');
	let grid = $state(false);
	let guides = $state(true);
	let height = $state(4);
	let section = $state('plan');
	let detail = $state('datum');
	let applied = $state('All items');
	const fieldName = $derived(fields.find((item) => item.value === field)?.label);

	function apply() {
		applied = mode === 'all' ? 'All items' : (fieldName ?? 'No focus field');
	}

	function clear() {
		field = '';
		mode = 'all';
		applied = 'All items';
	}

	function chooseField(value: string) {
		field = value;
		mode = 'focus';
	}
</script>

{#snippet sample(name: string, use: string, preview: Snippet)}
	<div class="control-sample">
		<div>
			<h3>{name}</h3>
			<p class="small">{use}</p>
		</div>
		<div class="control-sample-preview">
			{@render preview()}
		</div>
	</div>
{/snippet}

<section class="stack" aria-labelledby="controls">
	<h2 id="controls">Controls</h2>
	{#snippet buttons()}
		<div class="cluster control-sample-states">
			<Button label="Show all" size="s" onclick={clear} />
			<Button label="Apply view" variant="primary" onclick={apply} />
			<Button label="Publish" disabled />
		</div>
		<p class="data" role="status">Applied view · {applied}</p>
	{/snippet}
	{@render sample('Button', 'Run a named action.', buttons)}

	{#snippet iconButtons()}
		<div class="cluster control-sample-states">
			<IconButton label="Clear focus" icon="x" size="s" onclick={clear} />
			<IconButton
				label="Locate focus field"
				icon="locate-fixed"
				onclick={() => (mode = 'focus')}
				disabled={!field}
			/>
			<IconButton label="Remove field" icon="x" disabled />
		</div>
		<p class="data">Focus field · {fieldName ?? 'None'}</p>
	{/snippet}
	{@render sample(
		'IconButton',
		'Clear or locate a focus field with a compact action.',
		iconButtons
	)}

	{#snippet icons()}
		<Icon name="locate-fixed" />
	{/snippet}
	{@render sample('Icon', 'Draw a familiar symbol beside an action or label.', icons)}

	{#snippet toggles()}
		<ToggleGroup label="View mode" items={modes} bind:value={mode} />
	{/snippet}
	{@render sample('ToggleGroup', 'Choose between a few mutually exclusive views.', toggles)}

	{#snippet toolBar()}
		<ToolBar
			label="Drawing tools"
			tools={drawTools}
			bind:value={drawTool}
			orientation="horizontal"
			actions={[{ value: 'undo', label: 'Undo', icon: 'undo', shortcut: 'Ctrl+Z', onclick: clear }]}
		/>
		<p class="data">Tool · {drawTool}</p>
	{/snippet}
	{@render sample(
		'ToolBar',
		'Hold one active tool, with its symbol and key, beside a few quiet actions.',
		toolBar
	)}

	{#snippet specimenPicker()}
		<SpecimenPicker label="Block" items={blocks} bind:value={blockChoice} />
	{/snippet}
	{@render sample('SpecimenPicker', 'Choose an object by its drawing, not by its name.', specimenPicker)}

	{#snippet switches()}
		<div class="cluster control-sample-states">
			<Switch label="Grid" bind:checked={grid} />
			<Switch label="Guides" bind:checked={guides} />
			<Switch label="Shadows" disabled />
		</div>
	{/snippet}
	{@render sample('Switch', 'Turn one setting on or off.', switches)}

	{#snippet slider()}
		<Slider label="Height" min={0} max={10} step={1} bind:value={height} />
	{/snippet}
	{@render sample('Slider', 'Adjust a number in fixed steps.', slider)}

	{#snippet select()}
		<Select label="Focus field" items={fields} bind:value={() => field, chooseField} />
	{/snippet}
	{@render sample('Select', 'Choose one entry from a longer list.', select)}

	{#snippet tabs()}
		<Tabs label="Drawing sections" items={sections} bind:value={section}>
			{#snippet panel(id)}
				<p class="small">
					{id === 'plan' ? 'View the site from above.' : 'Read heights along the river.'}
				</p>
			{/snippet}
		</Tabs>
	{/snippet}
	{@render sample('Tabs', 'Switch between sections in the same place.', tabs)}

	{#snippet accordion()}
		<Accordion items={notes} bind:value={detail}>
			{#snippet panel(id)}
				<p class="small">
					{id === 'survey'
						? 'The survey follows the eastern bank.'
						: 'Heights use the river datum.'}
				</p>
			{/snippet}
		</Accordion>
	{/snippet}
	{@render sample('Accordion', 'Reveal optional details in place.', accordion)}

	{#snippet popover()}
		<Popover label="View help">
			<p class="small">
				Use × to clear the focus field. Use the crosshair to return to it, then apply the view.
			</p>
		</Popover>
	{/snippet}
	{@render sample('Popover', 'Open a small panel with help or actions.', popover)}
</section>
