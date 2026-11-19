<script lang="ts">
	import { Toggle } from 'bits-ui';
	import { Pause, Play } from 'lucide-svelte';
	import Icon from '../ui/Icon.svelte';

	let { paused = $bindable(false) }: { paused?: boolean } = $props();
</script>

<Toggle.Root
	bind:pressed={paused}
	class="cg-button"
	data-variant="icon"
	aria-label="Pause world motion"
	title={paused ? 'Resume world motion' : 'Pause world motion'}
>
	<Icon icon={paused ? Play : Pause} size={20} />
</Toggle.Root>
