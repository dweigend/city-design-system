<script lang="ts">
	import { Select } from 'bits-ui';
	let {
		label,
		value,
		options,
		onpick
	}: { label: string; value: string; options: readonly string[]; onpick: (value: string) => void } =
		$props();
</script>

<Select.Root
	type="single"
	{value}
	onValueChange={(v) => {
		if (v) onpick(v);
	}}
>
	<Select.Trigger class="house-choice" aria-label={label + ' ' + value}
		>{label} · {value || 'Select'}</Select.Trigger
	>
	<Select.Portal
		><Select.Content class="house-choices" sideOffset={4}>
			<Select.Viewport
				>{#each options as option (option)}<Select.Item
						value={option}
						label={option}
						class="house-choice-item">{option}</Select.Item
					>{/each}</Select.Viewport
			>
		</Select.Content></Select.Portal
	>
</Select.Root>

<style>
	:global(.house-choice),
	:global(.house-choices) {
		background: var(--paper);
		color: var(--ink);
		border: var(--hair) solid var(--ink);
		font: inherit;
	}
	:global(.house-choice),
	:global(.house-choice-item) {
		padding: var(--space-2) var(--space-3);
		cursor: pointer;
	}
	:global(.house-choices) {
		z-index: 100;
		max-height: min(50vh, 24rem);
		overflow: auto;
	}
	:global(.house-choice-item[data-highlighted]) {
		background: var(--ink);
		color: var(--paper);
	}
</style>
