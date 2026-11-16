<script lang="ts">
	import type { Check } from 'lucide-svelte';
	import { ICON_RASTER, ICON_STRICH, type IconGroesse, type IconZeichnung } from '../data/icons';

	/**
	 * An icon of the icon language: own drawing (data/icons.ts) or Lucide icon.
	 * Stroke 1.5 px at every size. `ton` fills the surface with a meaning token
	 * (e.g. flowToken.water). Without `label` the icon is silent.
	 */
	let {
		icon,
		size = 24,
		ton,
		label
	}: {
		icon: IconZeichnung | typeof Check;
		size?: IconGroesse;
		ton?: string;
		label?: string;
	} = $props();

	const a11y = $derived(
		label ? { role: 'img', 'aria-label': label } : ({ 'aria-hidden': 'true' } as const)
	);
</script>

{#if typeof icon === 'function'}
	{@const Lucide = icon}
	<Lucide {size} strokeWidth={ICON_STRICH} absoluteStrokeWidth {...a11y} />
{:else}
	<svg
		width={size}
		height={size}
		viewBox="0 0 {ICON_RASTER} {ICON_RASTER}"
		stroke-width={(ICON_STRICH * ICON_RASTER) / size}
		style:--icon-ton={ton ? `var(${ton})` : undefined}
		{...a11y}
	>
		{#if icon.flaeche}<path class="flaeche" d={icon.flaeche} />{/if}
		{#if icon.masse}<path class="masse" d={icon.masse} />{/if}
		{#if icon.linie}<path d={icon.linie} />{/if}
	</svg>
{/if}

<style>
	svg {
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.flaeche {
		fill: var(--icon-ton, none);
		fill-rule: evenodd;
	}
	.masse {
		fill: currentColor;
	}
</style>
