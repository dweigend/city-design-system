<script lang="ts">
	import HausDemo from '../formen/traeger/HausDemo.svelte';
	import { tick } from 'svelte';
	import Teilseiten from '../formen/traeger/Teilseiten.svelte';
	import DesignShell from './DesignShell.svelte';
	import Abschnitt from '../bibel/Abschnitt.svelte';
	import {
		Komposition,
		LoopEcken,
		LoopWeg,
		StapelLoop,
		TurmSimulation,
		Verformung,
		Vokabular
	} from '../formen';
	import { startWahl, type Phase, type TurmWahl } from '../logic/formen';
	import type { CellShape } from '../logic/parametrik/formen/zellen';
	import { einstieg, eckLoop, wegLoop } from '../data/turm';
	import * as F from '../data/formen';

	/** Building subpage: tower on the cell, corners, path and the existing building trials.
	 * The path loop takes over the choice of the simulation and jumps back to it. */
	let wahl = $state<TurmWahl>(structuredClone(startWahl));
	let zelle = $state<CellShape>('square');
	let phase = $state<Phase>('weg');

	async function zumTurm() {
		await tick();
		document.getElementById(einstieg.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head><title>Forms · Building · City Design System</title></svelte:head>

<DesignShell title="Forms">
	<Teilseiten />
	<Abschnitt
		id={einstieg.id}
		titel="The structural system is the building"
		lead="Bible study · Solid and void (/formen#volume-section) sets cell massing, Structures sets the framing family, and this page shows cell-level corner assembly. At 8 m existing stock, elevated walkway and front door meet."
	>
		<HausDemo
			>{#snippet stapel()}<TurmSimulation bind:wahl bind:zelle bind:phase />{/snippet}</HausDemo
		>
	</Abschnitt>

	<Abschnitt id="formen-ecken" titel={eckLoop.titel} lead={eckLoop.lead}>
		<LoopEcken />
	</Abschnitt>

	<Abschnitt id="formen-weg" titel={wegLoop.titel} lead={wegLoop.lead}>
		<LoopWeg
			onausprobieren={() => {
				phase = 'weg';
				void zumTurm();
			}}
		/>
	</Abschnitt>

	<Abschnitt id={F.stapel.id} titel={F.stapel.titel} lead={F.stapel.lead}>
		<StapelLoop />
	</Abschnitt>

	<Abschnitt id={F.verformung.id} titel={F.verformung.titel} lead={F.verformung.lead}>
		<Verformung />
	</Abschnitt>

	<Abschnitt id={F.vokabular.id} titel={F.vokabular.titel} lead={F.vokabular.lead}>
		<Vokabular />
	</Abschnitt>

	<Abschnitt id={F.komposition.id} titel={F.komposition.titel} lead={F.komposition.lead}>
		<Komposition />
	</Abschnitt>
</DesignShell>
