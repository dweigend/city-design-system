<script lang="ts">
	import { Toolbar } from 'bits-ui';
	import { Icon, type IconName } from '../icon';

	type Tool = { value: string; label: string; icon: IconName; shortcut?: string };
	type Action = Tool & { disabled?: boolean; onclick: () => void };

	interface Props {
		/** Name the toolbar, for example "Sandbox tools". */
		label: string;
		/** Mutually exclusive tools in order, each with a symbol and an optional key. */
		tools: readonly Tool[];
		/** Bind the active tool, for example bind:value={tool}. */
		value: string;
		/** Quiet one-shot actions after the tools, such as undo and redo. */
		actions?: readonly Action[];
		/** Lay the bar out as a column on wide screens. */
		orientation?: 'horizontal' | 'vertical';
	}

	let { label, tools, value = $bindable(), actions = [], orientation = 'vertical' }: Props =
		$props();
	const hint = (item: Tool) => (item.shortcut ? `${item.label} (${item.shortcut})` : item.label);
</script>

<Toolbar.Root class="control-tool-bar" aria-label={label} {orientation} data-orientation={orientation}>
	<Toolbar.Group
		class="control-tool-group"
		type="single"
		aria-label={label}
		bind:value={() => value, (next: string) => next && (value = next)}
	>
		{#each tools as tool (tool.value)}
			<Toolbar.GroupItem
				class="control control-tool"
				value={tool.value}
				title={hint(tool)}
				aria-label={tool.label}
				aria-keyshortcuts={tool.shortcut}
			>
				<Icon name={tool.icon} />
				<span class="control-tool-label label">{tool.label}</span>
				{#if tool.shortcut}<kbd class="control-tool-key">{tool.shortcut}</kbd>{/if}
			</Toolbar.GroupItem>
		{/each}
	</Toolbar.Group>
	{#if actions.length}
		<span class="control-tool-rule" aria-hidden="true"></span>
		{#each actions as action (action.value)}
			<Toolbar.Button
				class="control control-tool control-tool-action"
				title={hint(action)}
				aria-label={action.label}
				aria-keyshortcuts={action.shortcut}
				disabled={action.disabled}
				onclick={action.onclick}
			>
				<Icon name={action.icon} />
			</Toolbar.Button>
		{/each}
	{/if}
</Toolbar.Root>
