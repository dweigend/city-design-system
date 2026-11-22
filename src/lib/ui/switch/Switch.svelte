<script lang="ts">
	import { Switch as Primitive } from 'bits-ui';

	interface Props {
		/** Visible name of the setting, such as "Grid". */
		label: string;
		/** Bind the on/off value, for example bind:checked={grid}. */
		checked?: boolean;
		/** Disable an unavailable setting. */
		disabled?: boolean;
	}

	const id = $props.id();
	let { label, checked = $bindable(false), disabled = false }: Props = $props();
</script>

<div class="control-switch-field">
	<Primitive.Root {id} class="control control-switch" bind:checked {disabled}>
		<Primitive.Thumb class="control-switch-thumb" />
	</Primitive.Root>
	<label class="label" for={id}>{label}</label>
</div>
