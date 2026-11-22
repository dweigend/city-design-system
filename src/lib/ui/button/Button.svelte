<script lang="ts">
	import { Button as Primitive } from 'bits-ui';

	interface Props {
		/** Visible action name, such as "Apply". */
		label: string;
		/** Use "primary" for the main action. */
		variant?: 'default' | 'primary';
		/** Use "s" in a compact row. */
		size?: 'm' | 's';
		/** Disable an unavailable action. */
		disabled?: boolean;
		/** Run the action on activation, for example onclick={apply}. */
		onclick?: () => void;
	}

	let { label, variant = 'default', size = 'm', disabled = false, onclick }: Props = $props();
</script>

<Primitive.Root
	class="control control-button label"
	data-size={size}
	data-variant={variant}
	type="button"
	{disabled}
	{onclick}
>
	{label}
</Primitive.Root>
