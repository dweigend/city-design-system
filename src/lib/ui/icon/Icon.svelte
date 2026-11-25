<script lang="ts">
	import { defaults } from '../../../config/icon';
	import {
		ChevronDown,
		Dices,
		Download,
		Eraser,
		LocateFixed,
		Maximize,
		Minimize,
		MousePointer2,
		Paintbrush,
		Redo2,
		Trash2,
		Undo2,
		Upload,
		X
	} from 'lucide-svelte';
	import type { IconName } from './names';

	const icons = {
		'chevron-down': ChevronDown,
		'locate-fixed': LocateFixed,
		maximize: Maximize,
		minimize: Minimize,
		x: X,
		paintbrush: Paintbrush,
		eraser: Eraser,
		pointer: MousePointer2,
		dices: Dices,
		undo: Undo2,
		redo: Redo2,
		trash: Trash2,
		download: Download,
		upload: Upload
	} satisfies Record<IconName, typeof X>;

	interface Props {
		/** Choose a symbol, for example "locate-fixed". */
		name: IconName;
	}

	let { name }: Props = $props();
	const Glyph = $derived(icons[name]);
</script>

<Glyph
	class="control-icon"
	size={defaults.iconSizePx}
	strokeWidth={defaults.iconStrokeWidth}
	aria-hidden="true"
/>
