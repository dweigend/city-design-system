<script lang="ts">
	import ChapterHeader from '../../ChapterHeader.svelte';
	import { chapterAt } from '../../chapters';
	import ValleyDemo from './ValleyDemo.svelte';

	const chapter = chapterAt('/paths');
	const title = 'City and valley paths';
</script>

<svelte:head>
	<title>{title} · City Design System</title>
</svelte:head>

<ChapterHeader
	number={chapter.number}
	{title}
	lead="Trace the route from a parcel entrance to a station, or follow the elevated rail along the valley."
/>

<ValleyDemo />
