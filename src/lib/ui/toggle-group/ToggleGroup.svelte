<script lang="ts">
	import { ToggleGroup as Primitive } from 'bits-ui';

	interface Props {
		/** Name the whole choice, for example "View mode". */
		label: string;
		/** Show the group label alongside its accessible name. */
		showLabel?: boolean;
		/** Supply segments in order, such as [{ value: 'all', label: 'All items' }]. */
		items: readonly { value: string; label: string; disabled?: boolean }[];
		/** Bind the selected segment ID, for example bind:value={mode}. */
		value: string;
	}

	let { label, showLabel = false, items, value = $bindable() }: Props = $props();

	function select(next: string) {
		if (next !== '') value = next;
	}

	function followFocus(event: KeyboardEvent) {
		if (!event.defaultPrevented || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
			return;
		const focused = document.activeElement;
		if (focused instanceof HTMLElement && focused.dataset.value) select(focused.dataset.value);
	}
</script>

{#if showLabel}
	<span class="label control-segments-label" aria-hidden="true">{label}</span>
{/if}

<Primitive.Root
	class="control-segments"
	type="single"
	aria-label={label}
	bind:value={() => value, select}
	onkeydown={followFocus}
>
	{#snippet child({ props })}
		<div {...props} role="radiogroup">
			{#each items as item, index (item.value)}
				<Primitive.Item
					class="control control-button label"
					value={item.value}
					disabled={item.disabled}
				>
					{#snippet child({ props })}
						<button {...props} tabindex={value === item.value || (!value && index === 0) ? 0 : -1}>
							{item.label}
						</button>
					{/snippet}
				</Primitive.Item>
			{/each}
		</div>
	{/snippet}
</Primitive.Root>
