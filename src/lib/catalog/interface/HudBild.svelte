<script lang="ts">
	import { Building2, Layers, MousePointer2, Route, Trees } from 'lucide-svelte';
	import Paper from '../foundations/Paper.svelte';
	import Icon from '../ui/Icon.svelte';
	import { boxFaces, project, viewBoxOf, type Box } from '../data/iso';
	import { flowToken, focusModes, type FlowId, type FocusModeId } from '../data/focus';
	import { stromIcons } from '../data/icons';
	import {
		hudAndocken,
		hudDaten,
		hudHaus,
		hudQuartier,
		hudWerkzeuge,
		hudZeit,
		type HudModus,
		type HudWerkzeugId
	} from '../data/interface';

	/**
	 * HUD as an image: a district without streets, above it only floating information. Purely presentational
	 * (inert): controls are on the right in the demo. Number marks refer to the pattern legend.
	 * Plan colors the ink blue (blueprint); the flow colors keep their meaning.
	 */
	let {
		modus = 'play',
		fokus = 'versorgung',
		nummer
	}: {
		modus?: HudModus;
		fokus?: FocusModeId;
		/** Number of a pattern in the current mode (undefined: not visible). */
		nummer: (id: string) => number | undefined;
	} = $props();

	const werkzeugIcon: Record<HudWerkzeugId, typeof MousePointer2> = {
		auswahl: MousePointer2,
		bauen: Building2,
		wege: Route,
		gruen: Trees,
		ebenen: Layers
	};

	const aktiv = $derived(focusModes.find((m) => m.id === fokus) ?? focusModes[0]);
	const tiefe = (b: Box) => b.x + b.w / 2 + b.y + b.d / 2 + b.z * 0.01;
	const lots = [...hudQuartier].sort((a, b) => tiefe(a.box) - tiefe(b.box));
	const haus = hudQuartier.find((l) => l.id === hudHaus) ?? hudQuartier[0];
	const hausFlaechen = boxFaces(haus.box);
	const vb = viewBoxOf([...hudQuartier.map((l) => l.box), hudAndocken], 12);
	const [vx, vy, vw, vh] = vb.split(' ').map(Number);

	/** Label in space: hairline from the roof center of the building diagonally up to the right. */
	const dach = project(
		haus.box.x + haus.box.w / 2,
		haus.box.y + haus.box.d / 2,
		haus.box.z + haus.box.h
	);
	const knick: [number, number] = [dach[0] - 60, vy + 14];
	/** Position of a map point in percent of the map frame (same aspect ratio as viewBox). */
	const lage = ([x, y]: [number, number]) => ({
		left: `${((x - vx) / vw) * 100}%`,
		top: `${((y - vy) / vh) * 100}%`
	});
	const andockOben = project(
		hudAndocken.x + hudAndocken.w,
		hudAndocken.y,
		hudAndocken.z + hudAndocken.h
	);

	const farbig = (strom?: FlowId) => !!strom && aktiv.flows.includes(strom);
	const ebene = (strom?: FlowId, id?: string) =>
		farbig(strom) || id === hudHaus
			? 'fokus'
			: farbig(strom)
				? 'fokus'
				: aktiv.id === 'bestand'
					? strom
						? 'hinten'
						: 'fokus'
					: strom
						? 'hinten'
						: 'kontext';

	const anteil = (jahr: number) => ((jahr - hudZeit.min) / (hudZeit.max - hudZeit.min)) * 100;
	const ticks = Array.from(
		{ length: (hudZeit.max - hudZeit.min) / hudZeit.major + 1 },
		(_, i) => hudZeit.min + i * hudZeit.major
	);
</script>

