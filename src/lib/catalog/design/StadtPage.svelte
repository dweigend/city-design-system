<script lang="ts">
	import DesignShell from './DesignShell.svelte';
	import Wegweiser from './Wegweiser.svelte';
	import Abschnitt from '../bibel/Abschnitt.svelte';
	import { Bauteilpass, Hochwege, Leitbild, Schwammstadt, Weiterbauen } from '../stadt';
	import { leitbild } from '../data/vision';
	import * as T from '../data/stadt';

	/**
	 * Home page: the city. One sentence of guiding vision, the guiding ideas as jump links, then four
	 * experiments in reading order: building on existing stock, elevated walkways, sponge city, component passport.
	 * At the end the way into the other chapters.
	 */
</script>

<svelte:head><title>City · City Design System</title></svelte:head>

<DesignShell title="City">
	<Leitbild {...leitbild} />

	<Abschnitt id={T.weiterbauen.id} titel={T.weiterbauen.titel} lead={T.weiterbauen.lead}>
		<Weiterbauen />
	</Abschnitt>

	<Abschnitt id={T.hochwege.id} titel={T.hochwege.titel} lead={T.hochwege.lead}>
		<Hochwege />
	</Abschnitt>

	<Abschnitt id={T.schwamm.id} titel={T.schwamm.titel} lead={T.schwamm.lead}>
		<Schwammstadt />
	</Abschnitt>

	<Abschnitt id={T.bauteile.id} titel={T.bauteile.titel} lead={T.bauteile.lead}>
		<Bauteilpass />
	</Abschnitt>

	<Wegweiser />
</DesignShell>
