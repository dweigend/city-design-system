<script lang="ts">
	import { Button } from '../button';
	import type { IconName } from '../icon';
	import { IconButton } from '../icon-button';

	let {
		label,
		accept,
		disabled,
		icon,
		onfile
	}: {
		label: string;
		accept: string;
		disabled?: boolean;
		/** Show a compact symbol instead of the label, for example "upload". */
		icon?: IconName;
		onfile: (file: File) => void;
	} = $props();
	let input: HTMLInputElement;

	function change() {
		const file = input.files?.[0];
		input.value = '';
		if (file) onfile(file);
	}
</script>

{#if icon}
	<IconButton {label} {icon} {disabled} onclick={() => input.click()} />
{:else}
	<Button {label} {disabled} onclick={() => input.click()} />
{/if}
<input bind:this={input} type="file" {accept} onchange={change} hidden />
