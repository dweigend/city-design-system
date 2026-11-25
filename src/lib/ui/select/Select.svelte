<script lang="ts">
	import { defaults } from '../../../config/select';
	import { Select as Primitive } from 'bits-ui';
	import { Icon } from '../icon';

	interface Props {
		/** Visible label for the choice, such as "Focus field". */
		label: string;
		/** Choices in display order, such as [{ value: 'water', label: 'Water' }]. */
		items: readonly { value: string; label: string; disabled?: boolean }[];
		/** Bind the selected ID, for example bind:value={field}. */
		value: string;
		/** Portal container, for example the viewer that enters fullscreen. */
		portalTo?: string | Element;
	}

	const id = $props.id();
	let { label, items, value = $bindable(), portalTo }: Props = $props();
	const selectedLabel = $derived(items.find((item) => item.value === value)?.label ?? 'Choose…');
</script>

<label class="control-select-field">
	<span class="label" {id}>{label}</span>
	<Primitive.Root type="single" bind:value>
		<Primitive.Trigger class="control control-button control-with-icon label" aria-labelledby={id}>
			{selectedLabel}
			<Icon name="chevron-down" />
		</Primitive.Trigger>
		<Primitive.Portal to={portalTo}>
			<Primitive.Content
				class="control-popup control-options"
				align="start"
				sideOffset={defaults.selectOffsetPx}
				aria-labelledby={id}
			>
				<Primitive.Viewport class="control-options-viewport">
					{#each items as item (item.value)}
						<Primitive.Item
							class="control control-option label"
							value={item.value}
							label={item.label}
							disabled={item.disabled}
							aria-disabled={item.disabled || undefined}
						>
							{item.label}
						</Primitive.Item>
					{/each}
				</Primitive.Viewport>
			</Primitive.Content>
		</Primitive.Portal>
	</Primitive.Root>
</label>
