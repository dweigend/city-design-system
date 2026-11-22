<script lang="ts">
	import { Popover as Primitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { Icon } from '../icon';

	interface Props {
		/** Visible action and panel name, such as "View help". */
		label: string;
		/** Bind whether the panel is open, for example bind:open={helpOpen}. */
		open?: boolean;
		/** Supply the panel body as children of Popover. */
		children: Snippet;
	}

	let { label, open = $bindable(false), children }: Props = $props();
</script>

<Primitive.Root bind:open>
	<Primitive.Trigger class="control control-button control-with-icon label">
		{label}
		<Icon name="chevron-down" />
	</Primitive.Trigger>
	<Primitive.Portal>
		<Primitive.Content
			class="control-popup control-popover"
			align="start"
			sideOffset={4}
			collisionPadding={16}
			role="dialog"
			aria-label={label}
		>
			{@render children()}
		</Primitive.Content>
	</Primitive.Portal>
</Primitive.Root>