{#snippet marke(id: string)}
	{@const n = nummer(id)}
	{#if n}<span class="marke" aria-hidden="true">{n}</span>{/if}
{/snippet}

<div class="hud" data-modus={modus} inert>
	<Paper levels={2}>
		<div class="buehne">
			<div class="karte" style:aspect-ratio="{vw} / {vh}">
				<svg viewBox={vb} aria-hidden="true">
					{#each lots as l (l.id)}
						{@const f = boxFaces(l.box)}
						<g
							class="lot"
							data-ebene={ebene(l.strom, l.id)}
							data-bestand={!l.strom}
							style:--ton={l.strom && farbig(l.strom) ? `var(${flowToken[l.strom]})` : undefined}
						>
							<polygon points={f.left} class="links" />
							<polygon points={f.right} class="rechts" />
							<polygon points={f.top} class="oben" />
						</g>
					{/each}
					{#if modus === 'plan'}
						{@const a = boxFaces(hudAndocken)}
						<g class="andocken">
							<polygon points={a.left} />
							<polygon points={a.right} />
							<polygon points={a.top} />
						</g>
					{:else}
						<polyline
							class="leiter"
							points="{dach[0]},{dach[1]} {knick[0] + 30},{knick[1]} {knick[0]},{knick[1]}"
						/>
						<circle class="punkt" cx={dach[0]} cy={dach[1]} r="2" />
					{/if}
				</svg>
				{#if modus === 'play'}
					<div class="schild" style:left={lage(knick).left} style:top={lage(knick).top}>
						{@render marke('beschriftung')}
						<b>{hudDaten.haus.name}</b>
						<span>{hudDaten.haus.text}</span>
					</div>
				{:else}
					<div class="anker" style:left={lage(andockOben).left} style:top={lage(andockOben).top}>
						{@render marke('andocken')}
					</div>
				{/if}
			</div>

			<div class="kopf">
				<span class="feld ort"
					><b>{hudDaten.ort}</b> / {hudDaten.quartier}{modus === 'plan' ? ' · Planen' : ''}</span
				>
				<div class="werte">
					{#each hudDaten.werte as w (w.label)}
						<span class="feld wert"><span>{w.label}</span><b>{w.wert}</b></span>
					{/each}
					{@render marke('kopf')}
				</div>
			</div>

			<div class="werkzeuge">
				{@render marke('werkzeuge')}
				{#each hudWerkzeuge as w, i (w.id)}
					{@const I = werkzeugIcon[w.id]}
					<span class="werkzeug" data-aktiv={i === (modus === 'plan' ? 1 : 0)} title={w.label}
						><I size={16} strokeWidth={1.5} /></span
					>
				{/each}
			</div>

			<div class="modi">
				{@render marke('fokus')}
				{#each focusModes as m (m.id)}
					<span class="modus" data-aktiv={m.id === fokus}>
						{m.name}
						{#each m.flows as f (f)}<Icon
								icon={stromIcons[f]}
								size={16}
								ton={flowToken[f]}
							/>{/each}
					</span>
				{/each}
			</div>

			<div class="zeit">
				<div class="achse">
					{#each hudZeit.ereignisse as e (e.jahr)}
						<span
							class="ereignis"
							style:left="{anteil(e.jahr)}%"
							style:background="var({flowToken[e.strom]})"
							title={e.text}
						></span>
					{/each}
					<span class="jetzt" style:left="{anteil(hudZeit.value)}%">{hudZeit.value}</span>
				</div>
				<div class="jahre">
					{#each ticks as t (t)}<span style:left="{anteil(t)}%">{t}</span>{/each}
				</div>
			</div>

			<div class="ecke">
				{#if modus === 'play'}
					{@render marke('einschub')}
					<div class="einschub">
						<svg viewBox={viewBoxOf([haus.box], 6)} aria-hidden="true">
							<g class="lot" data-ebene="fokus" style:--ton="var({flowToken.people})">
								<polygon points={hausFlaechen.left} class="links" />
								<polygon points={hausFlaechen.right} class="rechts" />
								<polygon points={hausFlaechen.top} class="oben" />
							</g>
						</svg>
						<span>{hudDaten.haus.name}</span>
					</div>
				{:else}
					{@render marke('inventar')}
					<div class="inventar">
						<p class="titel">Wishes</p>
						{#each hudDaten.wuensche as w (w.text)}
							<p class="zeile wunsch">
								<Icon icon={stromIcons[w.strom]} size={16} ton={flowToken[w.strom]} />{w.text}
							</p>
						{/each}
						<p class="titel">From deconstruction</p>
						{#each hudDaten.inventar as w (w.text)}
							<p class="zeile"><span>{w.text}</span><b>{w.menge}</b></p>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</Paper>
</div>

<style>
	.hud {
		color: var(--ink);
		font-size: var(--text-xs);
	}
	/* Plan: the ink becomes blueprint, paper and lines follow (Paper mixes from --ink). */
	[data-modus='plan'] {
		--ink: var(--blueprint);
		/* Secondary text stays full blueprint (contrast ≥ 4.5 : 1); lines may be lighter. */
		--ink-2: var(--blueprint);
		--ink-3: color-mix(in srgb, var(--blueprint) 45%, var(--paper));
		--line: var(--blueprint-soft);
	}
	.buehne {
		position: relative;
		aspect-ratio: 16 / 10;
		overflow: hidden;
	}
	/* Map frame in the aspect ratio of the drawing: sign and marks lie in its percentages. */
	.karte {
		position: absolute;
		left: 50%;
		top: 52%;
		height: 62%;
		max-width: 74%;
		transform: translate(-55%, -50%);
	}
	.karte svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.anker {
		position: absolute;
		transform: translate(8px, -50%);
	}

	/* District: existing stock drawn gray, focus in flow color, the rest as envelope. */
	.lot polygon {
		stroke: var(--ink-3);
		stroke-width: 1;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
		fill: var(--paper);
	}
	.lot .rechts {
		fill: var(--paper-2);
	}
	.lot .links {
		fill: var(--paper-3);
	}
	.lot[data-ebene='fokus'] polygon {
		stroke: var(--ink);
	}
	.lot[data-ebene='fokus'] .oben {
		fill: var(--ton, var(--paper));
	}
	.lot[data-ebene='fokus'] .links {
		fill: color-mix(in srgb, var(--ton, var(--paper-3)) 70%, var(--paper));
	}
	.lot[data-ebene='fokus'] .rechts {
		fill: color-mix(in srgb, var(--ton, var(--paper-2)) 40%, var(--paper));
	}
	.lot[data-ebene='hinten'] polygon {
		fill: transparent;
		stroke: var(--ink-3);
		stroke-opacity: 0.6;
	}
	.andocken polygon {
		fill: color-mix(in srgb, var(--blueprint) 12%, transparent);
		stroke: var(--ink);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
		vector-effect: non-scaling-stroke;
	}
	.leiter {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.punkt {
		fill: var(--ink);
	}

	/* Floating panels: paper, hairline in ink, no shadows. */
	.feld,
	.schild,
	.werkzeug,
	.modus,
	.einschub,
	.inventar {
		background: var(--paper);
		border: var(--hair) solid var(--ink);
	}
	.feld {
		display: inline-flex;
		align-items: baseline;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
	}
	b {
		font-weight: 600;
	}
	.kopf {
		position: absolute;
		top: var(--space-4);
		left: var(--space-4);
		right: calc(var(--space-4) + 44px);
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
	}
	.werte {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.wert span {
		color: var(--ink-2);
	}
	.schild {
		position: absolute;
		display: flex;
		flex-direction: column;
		padding: var(--space-1) var(--space-2);
		transform: translate(-100%, -50%);
		white-space: nowrap;
	}
	.schild > span:not(.marke) {
		color: var(--ink-2);
	}
	.werkzeuge {
		position: absolute;
		top: var(--space-4);
		right: var(--space-4);
		display: flex;
		flex-direction: column;
	}
	.werkzeug {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		color: var(--ink);
	}
	.werkzeug + .werkzeug {
		margin-top: calc(-1 * var(--hair));
	}
	.werkzeug[data-aktiv='true'] {
		background: var(--ink);
		color: var(--paper);
	}
	.modi {
		position: absolute;
		left: var(--space-4);
		bottom: calc(var(--space-4) + 52px);
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		max-width: 72%;
	}
	.modus {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 2px var(--space-2);
		color: var(--ink-2);
		border-color: var(--line);
	}
	.modus[data-aktiv='true'] {
		color: var(--ink);
		border-color: var(--ink);
		font-weight: 600;
	}
	.zeit {
		position: absolute;
		left: var(--space-4);
		bottom: var(--space-4);
		width: min(60%, 420px);
		padding: var(--space-2) var(--space-3) var(--space-1);
		background: var(--paper);
		border: var(--hair) solid var(--ink);
	}
	.achse {
		position: relative;
		height: 14px;
		border-bottom: var(--hair) solid var(--ink);
	}
	.ereignis {
		position: absolute;
		bottom: 3px;
		width: 6px;
		height: 6px;
		transform: translateX(-50%);
		outline: var(--hair) solid var(--ink);
	}
	.jetzt {
		position: absolute;
		bottom: -8px;
		transform: translateX(-50%);
		padding: 0 4px;
		background: var(--ink);
		color: var(--paper);
		font-family: var(--font-mono);
	}
	.jahre {
		position: relative;
		height: 16px;
		margin-top: 6px;
		color: var(--ink-2);
		font-family: var(--font-mono);
	}
	.jahre span {
		position: absolute;
		transform: translateX(-50%);
	}
	.jahre span:first-child {
		transform: none;
	}
	.jahre span:last-child {
		transform: translateX(-100%);
	}
	.ecke {
		position: absolute;
		right: var(--space-4);
		bottom: var(--space-4);
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
	}
	.einschub {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		width: 120px;
		padding: var(--space-2);
	}
	.einschub svg {
		width: 100%;
		height: 72px;
	}
	.inventar {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 170px;
		padding: var(--space-2);
	}
	.inventar .titel {
		color: var(--ink);
		font-weight: 600;
	}
	.inventar .titel + .zeile {
		margin-top: 2px;
	}
	.inventar .zeile + .titel {
		margin-top: var(--space-2);
	}
	.inventar .zeile {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.inventar .wunsch {
		justify-content: flex-start;
	}
	.marke {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--ink);
		color: var(--paper);
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		align-self: center;
	}
	.werkzeuge .marke {
		position: absolute;
		left: -24px;
		top: 9px;
	}
	.schild .marke {
		position: absolute;
		left: -24px;
		top: 50%;
		transform: translateY(-50%);
	}

	/* Narrow: metrics and modes move closer, the timeline steps back behind the modes. */
	/* Narrow: the same patterns as wide, only stacked. Metrics wrap at the top, the map
	   moves below it, at the bottom timeline and active mode on the left, plug-in module on the right. */
	@media (max-width: 600px) {
		.buehne {
			aspect-ratio: 3 / 4.8;
		}
		.karte {
			top: 150px;
			height: 190px;
			max-width: 92%;
			transform: translateX(-50%);
		}
		.schild > span:not(.marke),
		.modus:not([data-aktiv='true']),
		.jahre span:nth-child(2n) {
			display: none;
		}
		.zeit {
			right: var(--space-4);
			width: auto;
		}
		.modi,
		.ecke {
			bottom: calc(var(--space-4) + 64px);
		}
		.einschub {
			width: 96px;
		}
		.inventar {
			min-width: 0;
			max-width: 170px;
		}
	}
</style>
