<script lang="ts">
	import { ChevronDown, LocateFixed, X } from 'lucide-svelte';
	import type { IconName } from './names';

	const icons = { 'chevron-down': ChevronDown, 'locate-fixed': LocateFixed, x: X } satisfies Record<
		IconName,
		typeof X
	>;

	interface Props {
		/** Choose a symbol, for example "locate-fixed". */
		name: IconName;
	}

	let { name }: Props = $props();
	const Glyph = $derived(icons[name]);
</script>

<Glyph class="control-icon" size={16} strokeWidth={1.5} aria-hidden="true" />
