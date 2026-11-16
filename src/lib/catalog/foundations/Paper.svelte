<script lang="ts">
	import type { Snippet } from 'svelte';
	/**
	 * Graph paper: three line levels (1 · 5 · 10 U).
	 * Line colors are mixed here from --ink, so that plan mode
	 * (--ink = blueprint) colors the paper as well.
	 *
	 * Pixel convention (applies to everything drawn on the paper):
	 * - A line at grid coordinate x occupies the pixels [x, x + weight).
	 *   Hairline 1 px → [x, x+1), line 2 px → [x, x+2), bar 8 px → [x, x+8).
	 *   Lines therefore always grow to the right or downward, never centered.
	 * - Paper lines lie at 0, 4, 8 … (background-position 0 0),
	 *   so every drawn line covers exactly its paper line.
	 * - In SVG: shift the group for hairlines by (0.5, 0.5), for lines by (1, 1);
	 *   coordinates stay integer grid values.
	 * - Nested or adjacent boxes share their edge, it is never drawn twice.
	 * - A drawing sheet measures n · 40 + 1 px, so the closing line lies at n · 40.
	 */
	let { levels = 3, children }: { levels?: 1 | 2 | 3; children?: Snippet } = $props();
</script>

<div class="paper" data-levels={levels}>{@render children?.()}</div>

<style>
	.paper {
		--grid-1: color-mix(in srgb, var(--ink) 4%, transparent);
		--grid-5: color-mix(in srgb, var(--ink) 8%, transparent);
		--grid-10: color-mix(in srgb, var(--ink) 16%, transparent);
		--l10:
			linear-gradient(to right, var(--grid-10) 1px, transparent 1px),
			linear-gradient(to bottom, var(--grid-10) 1px, transparent 1px);
		--l5:
			linear-gradient(to right, var(--grid-5) 1px, transparent 1px),
			linear-gradient(to bottom, var(--grid-5) 1px, transparent 1px);
		--l1:
			linear-gradient(to right, var(--grid-1) 1px, transparent 1px),
			linear-gradient(to bottom, var(--grid-1) 1px, transparent 1px);
		position: relative;
		background-color: var(--paper);
		background-image: var(--l10), var(--l5), var(--l1);
		background-size:
			var(--u10) var(--u10),
			var(--u10) var(--u10),
			var(--u5) var(--u5),
			var(--u5) var(--u5),
			var(--u) var(--u),
			var(--u) var(--u);
		background-position: 0 0;
		/* Closing line on the right and bottom, in case the sheet does not measure n · 40 + 1 px */
		box-shadow: inset -1px -1px 0 var(--grid-10);
	}
	[data-levels='2'] {
		background-image: var(--l10), var(--l5);
		background-size:
			var(--u10) var(--u10),
			var(--u10) var(--u10),
			var(--u5) var(--u5),
			var(--u5) var(--u5);
	}
	[data-levels='1'] {
		background-image: var(--l10);
		background-size: var(--u10) var(--u10);
	}
	@media (max-resolution: 1.5dppx) {
		.paper {
			--grid-1: color-mix(in srgb, var(--ink) 3%, transparent);
		}
	}
</style>
