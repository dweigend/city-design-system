<script lang="ts">
	import { flowToken } from '../data/focus';
	import type { Pass } from '../data/stadtBausteine';

	/**
	 * Component passport as a tag: type small, instance large, below it provenance and connection,
	 * then the lifecycle record. Entries appear when the loop reaches them; the latest carries
	 * the color of the Material flow. A derived piece hangs below as its own tag.
	 * On narrow stages the passport shows only the header and the latest entry.
	 */
	let {
		pass,
		phase,
		local,
		breite = $bindable(0)
	}: { pass: Pass; phase: number; local: number; breite?: number } = $props();

	const sichtbar = (ab: number) => phase > ab || (phase === ab && (ab === 0 || local > 0.45));
	const eintraege = $derived(pass.lebenslauf.filter((e) => sichtbar(e.ab)));
	const kind = $derived(
		pass.abkoemmling && sichtbar(pass.abkoemmling.ab) ? pass.abkoemmling : null
	);
</script>

<div class="pass" style:--ton="var({flowToken.material})" bind:clientWidth={breite}>
	<article class="anhaenger" aria-label="Component passport {pass.nr}">
		<header>
			<span class="loch" aria-hidden="true"></span>
			<span class="typ">{pass.typ}</span>
			<span class="nr"><span class="praefix">Instance</span> {pass.nr}</span>
			<span class="merkmal">{pass.merkmal}</span>
		</header>
		<dl>
			<dt>Provenance</dt>
			<dd>{pass.herkunft}</dd>
			<dt>Connection</dt>
			<dd>{pass.verbindung}</dd>
		</dl>
		<ol class="lauf" aria-live="polite">
			{#each eintraege as e, i (e.jahr + e.text)}
				<li class:neu={i === eintraege.length - 1 && e.ab > 0}>
					<span class="jahr">{e.jahr}</span><span>{e.text}</span>
				</li>
			{/each}
		</ol>
	</article>
	{#if kind}
		<span class="faden" aria-hidden="true"></span>
		<article class="anhaenger kind" aria-label="Component passport {kind.nr}">
			<header>
				<span class="loch" aria-hidden="true"></span>
				<span class="typ">{kind.typ}</span>
				<span class="nr"><span class="praefix">Instance</span> {kind.nr}</span>
				<span class="merkmal">{kind.text}</span>
			</header>
		</article>
	{/if}
</div>

<style>
	.pass {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		width: min(17rem, 100%);
		font-size: var(--text-xs);
		line-height: 1.4;
	}
	.anhaenger {
		position: relative;
		width: 100%;
		padding: var(--space-3) var(--space-3) var(--space-3) var(--space-6);
		background: var(--paper);
		border: var(--hair) solid var(--ink);
		border-left: var(--space-1) solid var(--ton);
		color: var(--ink);
		animation: auf 240ms var(--ease);
	}
	.kind {
		width: 85%;
		margin-left: var(--space-6);
	}
	.faden {
		width: var(--hair);
		height: var(--space-3);
		margin-left: calc(var(--space-6) + var(--space-3));
		background: var(--ink);
	}
	header {
		display: flex;
		flex-direction: column;
	}
	.loch {
		position: absolute;
		left: var(--space-2);
		top: var(--space-3);
		width: var(--space-2);
		height: var(--space-2);
		border: var(--hair) solid var(--ink);
		border-radius: 50%;
	}
	.typ {
		color: var(--ink-2);
	}
	.nr {
		font-size: var(--text-l);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		line-height: 1.15;
		letter-spacing: -0.01em;
	}
	.praefix {
		font-size: var(--text-xs);
		font-weight: 400;
		letter-spacing: 0;
		color: var(--ink-2);
	}
	.merkmal {
		padding-top: var(--space-1);
		color: var(--ink-2);
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0 var(--space-3);
		margin: var(--space-3) 0 0;
		padding-top: var(--space-2);
		border-top: var(--hair) solid var(--line);
	}
	dt {
		color: var(--ink-2);
	}
	dd {
		margin: 0;
	}
	.lauf {
		list-style: none;
		margin: var(--space-2) 0 0;
		padding: var(--space-2) 0 0;
		border-top: var(--hair) solid var(--line);
	}
	.lauf li {
		display: grid;
		grid-template-columns: 2.6em 1fr;
		gap: var(--space-2);
		padding: 1px 0;
		animation: auf 320ms var(--ease);
	}
	.lauf li.neu {
		box-shadow: inset var(--space-1) 0 0 var(--ton);
		margin-left: calc(-1 * var(--space-2));
		padding-left: var(--space-2);
	}
	.jahr {
		font-variant-numeric: tabular-nums;
		color: var(--ink-2);
	}
	@keyframes auf {
		from {
			opacity: 0;
			transform: translateY(var(--space-1));
		}
	}
	/* Narrow stage: only the header and the latest entry. */
	@container stadtbild (max-width: 520px) {
		.pass {
			width: 11.5rem;
		}
		.anhaenger {
			padding: var(--space-2) var(--space-2) var(--space-2) var(--space-5);
		}
		.nr {
			font-size: var(--text-m);
		}
		.merkmal,
		dl {
			display: none;
		}
		.lauf li:not(:last-child) {
			display: none;
		}
		.loch {
			top: var(--space-2);
			left: var(--space-1);
		}
	}
</style>
