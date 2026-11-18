<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import { radGesten } from './radGesten';

	/**
	 * One picker wheel: a Bits UI radio group laid out as a horizontal dial. The chosen option sits
	 * centered; its neighbours fade with distance. Arrow keys move the choice (radio group, one tab
	 * stop) and stop at both ends. The mouse wheel steps once per notch while the dial is focused;
	 * horizontal trackpad gestures always step; a horizontal swipe steps by the distance swiped;
	 * every visible option can be clicked. A linear carousel dial was chosen over a circular wheel:
	 * long finish names stay legible and it fits 390 px without a second layout.
	 */
	type Option = { value: string; label: string; muster?: string };
	let {
		id,
		label,
		options,
		value,
		onwaehle
	}: {
		id: string;
		label: string;
		options: readonly Option[];
		value: string;
		onwaehle: (wert: string) => void;
	} = $props();

	const index = $derived(
		Math.max(
			0,
			options.findIndex((o) => o.value === value)
		)
	);
	const aktuell = $derived(options[index]);
	/** Width of one dial cell in rem; the track offset uses the same unit. */
	const ZELLE_REM = 6.5;

	/** Moves by d options, clamped at both ends (a linear dial does not wrap). */
	function schritt(d: number) {
		const ziel = Math.max(0, Math.min(options.length - 1, index + d));
		if (ziel !== index) onwaehle(options[ziel].value);
	}

	const gesten = radGesten(schritt, ZELLE_REM);

	/** CSS background for a swatch: custom property name or literal color. */
	const muster = (m?: string) => (m ? (m.startsWith('--') ? `var(${m})` : m) : 'transparent');
</script>

<div class="rad" style="--zelle: {ZELLE_REM}rem; --index: {index}">
	<div class="kopf">
		<span class="name" id="{id}-label">{label}</span>
		<span class="wert" aria-hidden="true">{aktuell?.label}</span>
	</div>
	<div class="fenster">
		<button
			type="button"
			class="pfeil"
			tabindex="-1"
			aria-hidden="true"
			disabled={index === 0}
			onclick={() => schritt(-1)}>‹</button
		>
		<div
			class="spurfenster"
			role="presentation"
			data-radfenster={id}
			onwheel={gesten.rad}
			onpointerdown={gesten.start}
			onpointerup={gesten.ende}
			onpointercancel={gesten.abbrechen}
			onclickcapture={gesten.klick}
		>
			<RadioGroup.Root
				{value}
				onValueChange={(v) => v && onwaehle(v)}
				orientation="horizontal"
				loop={false}
				aria-labelledby="{id}-label"
				data-rad={id}
				class="spur"
			>
				{#each options as o, i (o.value)}
					<RadioGroup.Item
						value={o.value}
						class="zelle"
						data-wert={o.value}
						style="--abstand: {Math.min(3, Math.abs(i - index))}"
					>
						<span class="muster" style="--muster: {muster(o.muster)}" aria-hidden="true"></span>
						<span class="text">{o.label}</span>
					</RadioGroup.Item>
				{/each}
			</RadioGroup.Root>
		</div>
		<button
			type="button"
			class="pfeil"
			tabindex="-1"
			aria-hidden="true"
			disabled={index === options.length - 1}
			onclick={() => schritt(1)}>›</button
		>
	</div>
</div>

<style>
	.rad {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
		font-size: var(--text-s);
	}
	.kopf {
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
		padding: 0 var(--space-1);
	}
	.name {
		color: var(--ink-2);
	}
	.wert {
		color: var(--ink);
		font-weight: 600;
		text-align: right;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.fenster {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		border-top: var(--hair) solid var(--line);
		border-bottom: var(--hair) solid var(--line);
	}
	.pfeil {
		width: 44px;
		height: 44px;
		border: 0;
		background: none;
		color: var(--ink-2);
		font: inherit;
		font-size: var(--text-l);
		cursor: pointer;
		touch-action: manipulation;
	}
	.pfeil:hover:not(:disabled) {
		color: var(--ink);
	}
	.pfeil:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.spurfenster {
		position: relative;
		overflow: hidden;
		touch-action: pan-y;
		mask-image: linear-gradient(to right, transparent, #000 18%, #000 82%, transparent);
	}
	.spurfenster :global(.spur) {
		position: relative;
		left: 50%;
		display: flex;
		width: max-content;
		transform: translateX(calc(-1 * (var(--index) + 0.5) * var(--zelle)));
		transition: transform var(--slow, 240ms) var(--ease);
	}
	.spurfenster :global(.zelle) {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		width: var(--zelle);
		min-height: 64px;
		padding: var(--space-2) var(--space-1);
		border: 0;
		background: none;
		color: var(--ink-2);
		font: inherit;
		font-size: var(--text-xs);
		line-height: 1.25;
		text-align: center;
		cursor: pointer;
		touch-action: manipulation;
		/* Operable neighbours stay legible (DS-61): opacity never below 0.6. */
		opacity: calc(1 - var(--abstand) * 0.13);
		transform: scale(calc(1 - var(--abstand) * 0.05));
		transition:
			opacity var(--fast) var(--ease),
			transform var(--fast) var(--ease),
			color var(--fast) var(--ease);
	}
	.spurfenster :global(.zelle:hover) {
		color: var(--ink);
	}
	.spurfenster :global(.zelle[data-state='checked']) {
		color: var(--ink);
	}
	.spurfenster :global(.zelle:focus-visible) {
		outline: var(--stroke) solid var(--ink);
		outline-offset: -2px;
	}
	.muster {
		width: 22px;
		height: 22px;
		flex: none;
		border-radius: 50%;
		background: var(--muster);
		box-shadow: inset 0 0 0 var(--hair) color-mix(in oklab, var(--ink) 22%, transparent);
	}
	.spurfenster :global(.zelle[data-state='checked'] .muster) {
		box-shadow:
			inset 0 0 0 var(--hair) color-mix(in oklab, var(--ink) 22%, transparent),
			0 0 0 2px var(--paper),
			0 0 0 3.5px var(--ink);
	}
	.text {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	@media (prefers-reduced-motion: reduce) {
		.spurfenster :global(.spur),
		.spurfenster :global(.zelle) {
			transition: none;
		}
	}
</style>
