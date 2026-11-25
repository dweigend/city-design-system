<script lang="ts">
	import { Button as Primitive } from 'bits-ui';
	import { Icon, type IconName } from '../icon';

	interface Props {
		/** Accessible action name, such as "Clear focus". */
		label: string;
		/** Choose the action symbol, for example "x". */
		icon: IconName;
		/** Use "s" in a compact row. */
		size?: 'm' | 's';
		/** Disable an unavailable action. */
		disabled?: boolean;
		/** Run the action on activation, for example onclick={clear}. */
		onclick?: () => void;
		/** Bind the button element to restore focus after a temporary change of context. */
		ref?: HTMLElement | null;
	}

	let {
		label,
		icon,
		size = 'm',
		disabled = false,
		onclick,
		ref = $bindable(null)
	}: Props = $props();
</script>

<Primitive.Root
	class="control control-icon-button"
	data-size={size}
	type="button"
	aria-label={label}
	title={label}
	bind:ref
	{disabled}
	{onclick}
>
	<Icon name={icon} />
</Primitive.Root>
