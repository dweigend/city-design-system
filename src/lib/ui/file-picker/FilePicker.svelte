<script lang="ts">
	import { Button } from '../button';

	let {
		label,
		accept,
		disabled,
		onfile
	}: {
		label: string;
		accept: string;
		disabled?: boolean;
		onfile: (file: File) => void;
	} = $props();
	let input: HTMLInputElement;

	function change() {
		const file = input.files?.[0];
		input.value = '';
		if (file) onfile(file);
	}
</script>

<Button {label} {disabled} onclick={() => input.click()} />
<input bind:this={input} type="file" {accept} onchange={change} hidden />
