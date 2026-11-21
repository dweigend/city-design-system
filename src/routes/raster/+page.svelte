<script lang="ts">
	import RasterPage from '#lib/catalog/design/RasterPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<RasterPage study={data.study} />
