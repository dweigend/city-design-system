<script lang="ts">
	import { Accordion } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import Button from '../ui/Button.svelte';

	/**
	 * Demo layout of the Bible (114 §3, pattern V8): controls always to the right of the effect.
	 * Desktop: image in 8 of 12 columns, controls in 4. Mobile: controls directly below the image,
	 * the image stays at the top while operating.
	 *
	 * Rule (David, 12.11.2026): the controls are never longer than the image. To that end the
	 * demo groups its controls in `Steuergruppe`s; only one is ever open (Bits Accordion), initially
	 * the main group `offen`. If that is not enough, the column is limited to the image height.
	 * Seed and “Reroll” stand in one row (`SaatZeile`). No study numbers and no
	 * statistics texts in the controls.
	 *
	 * Type: the column sets the control variables. ChoiceControl, Scale, Button and Tabs read
	 * them; outside a demo their own defaults apply. This way every option stands in the
	 * text font, without a specificity fight and without changing the Bible font elsewhere.
	 */
	let {
		bild,
		steuerung,
		unterschrift,
		onreset,
		resetLabel = 'Reset view',
		label,
		offen = $bindable('')
	}: {
		bild: Snippet;
		steuerung: Snippet;
		unterschrift?: Snippet;
		onreset?: () => void;
		resetLabel?: string;
		/** Name of the control group for screen readers. */
		label: string;
		/** Value of the open control group; initially the main group. */
		offen?: string;
	} = $props();

	let bildHoehe = $state(0);
	let bildElement: HTMLDivElement;
	function fokusSichtbar(event: FocusEvent) {
		if (!matchMedia('(max-width: 960px)').matches || !(event.target instanceof HTMLElement)) return;
		const ziel = event.target;
		if (bildElement.contains(ziel)) return;
		// After the native focus scroll, take the actually sticky image edge into account.
		requestAnimationFrame(() => {
			const r = ziel.getBoundingClientRect();
			const rand = Math.max(0, bildElement.getBoundingClientRect().bottom) + 16;
			if (r.top < rand) window.scrollBy({ top: r.top - rand, behavior: 'instant' });
			else if (r.bottom > innerHeight - 16)
				window.scrollBy({ top: r.bottom - innerHeight + 16, behavior: 'instant' });
		});
	}
</script>

<div class="demo" onfocusin={fokusSichtbar}>
	<div class="bild" bind:this={bildElement} bind:clientHeight={bildHoehe}>{@render bild()}</div>
	<div
		class="steuerung"
		role="group"
		aria-label={label}
		style:--bild-h={bildHoehe ? `${bildHoehe}px` : undefined}
	>
		<Accordion.Root type="single" bind:value={offen} class="cg-demo-gruppen">
			{@render steuerung()}
		</Accordion.Root>
		{#if onreset}
			<div class="reset"><Button variant="secondary" label={resetLabel} onclick={onreset} /></div>
		{/if}
	</div>
	{#if unterschrift}<div class="text">{@render unterschrift()}</div>{/if}
</div>

<style>
	/* Page grid: image 1–8, controls 9–12 (2fr : 1fr), one alignment line with the section. */
	.demo {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		grid-template-areas:
			'bild steuerung'
			'text steuerung';
		gap: var(--space-4) var(--space-8);
		align-items: start;
	}
	.bild {
		grid-area: bild;
		min-width: 0;
	}
	.steuerung {
		/* Control variables: one voice for all controls of the demo. */
		--steuer-schrift: var(--font-sans);
		--steuer-groesse: var(--text-s);
		--steuer-versal: none;
		--steuer-sperrung: 0;
		--steuer-luft: var(--space-1);
		--steuer-knopf: calc(var(--ctl-m) - var(--space-2));
		grid-area: steuerung;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-width: 0;
		max-height: var(--bild-h, none);
		overflow-y: auto;
		scrollbar-width: thin;
	}
	.steuerung :global(.cg-demo-gruppen) {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.text {
		grid-area: text;
		max-width: 62ch;
		font-size: var(--text-s);
		line-height: 1.5;
		color: var(--ink-2);
	}
	.reset {
		display: flex;
		padding-top: var(--space-4);
		border-top: var(--hair) solid var(--line);
	}

	/* Mobile: image fixed at the top (at most 45 % of the height), controls directly below. */
	@media (max-width: 960px) {
		.demo {
			grid-template-columns: 1fr;
			grid-template-areas:
				'bild'
				'steuerung'
				'text';
			gap: var(--space-4);
		}
		.bild {
			position: sticky;
			top: 0;
			z-index: 1;
			background: var(--paper);
		}
		.bild :global(canvas) {
			max-height: 45svh;
		}
		.steuerung {
			max-height: none;
			overflow: visible;
			--steuer-knopf: 44px;
		}
		/* The image sticks at the top: whoever jumps into the controls by keyboard lands below the image,
		   not behind it (focus stays visible). */
		.steuerung :global(*) {
			scroll-margin-top: calc(45svh + var(--space-12, 48px));
		}
	}
</style>
